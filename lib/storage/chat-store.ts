import fs from "fs/promises";
import path from "path";
import { isTextUIPart, type UIMessage } from "ai";
import {
  CHAT_ID_PATTERN,
  EMPTY_USAGE,
  addUsage,
  messageUsage,
  type ChatMeta,
  type StoredChat,
} from "@/lib/chat/types";

/**
 * Chat history persisted as JSON on local disk:
 *   data/chats/{athleteId}/index.json   — ChatMeta[] for the history list
 *   data/chats/{athleteId}/{chatId}.json — full StoredChat
 */

function athleteDir(athleteId: string): string {
  // Sanitize athlete ID to prevent directory traversal
  const sanitized = athleteId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized) throw new Error("Invalid athlete ID");
  return path.join(process.cwd(), "data", "chats", sanitized);
}

export function isValidChatId(chatId: unknown): chatId is string {
  return typeof chatId === "string" && CHAT_ID_PATTERN.test(chatId);
}

function chatFile(athleteId: string, chatId: string): string {
  if (!isValidChatId(chatId)) throw new Error("Invalid chat ID");
  const dir = athleteDir(athleteId);
  const file = path.resolve(dir, `${chatId}.json`);
  // Defense in depth: keep the resolved file inside the athlete's directory.
  if (!file.startsWith(`${dir}${path.sep}`)) throw new Error("Invalid chat ID");
  return file;
}

function indexFile(athleteId: string): string {
  return path.join(athleteDir(athleteId), "index.json");
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

/** Write via a temp file so a crash mid-write never leaves truncated JSON. */
async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value), "utf-8");
  await fs.rename(tmp, file);
}

// Writes for one athlete run one at a time: the chat route and the background summary both update the same files.
const locks = new Map<string, Promise<unknown>>();

function withLock<T>(athleteId: string, fn: () => Promise<T>): Promise<T> {
  const key = athleteDir(athleteId);
  const run = (locks.get(key) ?? Promise.resolve()).then(fn, fn);
  const settled = run.catch(() => {});
  locks.set(key, settled);
  settled.then(() => {
    if (locks.get(key) === settled) locks.delete(key);
  });
  return run;
}

/** Title from the first user message — no model call needed. */
function deriveTitle(messages: UIMessage[]): string {
  const text = messages
    .find((m) => m.role === "user")
    ?.parts.filter(isTextUIPart)
    .map((p) => p.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "New chat";
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
}

function computeMeta(chat: StoredChat): ChatMeta {
  const usage = chat.messages.reduce((sum, m) => addUsage(sum, messageUsage(m)), chat.summary?.usage ?? EMPTY_USAGE);
  return {
    ...chat.meta,
    title: chat.meta.title || deriveTitle(chat.messages),
    messageCount: chat.messages.length,
    usage,
  };
}

async function writeIndex(athleteId: string, update: (index: ChatMeta[]) => ChatMeta[]) {
  const index = (await readJson<ChatMeta[]>(indexFile(athleteId))) ?? [];
  const next = update(index).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  await writeJson(indexFile(athleteId), next);
}

export async function listChats(athleteId: string): Promise<ChatMeta[]> {
  return (await readJson<ChatMeta[]>(indexFile(athleteId))) ?? [];
}

export async function loadChat(athleteId: string, chatId: string): Promise<StoredChat | null> {
  return readJson<StoredChat>(chatFile(athleteId, chatId));
}

/**
 * Read-modify-write of one chat under the athlete's lock. `update` receives the stored chat (or null for a new one)
 * and returns the new state; meta (title, counts, usage) is recomputed from it.
 */
export async function updateChat(
  athleteId: string,
  chatId: string,
  update: (chat: StoredChat | null) => Omit<StoredChat, "meta"> & { meta?: Partial<ChatMeta> },
  { touch = true }: { touch?: boolean } = {}
): Promise<StoredChat> {
  return withLock(athleteId, async () => {
    const file = chatFile(athleteId, chatId);
    const current = await readJson<StoredChat>(file);
    const next = update(current);
    const now = new Date().toISOString();
    const chat: StoredChat = {
      ...next,
      meta: {
        id: chatId,
        title: "",
        createdAt: now,
        messageCount: 0,
        usage: EMPTY_USAGE,
        ...current?.meta,
        ...next.meta,
        updatedAt: touch || !current ? now : current.meta.updatedAt,
      },
    };
    chat.meta = computeMeta(chat);
    await writeJson(file, chat);
    await writeIndex(athleteId, (index) => [...index.filter((m) => m.id !== chatId), chat.meta]);
    return chat;
  });
}

export async function renameChat(athleteId: string, chatId: string, title: string): Promise<ChatMeta | null> {
  if (!(await loadChat(athleteId, chatId))) return null;
  const chat = await updateChat(athleteId, chatId, (c) => ({ ...c!, meta: { title } }), { touch: false });
  return chat.meta;
}

export async function deleteChat(athleteId: string, chatId: string): Promise<void> {
  await withLock(athleteId, async () => {
    await fs.rm(chatFile(athleteId, chatId), { force: true });
    await writeIndex(athleteId, (index) => index.filter((m) => m.id !== chatId));
  });
}
