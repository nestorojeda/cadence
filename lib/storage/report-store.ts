import { ACTIVITY_ID_PATTERN, type ReportMeta, type StoredReport } from "@/lib/reports/types";
import { getDb, toIso, toJsonParam, type Queryable } from "@/lib/db/client";

// Reports live in Postgres: one row per activity. `readAt` has its own column so marking read is a single update;
// the rest of ReportMeta is kept as jsonb.

function checkAthlete(athleteId: string): string {
  if (!athleteId || /[^a-zA-Z0-9_-]/.test(athleteId)) throw new Error("Invalid athlete ID");
  return athleteId;
}

export function isValidActivityId(id: unknown): id is string {
  return typeof id === "string" && ACTIVITY_ID_PATTERN.test(id);
}

function checkActivity(activityId: string): string {
  if (!isValidActivityId(activityId)) throw new Error("Invalid activity ID");
  return activityId;
}

interface ReportRow {
  meta: Omit<ReportMeta, "readAt">;
  read_at: Date | string | null;
  body: string;
  workout: string | null;
}

function toMeta(row: Pick<ReportRow, "meta" | "read_at">): ReportMeta {
  return { ...row.meta, ...(row.read_at ? { readAt: toIso(row.read_at) } : {}) };
}

export async function listReports(athleteId: string): Promise<ReportMeta[]> {
  const db = await getDb();
  const { rows } = await db.query<ReportRow>(
    "SELECT meta, read_at FROM reports WHERE athlete_id = $1 ORDER BY date DESC, created_at DESC",
    [checkAthlete(athleteId)],
  );
  return rows.map(toMeta);
}

export async function loadReport(athleteId: string, activityId: string): Promise<StoredReport | null> {
  checkAthlete(athleteId);
  checkActivity(activityId);
  const db = await getDb();
  const { rows } = await db.query<ReportRow>(
    "SELECT meta, read_at, body, workout FROM reports WHERE athlete_id = $1 AND activity_id = $2",
    [athleteId, activityId],
  );
  const row = rows[0];
  if (!row) return null;
  return { meta: toMeta(row), body: row.body, ...(row.workout != null ? { workout: row.workout } : {}) };
}

/** Inserts or replaces the report for its activity. Also used by the JSON import. */
export async function writeReport(db: Queryable, athleteId: string, report: StoredReport): Promise<void> {
  const { readAt, ...meta } = report.meta;
  checkActivity(meta.activityId);
  await db.query(
    `INSERT INTO reports (athlete_id, activity_id, date, created_at, read_at, meta, body, workout)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     ON CONFLICT (athlete_id, activity_id) DO UPDATE SET
       date = excluded.date, created_at = excluded.created_at, read_at = excluded.read_at,
       meta = excluded.meta, body = excluded.body, workout = excluded.workout`,
    [
      athleteId,
      meta.activityId,
      meta.date,
      meta.createdAt,
      readAt ?? null,
      toJsonParam(meta),
      report.body,
      report.workout ?? null,
    ],
  );
}

export async function saveReport(athleteId: string, report: StoredReport): Promise<void> {
  await writeReport(await getDb(), checkAthlete(athleteId), report);
}

export async function markRead(athleteId: string, activityId: string): Promise<ReportMeta | null> {
  checkAthlete(athleteId);
  checkActivity(activityId);
  const db = await getDb();
  const { rows } = await db.query<ReportRow>(
    `UPDATE reports SET read_at = coalesce(read_at, $3) WHERE athlete_id = $1 AND activity_id = $2
     RETURNING meta, read_at`,
    [athleteId, activityId, new Date().toISOString()],
  );
  return rows[0] ? toMeta(rows[0]) : null;
}

export async function deleteReport(athleteId: string, activityId: string): Promise<void> {
  checkAthlete(athleteId);
  checkActivity(activityId);
  const db = await getDb();
  await db.query("DELETE FROM reports WHERE athlete_id = $1 AND activity_id = $2", [athleteId, activityId]);
}

/** Sets the baseline unless one exists. Also used by the JSON import. */
export async function writeBaseline(db: Queryable, athleteId: string, baseline: string): Promise<string> {
  await db.query("INSERT INTO report_state (athlete_id, baseline) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    athleteId,
    baseline,
  ]);
  const { rows } = await db.query<{ baseline: Date | string }>(
    "SELECT baseline FROM report_state WHERE athlete_id = $1",
    [athleteId],
  );
  return toIso(rows[0].baseline);
}

/** When automatic reports started: only activities uploaded after it are generated without asking. */
export async function getBaseline(athleteId: string, now = new Date()): Promise<string> {
  return writeBaseline(await getDb(), checkAthlete(athleteId), now.toISOString());
}
