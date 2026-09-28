import { tool, type ToolCallPart, type UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildModelMessages, foldSummary, historyInstructions, messagesAfterSummary } from "./context";
import type { StoredChat } from "./types";

const user = (id: string, text = `question ${id}`) =>
  ({ id, role: "user", parts: [{ type: "text", text }] }) as UIMessage;
const coach = (id: string, text = `answer ${id}`) =>
  ({ id, role: "assistant", parts: [{ type: "text", text, state: "done" }] }) as UIMessage;

const conversation = (n: number) => Array.from({ length: n }, (_, i) => (i % 2 ? coach(`m${i}`) : user(`m${i}`)));

function chat(messages: UIMessage[], summary?: StoredChat["summary"]): StoredChat {
  return {
    meta: {
      id: "c1",
      title: "",
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "",
      messageCount: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
    },
    messages,
    summary,
  };
}

describe("messagesAfterSummary", () => {
  const messages = conversation(4);

  it("returns everything without a summary or with an unknown cutoff", () => {
    expect(messagesAfterSummary(messages, undefined)).toBe(messages);
    const summary = { text: "", coversThroughMessageId: "gone", usage: { inputTokens: 0, outputTokens: 0 } };
    expect(messagesAfterSummary(messages, summary)).toBe(messages);
  });

  it("returns the messages after the cutoff", () => {
    const summary = { text: "", coversThroughMessageId: "m1", usage: { inputTokens: 0, outputTokens: 0 } };
    expect(messagesAfterSummary(messages, summary).map((m) => m.id)).toEqual(["m2", "m3"]);
  });
});

describe("buildModelMessages", () => {
  const tools = {
    icu_get_wellness: tool({ description: "read", inputSchema: z.object({}), execute: async () => ({}) }),
    icu_create_calendar_event: tool({
      description: "write",
      inputSchema: z.object({ name: z.string() }),
      execute: async () => ({ id: 1 }),
    }),
  };
  const thoughtSignature = { google: { thoughtSignature: "SIG" } };
  const messages = [
    user("u1"),
    {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "step-start" },
        { type: "reasoning", text: "thinking", state: "done" },
        {
          type: "tool-icu_get_wellness",
          toolCallId: "read-1",
          state: "output-available",
          input: {},
          output: { hrv: 60 },
        },
        {
          type: "tool-icu_create_calendar_event",
          toolCallId: "write-1",
          state: "output-available",
          input: { name: "Z2" },
          output: { id: 1 },
        },
        { type: "text", text: "Scheduled", state: "done" },
      ],
    },
    user("u2"),
    {
      id: "a2",
      role: "assistant",
      parts: [
        { type: "step-start" },
        {
          type: "tool-icu_get_wellness",
          toolCallId: "read-2",
          state: "output-available",
          input: {},
          output: { hrv: 62 },
          callProviderMetadata: thoughtSignature,
        },
      ],
    },
  ] as UIMessage[];

  it("prunes reasoning and read-tool calls from earlier turns but keeps write tools", async () => {
    const result = await buildModelMessages(messages, tools);
    const earlier = JSON.stringify(
      result.slice(
        0,
        result.findLastIndex((m) => m.role === "user"),
      ),
    );
    expect(earlier).not.toContain("read-1");
    expect(earlier).not.toContain("thinking");
    expect(earlier).toContain("write-1");
    expect(earlier).toContain("Scheduled");
  });

  it("keeps the current turn intact, including Gemini thought signatures", async () => {
    const result = await buildModelMessages(messages, tools);
    const call = result
      .flatMap((m) => (m.role === "assistant" && Array.isArray(m.content) ? m.content : []))
      .find((part): part is ToolCallPart => part.type === "tool-call" && part.toolCallId === "read-2");
    expect(call?.providerOptions).toEqual(thoughtSignature);
    expect(JSON.stringify(result)).toContain('"hrv":62');
  });

  it("leaves a single-turn conversation alone", async () => {
    const result = await buildModelMessages([user("u1")], tools);
    expect(result).toEqual([{ role: "user", content: [{ type: "text", text: "question u1" }] }]);
  });
});

describe("historyInstructions", () => {
  it("is empty for a new chat", () => {
    expect(historyInstructions(null)).toBe("");
    expect(historyInstructions(chat([]))).toBe("");
  });

  it("includes the start date and the summary", () => {
    const text = historyInstructions(
      chat(conversation(2), {
        text: "- Goal: gran fondo",
        coversThroughMessageId: "m0",
        usage: { inputTokens: 0, outputTokens: 0 },
      }),
    );
    expect(text).toContain("started on 2026-09-20");
    expect(text).toContain("- Goal: gran fondo");
  });
});

describe("foldSummary", () => {
  function mockModel() {
    const prompts: string[] = [];
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        prompts.push(JSON.stringify(options.prompt));
        return {
          content: [{ type: "text", text: "  - new summary  " }],
          finishReason: { unified: "stop", raw: undefined },
          usage: {
            inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
          warnings: [],
        };
      },
    });
    return { model, prompts };
  }

  it("does nothing while the tail is short", async () => {
    const { model, prompts } = mockModel();
    expect(await foldSummary(model, chat(conversation(12)))).toBeNull();
    expect(prompts).toHaveLength(0);
  });

  it("folds older turns so the kept tail starts at a user message", async () => {
    const { model } = mockModel();
    // 15 messages: the last 6 start at m9 (assistant), so the cut moves back to m8.
    const summary = await foldSummary(model, chat(conversation(15)));
    expect(summary).toEqual({
      text: "- new summary",
      coversThroughMessageId: "m7",
      usage: { inputTokens: 100, outputTokens: 20 },
    });
  });

  it("merges with the previous summary and accumulates its usage", async () => {
    const { model, prompts } = mockModel();
    const previous = {
      text: "- old summary",
      coversThroughMessageId: "m1",
      usage: { inputTokens: 50, outputTokens: 5 },
    };
    const summary = await foldSummary(model, chat(conversation(16), previous));
    // 14 messages after m1; the cut lands at m10, so m2–m9 are folded.
    expect(summary?.coversThroughMessageId).toBe("m9");
    expect(summary?.usage).toEqual({ inputTokens: 150, outputTokens: 25 });
    expect(prompts[0]).toContain("- old summary");
    expect(prompts[0]).toContain("question m2");
    expect(prompts[0]).not.toContain("question m0");
    expect(prompts[0]).not.toContain("question m10");
  });

  it("labels each kind of calendar write in the transcript", async () => {
    const { model, prompts } = mockModel();
    const write = (toolName: string, input: object) =>
      ({
        type: `tool-${toolName}`,
        toolCallId: toolName,
        state: "output-available",
        input,
        output: {},
      }) as UIMessage["parts"][number];
    const messages = conversation(15);
    messages[1] = {
      ...messages[1],
      parts: [
        ...messages[1].parts,
        write("icu_create_calendar_event", { name: "VO2" }),
        write("icu_update_calendar_event", { event_id: "7", name: "Endurance" }),
        write("icu_delete_calendar_event", { event_id: "8" }),
      ],
    };
    await foldSummary(model, chat(messages));
    // The prompt is JSON, so the transcript's quotes are escaped.
    expect(prompts[0]).toContain('[Scheduled on calendar: {\\"name\\":\\"VO2\\"}]');
    expect(prompts[0]).toContain("[Changed on calendar:");
    expect(prompts[0]).toContain("[Removed from calendar:");
  });
});
