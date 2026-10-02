import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, setDbForTests } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/testing";
import { SNIPPET_MARK_END, SNIPPET_MARK_START } from "@/lib/chat/types";
import * as store from "./chat-store";

beforeEach(async () => {
  setDbForTests(await createTestDb());
});

afterEach(async () => {
  vi.useRealTimers();
  await resetDb();
});

const user = (id: string, text: string) => ({ id, role: "user", parts: [{ type: "text", text }] }) as UIMessage;
const coach = (id: string, inputTokens: number, outputTokens: number, text = "ok") =>
  ({
    id,
    role: "assistant",
    parts: [{ type: "text", text }],
    metadata: { usage: { inputTokens, outputTokens } },
  }) as UIMessage;
const summary = { text: "s", coversThroughMessageId: "u1", usage: { inputTokens: 5, outputTokens: 1 } };

describe("chat store", () => {
  it("creates the chat with derived meta and keeps the summary across saves", async () => {
    await store.saveChatMessages("i1", "c1", [user("u1", "  How   should I train\nthis week? ")]);
    await store.setChatSummary("i1", "c1", summary);
    const chat = await store.saveChatMessages("i1", "c1", [
      user("u1", "  How   should I train\nthis week? "),
      coach("a1", 100, 20),
    ]);
    expect(chat.meta).toMatchObject({
      id: "c1",
      title: "How should I train this week?",
      messageCount: 2,
      usage: { inputTokens: 105, outputTokens: 21 },
    });
    expect(chat.summary).toEqual(summary);
    expect(await store.loadChat("i1", "c1")).toEqual(chat);
    expect(await store.listChats("i1")).toEqual([chat.meta]);
  });

  it("truncates long titles and keeps the first title", async () => {
    const chat = await store.saveChatMessages("i1", "c1", [user("u1", "word ".repeat(30))]);
    expect(chat.meta.title).toHaveLength(58);
    expect(chat.meta.title.endsWith("…")).toBe(true);
    const next = await store.saveChatMessages("i1", "c1", [user("u0", "another start"), user("u1", "x")]);
    expect(next.meta.title).toBe(chat.meta.title);
  });

  it("replaces the stored list: same IDs update, missing IDs go, order follows the array", async () => {
    await store.saveChatMessages("i1", "c1", [user("u1", "a"), coach("a1", 1, 1), user("u2", "b")]);
    await store.saveChatMessages("i1", "c1", [user("u1", "a"), user("u2", "b edited"), coach("a2", 2, 2)]);
    const chat = await store.loadChat("i1", "c1");
    expect(chat?.messages.map((m) => m.id)).toEqual(["u1", "u2", "a2"]);
    expect(chat?.messages[1]).toEqual(user("u2", "b edited"));
    expect(chat?.meta.usage).toEqual({ inputTokens: 2, outputTokens: 2 });
  });

  it("round-trips provider metadata untouched", async () => {
    const message = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "step-start" },
        {
          type: "tool-icu_get_wellness",
          toolCallId: "call_1",
          state: "output-available",
          input: { days: 7 },
          output: { rows: [{ id: "2026-10-01", hrv: 61.5, note: null }] },
          callProviderMetadata: { google: { thoughtSignature: "CiQB0e2Kb+/=" } },
        },
        { type: "text", text: "Fine", providerMetadata: { google: { thoughtSignature: "Zm9v" } } },
      ],
    } as unknown as UIMessage;
    await store.saveChatMessages("i1", "c1", [user("u1", "hi"), message]);
    expect((await store.loadChat("i1", "c1"))?.messages[1]).toEqual(message);
  });

  it("sorts by last update; rename and summary don't touch updatedAt", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
    await store.saveChatMessages("i1", "old", [user("u1", "first")]);
    vi.setSystemTime(new Date("2026-09-02T10:00:00Z"));
    await store.saveChatMessages("i1", "new", [user("u1", "second")]);
    vi.setSystemTime(new Date("2026-09-03T10:00:00Z"));
    const renamed = await store.renameChat("i1", "old", "Renamed");
    await store.setChatSummary("i1", "old", summary);
    expect(renamed).toMatchObject({ title: "Renamed", updatedAt: "2026-09-01T10:00:00.000Z" });
    expect((await store.listChats("i1")).map((m) => [m.id, m.updatedAt])).toEqual([
      ["new", "2026-09-02T10:00:00.000Z"],
      ["old", "2026-09-01T10:00:00.000Z"],
    ]);
  });

  it("returns null when renaming a missing chat", async () => {
    expect(await store.renameChat("i1", "nope", "x")).toBeNull();
  });

  it("deletes the chat with its messages", async () => {
    await store.saveChatMessages("i1", "c1", [user("u1", "hi")]);
    await store.deleteChat("i1", "c1");
    expect(await store.loadChat("i1", "c1")).toBeNull();
    expect(await store.listChats("i1")).toEqual([]);
    expect(await store.searchChats("i1", "hi")).toEqual([]);
  });

  it("keeps athletes apart and rejects unsafe IDs", async () => {
    await store.saveChatMessages("i1", "c1", [user("u1", "hi")]);
    expect(await store.listChats("i2")).toEqual([]);
    expect(await store.loadChat("i2", "c1")).toBeNull();
    expect(store.isValidChatId("../index")).toBe(false);
    await expect(store.loadChat("i1", "../../i2/c1")).rejects.toThrow("Invalid chat ID");
    await expect(store.listChats("../..")).rejects.toThrow("Invalid athlete ID");
  });
});

describe("chat search", () => {
  beforeEach(async () => {
    await store.saveChatMessages("i1", "plan", [
      user("u1", "Plan my week"),
      coach("a1", 1, 1, "Tuesday has threshold intervals: 4x8 minutes at FTP."),
    ]);
    await store.saveChatMessages("i1", "tools", [
      user("u1", "How did I sleep?"),
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "tool-icu_get_wellness", toolCallId: "t", state: "output-available", input: {}, output: "threshold" },
          { type: "text", text: "Fine." },
        ],
      } as unknown as UIMessage,
    ]);
    await store.renameChat("i1", "tools", "Sleep and threshold");
    await store.saveChatMessages("i2", "other", [user("u1", "threshold for someone else")]);
  });

  it("finds words in messages by prefix, with a marked snippet", async () => {
    const hits = await store.searchChats("i1", "thresh interv");
    expect(hits.map((h) => h.chat.id)).toEqual(["plan"]);
    expect(hits[0].snippet).toContain(`${SNIPPET_MARK_START}threshold${SNIPPET_MARK_END}`);
  });

  it("matches titles (first, without a snippet) but never tool output", async () => {
    const hits = await store.searchChats("i1", "threshold");
    expect(hits.map((h) => [h.chat.id, h.snippet === undefined])).toEqual([
      ["tools", true],
      ["plan", false],
    ]);
  });

  it("treats query syntax as plain text", async () => {
    for (const q of ['"', "& | ! : * ( )", "50%", "a_b", "'); DROP TABLE chats; --"]) {
      await expect(store.searchChats("i1", q)).resolves.toEqual([]);
    }
    expect(store.toTsQuery("Fá & tempo!")).toBe("fá:* & tempo:*");
    expect(store.toTsQuery("!!")).toBeNull();
  });

  it("follows edits", async () => {
    await store.saveChatMessages("i1", "plan", [user("u1", "Plan my week"), coach("a1", 1, 1, "Easy spins only.")]);
    expect(await store.searchChats("i1", "intervals")).toEqual([]);
    expect((await store.searchChats("i1", "spins")).map((h) => h.chat.id)).toEqual(["plan"]);
  });
});
