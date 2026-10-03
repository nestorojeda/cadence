import type { UIMessage } from "ai";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  usage: TokenUsage;
}

export interface ChatSummary {
  text: string;
  /** Last message folded into `text`; only messages after it are sent to the model. */
  coversThroughMessageId: string;
  usage: TokenUsage;
}

export interface StoredChat {
  meta: ChatMeta;
  /** Untouched: provider metadata must round-trip. */
  messages: UIMessage[];
  summary?: ChatSummary;
}

export interface ChatSearchHit {
  chat: ChatMeta;
  /** Best-matching message text, matches wrapped in SNIPPET_MARK_START / SNIPPET_MARK_END. None for title-only hits. */
  snippet?: string;
}

export const SNIPPET_MARK_START = "\u0002";
export const SNIPPET_MARK_END = "\u0003";

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

export function formatTokens(usage: TokenUsage): string {
  const total = usage.inputTokens + usage.outputTokens;
  if (total < 1000) return String(total);
  return `${(total / 1000).toFixed(total < 10_000 ? 1 : 0)}k`;
}

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
