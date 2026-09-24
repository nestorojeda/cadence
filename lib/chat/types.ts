/**
 * Chat history types shared by the server (storage, chat route) and the client (history list, usage display).
 */
import type { UIMessage } from "ai";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Index entry for one chat — everything the history list needs, without the transcript. */
export interface ChatMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  /** Model tokens spent on this chat, including summary calls. */
  usage: TokenUsage;
}

/** Rolling summary of the turns that are no longer sent to the model verbatim. */
export interface ChatSummary {
  text: string;
  /** Last message folded into `text`; only messages after it are sent to the model. */
  coversThroughMessageId: string;
  /** Tokens spent producing summaries for this chat. */
  usage: TokenUsage;
}

export interface StoredChat {
  meta: ChatMeta;
  /** Full UI messages, untouched (provider metadata and tool outputs included). */
  messages: UIMessage[];
  summary?: ChatSummary;
}

/** Metadata the chat route attaches to each assistant message. */
export interface CoachMessageMetadata {
  usage?: TokenUsage;
}

export const EMPTY_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0 };

export function messageUsage(message: UIMessage): TokenUsage | undefined {
  return (message.metadata as CoachMessageMetadata | undefined)?.usage;
}

export function addUsage(a: TokenUsage, b: TokenUsage | undefined): TokenUsage {
  return b ? { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens } : a;
}

/** Total tokens of a set of messages, e.g. "12.4k". */
export function formatTokens(usage: TokenUsage): string {
  const total = usage.inputTokens + usage.outputTokens;
  if (total < 1000) return String(total);
  return `${(total / 1000).toFixed(total < 10_000 ? 1 : 0)}k`;
}

/** Short relative date for the history list: "today", "yesterday", "Tue", or "12 Sep". */
export function formatChatDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return date.toLocaleDateString("en-GB", { weekday: "short" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const CHAT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
