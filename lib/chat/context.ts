import {
  convertToModelMessages,
  generateText,
  getToolName,
  isTextUIPart,
  isToolUIPart,
  pruneMessages,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from "ai";
import { WRITE_TOOL_NAMES } from "@/lib/intervals/tool-names";
import type { ChatSummary, StoredChat, TokenUsage } from "./types";

/**
 * Token economy for chat history. The full transcript is kept on disk, but the model only sees:
 *  - a rolling summary of older turns (folded in the background once the tail grows past SUMMARY_TRIGGER), and
 *  - the messages after it, with read-tool payloads and reasoning from earlier turns pruned.
 */

/** Messages after the summary cutoff before older ones are folded into the summary. */
const SUMMARY_TRIGGER = 12;
/** Most recent messages that always stay verbatim. */
const KEEP_VERBATIM = 6;
/** Per-message cap on text fed to the summarizer, to bound its cost. */
const SUMMARY_INPUT_CHARS = 2000;

/** Messages the model still needs verbatim: everything after the summary cutoff. */
export function messagesAfterSummary(messages: UIMessage[], summary: ChatSummary | undefined): UIMessage[] {
  if (!summary) return messages;
  const idx = messages.findIndex((m) => m.id === summary.coversThroughMessageId);
  return idx === -1 ? messages : messages.slice(idx + 1);
}

/** Converts UI messages to model messages and drops what earlier turns no longer need. */
export async function buildModelMessages(messages: UIMessage[], tools: ToolSet): Promise<ModelMessage[]> {
  const readTools = Object.keys(tools).filter((name) => !WRITE_TOOL_NAMES.includes(name));
  // convertToModelMessages keeps each part's provider metadata (e.g. Gemini's thoughtSignature on function calls),
  // which thinking models require on the current turn. Pruning only touches earlier turns.
  const modelMessages = await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true });
  // The current turn starts at the last user message. When a turn resumes after tool approvals it already holds
  // assistant steps and tool results the model still needs, so only earlier turns are pruned.
  const turnStart = modelMessages.findLastIndex((m) => m.role === "user");
  if (turnStart <= 0) return modelMessages;
  const earlier = pruneMessages({
    messages: modelMessages.slice(0, turnStart),
    reasoning: "all",
    // Old Intervals payloads are the biggest cost; the coach re-fetches live data when it needs it.
    toolCalls: [{ type: "all", tools: readTools }],
    emptyMessages: "remove",
  });
  return [...earlier, ...modelMessages.slice(turnStart)];
}

/** Extra instructions for a stored chat: the summary of folded turns and a staleness note. */
export function historyInstructions(chat: StoredChat | null): string {
  if (!chat || chat.messages.length === 0) return "";
  const started = chat.meta.createdAt.slice(0, 10);
  const lines = [
    "",
    "---",
    "",
    "### Conversation history",
    `This conversation started on ${started}. Data returned by tools in earlier turns may be stale and ` +
      "is not repeated here — call the tools again for any current numbers.",
  ];
  if (chat.summary) {
    lines.push("", "Summary of the earlier part of this conversation:", chat.summary.text);
  }
  return lines.join("\n");
}

/** Plain-text transcript for the summarizer: athlete/coach text plus what the coach wrote to the calendar. */
function transcript(messages: UIMessage[]): string {
  return messages
    .map((m) => {
      const parts: string[] = [];
      for (const part of m.parts) {
        if (isTextUIPart(part) && part.text.trim()) parts.push(part.text.trim());
        if (isToolUIPart(part) && WRITE_TOOL_NAMES.includes(getToolName(part)) && part.state === "output-available") {
          parts.push(`[Scheduled on calendar: ${JSON.stringify(part.input).slice(0, 300)}]`);
        }
      }
      const text = parts.join("\n").slice(0, SUMMARY_INPUT_CHARS);
      return text ? `${m.role === "user" ? "Athlete" : "Coach"}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Where to cut for a new summary, or null when the tail is still short. The kept tail always starts at a user
 * message, since some providers reject a conversation that opens with an assistant turn.
 */
function summaryRange(chat: StoredChat): { start: number; cut: number } | null {
  const start = chat.messages.length - messagesAfterSummary(chat.messages, chat.summary).length;
  if (chat.messages.length - start <= SUMMARY_TRIGGER) return null;
  let cut = chat.messages.length - KEEP_VERBATIM;
  while (cut > start && chat.messages[cut].role !== "user") cut--;
  return cut > start ? { start, cut } : null;
}

/**
 * Folds the older part of the tail into the rolling summary, using the same model as the chat. Returns null when
 * nothing needs folding.
 */
export async function foldSummary(model: LanguageModel, chat: StoredChat): Promise<ChatSummary | null> {
  const range = summaryRange(chat);
  if (!range) return null;
  const { start, cut } = range;
  const coversThroughMessageId = chat.messages[cut - 1].id;
  if (!coversThroughMessageId) return null;
  const toFold = chat.messages.slice(start, cut);

  const result = await generateText({
    model,
    instructions:
      "You maintain a running summary of a conversation between an endurance athlete and their cycling coach. " +
      "Merge the previous summary and the new turns into one updated summary of at most 200 words, as terse bullet points. " +
      "Keep: goals and events, constraints, injuries or health notes, preferences, decisions and advice given, " +
      "workouts scheduled (with dates), and open questions. Drop greetings and raw metrics that can be re-fetched " +
      "(CTL/ATL/TSB values, activity numbers). Output only the summary.",
    prompt: `Previous summary:\n${chat.summary?.text || "(none)"}\n\nNew turns:\n${transcript(toFold)}`,
  });

  const usage: TokenUsage = {
    inputTokens: (chat.summary?.usage.inputTokens ?? 0) + (result.usage.inputTokens ?? 0),
    outputTokens: (chat.summary?.usage.outputTokens ?? 0) + (result.usage.outputTokens ?? 0),
  };
  return { text: result.text.trim(), coversThroughMessageId, usage };
}
