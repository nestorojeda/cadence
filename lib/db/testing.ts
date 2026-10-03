import { PGlite } from "@electric-sql/pglite";
import type { Db, Queryable } from "./client";
import { migrate } from "./migrations";

// Tests only: Postgres compiled to WASM, in-process and in-memory, so store tests need no server or network.

function wrap(client: Pick<PGlite, "query" | "exec">): Queryable {
  return {
    query: async <T>(text: string, params?: unknown[]) => ({ rows: (await client.query<T>(text, params)).rows }),
    exec: (text) => client.exec(text),
  };
}

export async function createTestDb({ migrated = true } = {}): Promise<Db> {
  const pg = new PGlite();
  const held = new Set<string>();
  const db: Db = {
    ...wrap(pg),
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
    // One connection here, so Postgres session locks wouldn't exclude anything: track holders in memory.
    async withAdvisoryLock(key, fn) {
      if (held.has(key)) return null;
      held.add(key);
      try {
        return await fn();
      } finally {
        held.delete(key);
      }
    },
    close: () => pg.close(),
  };
  if (migrated) await migrate(db);
  return db;
}
