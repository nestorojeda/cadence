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
import { DELETE_EVENT_TOOL, PROPOSE_RULES_TOOL, UPDATE_EVENT_TOOL, WRITE_TOOL_NAMES } from "@/lib/intervals/tool-names";
import type { ChatSummary, StoredChat, TokenUsage } from "./types";

const SUMMARY_TRIGGER = 12;
const KEEP_VERBATIM = 6;
const SUMMARY_INPUT_CHARS = 2000;

export function messagesAfterSummary(messages: UIMessage[], summary: ChatSummary | undefined): UIMessage[] {
  if (!summary) return messages;
  const idx = messages.findIndex((m) => m.id === summary.coversThroughMessageId);
  return idx === -1 ? messages : messages.slice(idx + 1);
}

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
    toolCalls: [{ type: "all", tools: readTools }],
    emptyMessages: "remove",
  });
  return [...earlier, ...modelMessages.slice(turnStart)];
}

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

function writeLabel(toolName: string): string {
  if (toolName === UPDATE_EVENT_TOOL) return "Changed on calendar";
  if (toolName === DELETE_EVENT_TOOL) return "Removed from calendar";
  if (toolName === PROPOSE_RULES_TOOL) return "Changed coach rules";
  return "Scheduled on calendar";
}

function transcript(messages: UIMessage[]): string {
  return messages
    .map((m) => {
      const parts: string[] = [];
      for (const part of m.parts) {
        if (isTextUIPart(part) && part.text.trim()) parts.push(part.text.trim());
        if (isToolUIPart(part) && WRITE_TOOL_NAMES.includes(getToolName(part)) && part.state === "output-available") {
          parts.push(`[${writeLabel(getToolName(part))}: ${JSON.stringify(part.input).slice(0, 300)}]`);
        }
      }
      const text = parts.join("\n").slice(0, SUMMARY_INPUT_CHARS);
      return text ? `${m.role === "user" ? "Athlete" : "Coach"}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

/** The kept tail starts at a user message: some providers reject a conversation opening with an assistant turn. */
function summaryRange(chat: StoredChat): { start: number; cut: number } | null {
  const start = chat.messages.length - messagesAfterSummary(chat.messages, chat.summary).length;
  if (chat.messages.length - start <= SUMMARY_TRIGGER) return null;
  let cut = chat.messages.length - KEEP_VERBATIM;
  while (cut > start && chat.messages[cut].role !== "user") cut--;
  return cut > start ? { start, cut } : null;
}

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
