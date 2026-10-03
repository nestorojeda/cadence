import fs from "fs/promises";
import path from "path";
import type { StoredChat } from "@/lib/chat/types";
import type { StoredReport } from "@/lib/reports/types";
import { getDb, toJsonParam, type Db } from "@/lib/db/client";
import { isValidChatId, writeMessages } from "./chat-store";
import { isValidActivityId, writeBaseline, writeReport } from "./report-store";

// One-time move of the chats and reports that used to be JSON files under data/ into Postgres. Runs at startup; the
// files are left in place as a backup. A chat or report already in the database is never overwritten.

const IMPORT_KEY = "json_import";
const ATHLETE_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface ImportResult {
  chats: number;
  reports: number;
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

/** Imports data/chats and data/reports once per database. `null` when it already ran (or another process is on it). */
export async function importLegacyJson(dataDir = path.join(process.cwd(), "data")): Promise<ImportResult | null> {
  const db = await getDb();
  return db.withAdvisoryLock("cadence:json-import", async () => {
    const done = await db.query("SELECT 1 FROM app_state WHERE key = $1", [IMPORT_KEY]);
    if (done.rows.length) return null;

    const result: ImportResult = { chats: 0, reports: 0, skipped: 0 };
    const attempt = async (file: string, run: () => Promise<boolean>, kind: "chats" | "reports") => {
      try {
        if (await run()) result[kind]++;
      } catch (error) {
        result.skipped++;
        console.warn(`[db] Skipped ${file} during the JSON import:`, (error as Error).message);
      }
    };

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

    await db.query("INSERT INTO app_state (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING", [
      IMPORT_KEY,
      new Date().toISOString(),
    ]);
    if (result.chats || result.reports || result.skipped) {
      console.log(
        `[db] Imported ${result.chats} chats and ${result.reports} reports from ${dataDir}` +
          (result.skipped ? ` (${result.skipped} files skipped)` : "") +
          ". The JSON files are no longer used; remove data/chats and data/reports once you've checked the app.",
      );
    }
    return result;
  });
}
