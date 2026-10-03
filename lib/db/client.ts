import { Pool, type PoolClient } from "pg";
import { migrate } from "./migrations";

// Postgres access for the chat and report stores. Production uses `pg` against DATABASE_URL (the compose `db`
// service); tests swap in PGlite through `setDbForTests`. Both satisfy this small interface.

export interface Queryable {
  /** One statement, parameters as $1, $2…. Pass JSON values already stringified and cast them (`$1::jsonb`). */
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Several statements, no parameters (migrations). */
  exec(text: string): Promise<unknown>;
}

export interface Db extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  /** Runs `fn` while holding a lock shared by every process on this database; `null` when another holder has it. */
  withAdvisoryLock<T>(key: string, fn: () => Promise<T>): Promise<T | null>;
  close(): Promise<void>;
}

function wrapClient(client: Pool | PoolClient): Queryable {
  return {
    query: async <T>(text: string, params?: unknown[]) => ({ rows: (await client.query(text, params)).rows as T[] }),
    exec: (text) => client.query(text),
  };
}

function createPgDb(connectionString: string): Db {
  const pool = new Pool({ connectionString, max: 10 });
  pool.on("error", (error) => console.error("[db] Idle client error:", error.message));
  return {
    ...wrapClient(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(wrapClient(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async withAdvisoryLock(key, fn) {
      // Session-level lock: it must be taken and released on the same connection.
      const client = await pool.connect();
      try {
        const { rows } = await client.query<{ locked: boolean }>(
          "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
          [key],
        );
        if (!rows[0]?.locked) return null;
        try {
          return await fn();
        } finally {
          await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key]);
        }
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

// On globalThis so dev-server reloads reuse the pool instead of opening a new one per edit.
const state = globalThis as typeof globalThis & { __cadenceDb?: Promise<Db> };

/** The migrated database. Throws when DATABASE_URL is missing or the server can't be reached. */
export function getDb(): Promise<Db> {
  if (!state.__cadenceDb) {
    const url = process.env.DATABASE_URL;
    if (!url)
      return Promise.reject(new Error("DATABASE_URL is not set: chats and reports need the Postgres database."));
    const db = createPgDb(url);
    state.__cadenceDb = migrate(db).then(
      () => db,
      async (error: unknown) => {
        state.__cadenceDb = undefined;
        await db.close().catch(() => {});
        throw error;
      },
    );
  }
  return state.__cadenceDb;
}

/** Tests: use this database (already migrated) until `resetDb`. */
export function setDbForTests(db: Db): void {
  state.__cadenceDb = Promise.resolve(db);
}

export async function resetDb(): Promise<void> {
  const current = state.__cadenceDb;
  state.__cadenceDb = undefined;
  await (await current?.catch(() => undefined))?.close();
}

/** JSON for a jsonb parameter. jsonb rejects the NUL character, so it's dropped from strings. */
export function toJsonParam(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (typeof v === "string" ? v.replaceAll("\u0000", "") : v));
}

/** Postgres timestamps come back as Date (pg) or string; the app's types use ISO strings. */
export function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
