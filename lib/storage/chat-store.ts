import { isTextUIPart, type UIMessage } from "ai";
import {
  CHAT_ID_PATTERN,
  SNIPPET_MARK_END,
  SNIPPET_MARK_START,
  type ChatMeta,
  type ChatSearchHit,
  type ChatSummary,
  type StoredChat,
} from "@/lib/chat/types";
import { getDb, toIso, toJsonParam, type Queryable } from "@/lib/db/client";

// Chats live in Postgres: one `chats` row and one `messages` row per UIMessage (kept whole as jsonb).
// Each write is one transaction, so the list, the counts and the messages never disagree.

function checkAthlete(athleteId: string): string {
  if (!athleteId || /[^a-zA-Z0-9_-]/.test(athleteId)) throw new Error("Invalid athlete ID");
  return athleteId;
}

export function isValidChatId(chatId: unknown): chatId is string {
  return typeof chatId === "string" && CHAT_ID_PATTERN.test(chatId);
}

function checkChat(chatId: string): string {
  if (!isValidChatId(chatId)) throw new Error("Invalid chat ID");
  return chatId;
}

export function deriveTitle(messages: UIMessage[]): string {
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

interface MetaRow {
  id: string;
  title: string;
  created_at: Date | string;
  updated_at: Date | string;
  summary: ChatSummary | null;
  message_count: number;
  input_tokens: number;
  output_tokens: number;
}

// Counts and usage come from the messages; the summary's own usage (the model calls that folded it) is added on.
const META_SELECT = `
  SELECT c.id, c.title, c.created_at, c.updated_at, c.summary,
    coalesce(m.n, 0)::int AS message_count,
    (coalesce(m.input, 0) + coalesce((c.summary->'usage'->>'inputTokens')::int, 0))::int AS input_tokens,
    (coalesce(m.output, 0) + coalesce((c.summary->'usage'->>'outputTokens')::int, 0))::int AS output_tokens
  FROM chats c
  LEFT JOIN LATERAL (
    SELECT count(*) AS n, sum(input_tokens) AS input, sum(output_tokens) AS output
    FROM messages WHERE athlete_id = c.athlete_id AND chat_id = c.id
  ) m ON true`;

function toMeta(row: MetaRow): ChatMeta {
  return {
    id: row.id,
    title: row.title,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    messageCount: row.message_count,
    usage: { inputTokens: row.input_tokens, outputTokens: row.output_tokens },
  };
}

async function metaRow(db: Queryable, athleteId: string, chatId: string): Promise<MetaRow | null> {
  const { rows } = await db.query<MetaRow>(`${META_SELECT} WHERE c.athlete_id = $1 AND c.id = $2`, [athleteId, chatId]);
  return rows[0] ?? null;
}

export async function listChats(athleteId: string): Promise<ChatMeta[]> {
  const db = await getDb();
  const { rows } = await db.query<MetaRow>(`${META_SELECT} WHERE c.athlete_id = $1 ORDER BY c.updated_at DESC`, [
    checkAthlete(athleteId),
  ]);
  return rows.map(toMeta);
}

export async function loadChat(athleteId: string, chatId: string): Promise<StoredChat | null> {
  checkAthlete(athleteId);
  checkChat(chatId);
  const db = await getDb();
  const row = await metaRow(db, athleteId, chatId);
  if (!row) return null;
  const { rows } = await db.query<{ data: UIMessage }>(
    "SELECT data FROM messages WHERE athlete_id = $1 AND chat_id = $2 ORDER BY seq",
    [athleteId, chatId],
  );
  return { meta: toMeta(row), messages: rows.map((r) => r.data), ...(row.summary ? { summary: row.summary } : {}) };
}

/**
 * Upserts the given messages in order; unchanged rows aren't rewritten. Messages are matched by ID, so the same ID
 * replaces its row (approval answers, retries). `UIMessage.metadata.usage` feeds the token columns.
 */
export async function writeMessages(tx: Queryable, athleteId: string, chatId: string, messages: UIMessage[]) {
  await tx.query(
    `INSERT INTO messages (athlete_id, chat_id, id, seq, role, input_tokens, output_tokens, data)
     SELECT $1, $2, m->>'id', (o - 1)::int, m->>'role',
       coalesce((m->'metadata'->'usage'->>'inputTokens')::int, 0),
       coalesce((m->'metadata'->'usage'->>'outputTokens')::int, 0),
       m
     FROM jsonb_array_elements($3::jsonb) WITH ORDINALITY AS t(m, o)
     ON CONFLICT (athlete_id, chat_id, id) DO UPDATE SET
       seq = excluded.seq, role = excluded.role, data = excluded.data,
       input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens
     WHERE messages.data IS DISTINCT FROM excluded.data OR messages.seq <> excluded.seq`,
    [athleteId, chatId, toJsonParam(messages)],
  );
}

/** Saves the chat's full message list (rows not in it are removed) and bumps `updatedAt`. Keeps the summary. */
export async function saveChatMessages(athleteId: string, chatId: string, messages: UIMessage[]): Promise<StoredChat> {
  checkAthlete(athleteId);
  checkChat(chatId);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date().toISOString();
    // The upsert row-locks the chat, so concurrent saves of one chat run one after the other.
    await tx.query(
      `INSERT INTO chats (athlete_id, id, title, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (athlete_id, id) DO UPDATE SET
         updated_at = excluded.updated_at,
         title = CASE WHEN chats.title = '' THEN excluded.title ELSE chats.title END`,
      [athleteId, chatId, deriveTitle(messages), now],
    );
    await writeMessages(tx, athleteId, chatId, messages);
    await tx.query("DELETE FROM messages WHERE athlete_id = $1 AND chat_id = $2 AND NOT (id = ANY($3::text[]))", [
      athleteId,
      chatId,
      messages.map((m) => m.id),
    ]);
    const row = (await metaRow(tx, athleteId, chatId))!;
    return { meta: toMeta(row), messages, ...(row.summary ? { summary: row.summary } : {}) };
  });
}

/** Replaces the rolling summary without bumping `updatedAt`. */
export async function setChatSummary(athleteId: string, chatId: string, summary: ChatSummary): Promise<void> {
  checkAthlete(athleteId);
  checkChat(chatId);
  const db = await getDb();
  await db.query("UPDATE chats SET summary = $3::jsonb WHERE athlete_id = $1 AND id = $2", [
    athleteId,
    chatId,
    toJsonParam(summary),
  ]);
}

export async function renameChat(athleteId: string, chatId: string, title: string): Promise<ChatMeta | null> {
  checkAthlete(athleteId);
  checkChat(chatId);
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.query("UPDATE chats SET title = $3 WHERE athlete_id = $1 AND id = $2", [athleteId, chatId, title]);
    const row = await metaRow(tx, athleteId, chatId);
    return row ? toMeta(row) : null;
  });
}

export async function deleteChat(athleteId: string, chatId: string): Promise<void> {
  checkAthlete(athleteId);
  checkChat(chatId);
  const db = await getDb();
  await db.query("DELETE FROM chats WHERE athlete_id = $1 AND id = $2", [athleteId, chatId]);
}

/** Prefix match on every word, so partial typing finds results. Only letters and digits reach `to_tsquery`. */
export function toTsQuery(query: string): string | null {
  const words =
    query
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.slice(0, 8) ?? [];
  return words.length ? words.map((w) => `${w}:*`).join(" & ") : null;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const HEADLINE_OPTIONS = `StartSel=${SNIPPET_MARK_START}, StopSel=${SNIPPET_MARK_END}, MaxWords=24, MinWords=10, ShortWord=2, MaxFragments=1, FragmentDelimiter=" … "`;

/**
 * Chats whose messages or title match `query`: title matches first, then by best message rank. Message hits carry a
 * snippet of the best message.
 */
export async function searchChats(athleteId: string, query: string, limit = 20): Promise<ChatSearchHit[]> {
  checkAthlete(athleteId);
  const text = query.trim();
  if (!text) return [];
  const db = await getDb();
  const { rows } = await db.query<MetaRow & { title_match: boolean; snippet: string | null }>(
    `WITH q AS (SELECT to_tsquery('simple', $2) AS query),
     best AS (
       SELECT DISTINCT ON (m.chat_id) m.chat_id, m.data, ts_rank(m.search, q.query) AS rank
       FROM messages m, q
       WHERE m.athlete_id = $1 AND m.search @@ q.query
       ORDER BY m.chat_id, rank DESC, m.seq DESC
     ),
     hits AS (
       SELECT c.id, (c.title ILIKE $3) AS title_match, b.rank,
         -- Snippets are plain text: markdown marks and table rules are dropped, whitespace collapsed.
         CASE WHEN b.data IS NULL THEN NULL ELSE ts_headline('simple',
           regexp_replace(regexp_replace(
             (SELECT string_agg(t, ' ') FROM jsonb_array_elements_text(
               jsonb_path_query_array(b.data, '$.parts[*] ? (@.type == "text").text')) AS t),
             '[*#|\`>~]+|:?-{3,}:?', ' ', 'g'), '\\s+', ' ', 'g'),
           (SELECT query FROM q), $4) END AS snippet
       FROM chats c LEFT JOIN best b ON b.chat_id = c.id
       WHERE c.athlete_id = $1 AND (b.chat_id IS NOT NULL OR c.title ILIKE $3)
     )
     SELECT meta.*, h.title_match, h.snippet
     FROM hits h JOIN (${META_SELECT} WHERE c.athlete_id = $1) meta ON meta.id = h.id
     ORDER BY h.title_match DESC, h.rank DESC NULLS LAST, meta.updated_at DESC
     LIMIT $5`,
    [athleteId, toTsQuery(text), `%${escapeLike(text)}%`, HEADLINE_OPTIONS, limit],
  );
  return rows.map((row) => ({ chat: toMeta(row), ...(row.snippet ? { snippet: row.snippet } : {}) }));
}
