import type { Db } from "./client";

// Applied in order, once each. Prod and the dev container share one database, so a migration must keep working
// with the code that's already deployed: add tables and nullable (or defaulted) columns, don't rename or drop.

export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_chats_reports",
    sql: `
      CREATE TABLE chats (
        athlete_id text NOT NULL,
        id text NOT NULL,
        title text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        summary jsonb,
        PRIMARY KEY (athlete_id, id)
      );
      CREATE INDEX chats_by_updated ON chats (athlete_id, updated_at DESC);

      -- One row per UIMessage, kept whole: provider metadata (Gemini thought signatures) must round-trip.
      CREATE TABLE messages (
        athlete_id text NOT NULL,
        chat_id text NOT NULL,
        id text NOT NULL,
        seq integer NOT NULL,
        role text NOT NULL,
        input_tokens integer NOT NULL DEFAULT 0,
        output_tokens integer NOT NULL DEFAULT 0,
        data jsonb NOT NULL,
        -- Chat search covers what was said (text parts), not tool calls, results or reasoning.
        search tsvector GENERATED ALWAYS AS (
          to_tsvector('simple', jsonb_path_query_array(data, '$.parts[*] ? (@.type == "text").text'))
        ) STORED,
        PRIMARY KEY (athlete_id, chat_id, id),
        FOREIGN KEY (athlete_id, chat_id) REFERENCES chats (athlete_id, id) ON DELETE CASCADE
      );
      CREATE INDEX messages_by_seq ON messages (athlete_id, chat_id, seq);
      CREATE INDEX messages_search ON messages USING gin (search);

      CREATE TABLE reports (
        athlete_id text NOT NULL,
        activity_id text NOT NULL,
        date date NOT NULL,
        created_at timestamptz NOT NULL,
        read_at timestamptz,
        meta jsonb NOT NULL,
        body text NOT NULL,
        workout text,
        PRIMARY KEY (athlete_id, activity_id)
      );
      CREATE INDEX reports_by_date ON reports (athlete_id, date DESC, created_at DESC);

      CREATE TABLE report_state (
        athlete_id text PRIMARY KEY,
        baseline timestamptz NOT NULL
      );

      CREATE TABLE app_state (
        key text PRIMARY KEY,
        value text NOT NULL
      );
    `,
  },
  {
    // One document per athlete each: the stores read, change and write them whole under a row lock.
    id: "002_athlete_preferences_memory",
    sql: `
      CREATE TABLE athlete_preferences (
        athlete_id text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE athlete_memory (
        athlete_id text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
];

export async function migrate(db: Db, migrations = MIGRATIONS): Promise<string[]> {
  return db.transaction(async (tx) => {
    // Dev and prod containers can start together; the second waits here and then finds nothing to do.
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('cadence:migrate'))");
    await tx.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const { rows } = await tx.query<{ id: string }>("SELECT id FROM schema_migrations");
    const done = new Set(rows.map((r) => r.id));
    const applied: string[] = [];
    for (const migration of migrations) {
      if (done.has(migration.id)) continue;
      await tx.exec(migration.sql);
      await tx.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
      applied.push(migration.id);
    }
    if (applied.length) console.log(`[db] Applied migrations: ${applied.join(", ")}`);
    return applied;
  });
}
