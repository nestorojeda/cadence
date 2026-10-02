import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, setDbForTests } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/testing";
import { importLegacyJson } from "./import-json";
import { listChats, loadChat } from "./chat-store";
import { getBaseline, listReports, loadReport } from "./report-store";

let root: string;

async function write(rel: string, value: unknown) {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, typeof value === "string" ? value : JSON.stringify(value));
}

const chat = {
  meta: {
    id: "c1",
    title: "Renamed by hand",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-02T09:30:00.000Z",
    messageCount: 2,
    usage: { inputTokens: 0, outputTokens: 0 },
  },
  messages: [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Plan my threshold week" }] },
    {
      id: "a1",
      role: "assistant",
      parts: [{ type: "text", text: "Done", providerMetadata: { google: { thoughtSignature: "abc" } } }],
      metadata: { usage: { inputTokens: 100, outputTokens: 20 } },
    },
  ],
  summary: { text: "s", coversThroughMessageId: "u1", usage: { inputTokens: 5, outputTokens: 1 } },
};

const report = {
  meta: {
    activityId: "i10",
    eventId: 1,
    date: "2026-09-27",
    name: "Threshold",
    status: "ready",
    attempts: 1,
    metrics: { load: 80 },
    createdAt: "2026-09-27T20:00:00.000Z",
    readAt: "2026-09-28T07:00:00.000Z",
  },
  body: "## Summary\nGood.",
  workout: "- 4x 8m 100%",
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cadence-import-"));
  setDbForTests(await createTestDb());
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  await resetDb();
  await fs.rm(root, { recursive: true, force: true });
});

describe("importLegacyJson", () => {
  it("imports chats, reports and the poller baseline as they were, once", async () => {
    await write("chats/i1/c1.json", chat);
    await write("chats/i1/index.json", [chat.meta]);
    await write("chats/i1/broken.json", "{ not json");
    await write("reports/i1/i10.json", report);
    await write("reports/i1/index.json", [report.meta]);
    await write("reports/i1/state.json", { baseline: "2026-09-20T10:00:00.000Z" });

    expect(await importLegacyJson(root)).toEqual({ chats: 1, reports: 1, skipped: 1 });

    const loaded = await loadChat("i1", "c1");
    expect(loaded?.messages).toEqual(chat.messages);
    expect(loaded?.summary).toEqual(chat.summary);
    expect(loaded?.meta).toEqual({ ...chat.meta, usage: { inputTokens: 105, outputTokens: 21 } });
    expect(await loadReport("i1", "i10")).toEqual(report);
    expect(await getBaseline("i1", new Date("2026-10-01T00:00:00Z"))).toBe("2026-09-20T10:00:00.000Z");

    await write("chats/i1/c2.json", { ...chat, meta: { ...chat.meta, id: "c2" } });
    expect(await importLegacyJson(root)).toBeNull();
    expect(await listChats("i1")).toHaveLength(1);
    expect(await listReports("i1")).toHaveLength(1);
  });

  it("marks the import done when there is nothing to import", async () => {
    expect(await importLegacyJson(root)).toEqual({ chats: 0, reports: 0, skipped: 0 });
    expect(await importLegacyJson(root)).toBeNull();
  });
});
