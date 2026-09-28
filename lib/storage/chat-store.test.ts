import fs from "fs/promises";
import os from "os";
import path from "path";
import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The store resolves data/ from process.cwd(); point it at a temp dir and reload the module to reset its locks.
let root: string;
let store: typeof import("./chat-store");

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cadence-chats-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.resetModules();
  store = await import("./chat-store");
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

const user = (id: string, text: string) => ({ id, role: "user", parts: [{ type: "text", text }] }) as UIMessage;
const coach = (id: string, inputTokens: number, outputTokens: number) =>
  ({
    id,
    role: "assistant",
    parts: [{ type: "text", text: "ok" }],
    metadata: { usage: { inputTokens, outputTokens } },
  }) as UIMessage;

describe("chat store", () => {
  it("creates the chat file and index with derived meta", async () => {
    const chat = await store.updateChat("i1", "c1", () => ({
      messages: [user("u1", "  How   should I train\nthis week? "), coach("a1", 100, 20)],
      summary: { text: "s", coversThroughMessageId: "u0", usage: { inputTokens: 5, outputTokens: 1 } },
    }));
    expect(chat.meta).toMatchObject({
      id: "c1",
      title: "How should I train this week?",
      messageCount: 2,
      usage: { inputTokens: 105, outputTokens: 21 },
    });
    expect(await store.loadChat("i1", "c1")).toEqual(chat);
    expect(await store.listChats("i1")).toEqual([chat.meta]);
    await expect(fs.stat(path.join(root, "data", "chats", "i1", "c1.json"))).resolves.toBeTruthy();
  });

  it("truncates long titles", async () => {
    const chat = await store.updateChat("i1", "c1", () => ({ messages: [user("u1", "word ".repeat(30))] }));
    expect(chat.meta.title).toHaveLength(58);
    expect(chat.meta.title.endsWith("…")).toBe(true);
  });

  it("serializes concurrent writes to the same chat", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.updateChat("i1", "c1", (current) => ({
          messages: [...(current?.messages ?? []), user(`u${i}`, `m${i}`)],
        })),
      ),
    );
    const chat = await store.loadChat("i1", "c1");
    expect(chat?.messages.map((m) => m.id)).toEqual(Array.from({ length: 10 }, (_, i) => `u${i}`));
  });

  it("sorts the index by last update and renames without touching updatedAt", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
      await store.updateChat("i1", "old", () => ({ messages: [user("u1", "first")] }));
      vi.setSystemTime(new Date("2026-09-02T10:00:00Z"));
      await store.updateChat("i1", "new", () => ({ messages: [user("u1", "second")] }));
      vi.setSystemTime(new Date("2026-09-03T10:00:00Z"));
      const renamed = await store.renameChat("i1", "old", "Renamed");
      expect(renamed).toMatchObject({ title: "Renamed", updatedAt: "2026-09-01T10:00:00.000Z" });
      expect((await store.listChats("i1")).map((m) => m.id)).toEqual(["new", "old"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns null when renaming a missing chat", async () => {
    expect(await store.renameChat("i1", "nope", "x")).toBeNull();
  });

  it("deletes the chat and its index entry", async () => {
    await store.updateChat("i1", "c1", () => ({ messages: [user("u1", "hi")] }));
    await store.deleteChat("i1", "c1");
    expect(await store.loadChat("i1", "c1")).toBeNull();
    expect(await store.listChats("i1")).toEqual([]);
  });

  it("keeps athletes apart and rejects unsafe IDs", async () => {
    await store.updateChat("i1", "c1", () => ({ messages: [user("u1", "hi")] }));
    expect(await store.listChats("i2")).toEqual([]);
    expect(store.isValidChatId("../index")).toBe(false);
    await expect(store.loadChat("i1", "../../i2/c1")).rejects.toThrow("Invalid chat ID");
    await expect(store.listChats("../..")).rejects.toThrow("Invalid athlete ID");
  });
});
