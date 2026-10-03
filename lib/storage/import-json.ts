import fs from "fs/promises";
import path from "path";
import type { StoredChat } from "@/lib/chat/types";
import type { StoredReport } from "@/lib/reports/types";
import { getDb, toJsonParam, type Db } from "@/lib/db/client";
import { isValidChatId, writeMessages } from "./chat-store";
import { insertMemory, normalizeMemory } from "./memory-store";
import { insertPreferences, normalizePreferences } from "./preferences-store";
import { isValidActivityId, writeBaseline, writeReport } from "./report-store";

// One-time move of what used to be JSON files under data/ into Postgres. Runs at startup; the files are left in place
// as a backup. Nothing already in the database is overwritten. Each step has its own `app_state` key, so a database
// that imported chats and reports earlier still picks up preferences and memory.

const CHATS_REPORTS_KEY = "json_import";
const ATHLETES_KEY = "json_import_athletes";
const ATHLETE_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface ImportResult {
  chats: number;
  reports: number;
  /** Preference and memory documents. */
  athletes: number;
  skipped: number;
}

async function listDir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(file, "utf-8"));
}

async function importChat(db: Db, athleteId: string, file: string): Promise<boolean> {
  const chat = (await readJson(file)) as StoredChat;
  const chatId = path.basename(file, ".json");
  if (!isValidChatId(chatId) || !Array.isArray(chat?.messages) || !chat.meta?.createdAt) {
    throw new Error("not a saved chat");
  }
  return db.transaction(async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO chats (athlete_id, id, title, created_at, updated_at, summary)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb) ON CONFLICT DO NOTHING RETURNING id`,
      [
        athleteId,
        chatId,
        chat.meta.title ?? "",
        chat.meta.createdAt,
        chat.meta.updatedAt ?? chat.meta.createdAt,
        chat.summary ? toJsonParam(chat.summary) : null,
      ],
    );
    if (!rows.length) return false;
    await writeMessages(tx, athleteId, chatId, chat.messages);
    return true;
  });
}

async function importReport(db: Db, athleteId: string, file: string): Promise<boolean> {
  const report = (await readJson(file)) as StoredReport;
  if (!isValidActivityId(report?.meta?.activityId) || typeof report.body !== "string") {
    throw new Error("not a saved report");
  }
  return db.transaction(async (tx) => {
    const { rows } = await tx.query("SELECT 1 FROM reports WHERE athlete_id = $1 AND activity_id = $2", [
      athleteId,
      report.meta.activityId,
    ]);
    if (rows.length) return false;
    await writeReport(tx, athleteId, report);
    return true;
  });
}

async function importAthleteFile(db: Db, file: string, name: string): Promise<boolean> {
  const memory = name.endsWith(".memory.json");
  const athleteId = name.slice(0, -(memory ? ".memory.json" : ".json").length);
  if (!ATHLETE_PATTERN.test(athleteId)) throw new Error("not an athlete file");
  const stored = await readJson(file);
  return memory
    ? insertMemory(db, athleteId, normalizeMemory(stored))
    : insertPreferences(db, { ...normalizePreferences(stored, athleteId), athleteId });
}

/** Imports data/ once per database. `null` when every step already ran (or another process is on it). */
export async function importLegacyJson(dataDir = path.join(process.cwd(), "data")): Promise<ImportResult | null> {
  const db = await getDb();
  return db.withAdvisoryLock("cadence:json-import", async () => {
    const { rows } = await db.query<{ key: string }>("SELECT key FROM app_state WHERE key = ANY($1::text[])", [
      [CHATS_REPORTS_KEY, ATHLETES_KEY],
    ]);
    const done = new Set(rows.map((r) => r.key));
    if (done.has(CHATS_REPORTS_KEY) && done.has(ATHLETES_KEY)) return null;

    const result: ImportResult = { chats: 0, reports: 0, athletes: 0, skipped: 0 };
    const attempt = async (file: string, run: () => Promise<boolean>, kind: "chats" | "reports" | "athletes") => {
      try {
        if (await run()) result[kind]++;
      } catch (error) {
        result.skipped++;
        console.warn(`[db] Skipped ${file} during the JSON import:`, (error as Error).message);
      }
    };
    const markDone = (key: string) =>
      db.query("INSERT INTO app_state (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING", [
        key,
        new Date().toISOString(),
      ]);

    if (!done.has(CHATS_REPORTS_KEY)) {
      const chatsDir = path.join(dataDir, "chats");
      for (const athleteId of (await listDir(chatsDir)).filter((a) => ATHLETE_PATTERN.test(a))) {
        const dir = path.join(chatsDir, athleteId);
        for (const name of await listDir(dir)) {
          if (!name.endsWith(".json") || name === "index.json") continue;
          const file = path.join(dir, name);
          await attempt(file, () => importChat(db, athleteId, file), "chats");
        }
      }

      const reportsDir = path.join(dataDir, "reports");
      for (const athleteId of (await listDir(reportsDir)).filter((a) => ATHLETE_PATTERN.test(a))) {
        const dir = path.join(reportsDir, athleteId);
        for (const name of await listDir(dir)) {
          if (!name.endsWith(".json") || name === "index.json") continue;
          const file = path.join(dir, name);
          if (name === "state.json") {
            await attempt(
              file,
              async () => {
                const { baseline } = (await readJson(file)) as { baseline?: string };
                if (baseline) await writeBaseline(db, athleteId, baseline);
                return false;
              },
              "reports",
            );
            continue;
          }
          await attempt(file, () => importReport(db, athleteId, file), "reports");
        }
      }
      await markDone(CHATS_REPORTS_KEY);
    }

    if (!done.has(ATHLETES_KEY)) {
      const athletesDir = path.join(dataDir, "athletes");
      for (const name of await listDir(athletesDir)) {
        if (!name.endsWith(".json")) continue;
        const file = path.join(athletesDir, name);
        await attempt(file, () => importAthleteFile(db, file, name), "athletes");
      }
      await markDone(ATHLETES_KEY);
    }

    if (result.chats || result.reports || result.athletes || result.skipped) {
      console.log(
        `[db] Imported ${result.chats} chats, ${result.reports} reports and ${result.athletes} preference/memory ` +
          `files from ${dataDir}` +
          (result.skipped ? ` (${result.skipped} files skipped)` : "") +
          ". The JSON files are no longer used; remove them once you've checked the app.",
      );
    }
    return result;
  });
}
