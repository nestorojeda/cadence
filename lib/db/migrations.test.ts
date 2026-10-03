import { afterEach, describe, expect, it } from "vitest";
import type { Db } from "./client";
import { MIGRATIONS, migrate } from "./migrations";
import { createTestDb } from "./testing";

let db: Db | undefined;

afterEach(async () => {
  await db?.close();
  db = undefined;
});

describe("migrate", () => {
  it("applies each migration once", async () => {
    db = await createTestDb({ migrated: false });
    expect(await migrate(db)).toEqual(MIGRATIONS.map((m) => m.id));
    expect(await migrate(db)).toEqual([]);
    const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM schema_migrations");
    expect(rows[0].n).toBe(MIGRATIONS.length);
  });

  it("indexes only the text parts of a message for search", async () => {
    db = await createTestDb();
    await db.query("INSERT INTO chats VALUES ('i1', 'c1', '', now(), now(), NULL)");
    const data = {
      id: "m1",
      role: "assistant",
      parts: [
        { type: "text", text: "Threshold intervals tomorrow" },
        { type: "tool-icu_get_wellness", state: "output-available", output: { note: "sleepscore" } },
      ],
    };
    await db.query(
      "INSERT INTO messages (athlete_id, chat_id, id, seq, role, data) VALUES ('i1', 'c1', 'm1', 0, 'assistant', $1::jsonb)",
      [JSON.stringify(data)],
    );
    const match = (q: string) =>
      db!.query("SELECT id FROM messages WHERE search @@ to_tsquery('simple', $1)", [q]).then((r) => r.rows.length);
    expect(await match("threshold")).toBe(1);
    expect(await match("interv:*")).toBe(1);
    expect(await match("sleepscore")).toBe(0);
  });
});
