import { invalidPreferences, mergePreferences, type PreferencesUpdate } from "@/lib/coach/rules";
import { getDb, toJsonParam, type Queryable } from "@/lib/db/client";
import { CoachPreferences, createDefaultPreferences } from "../types/preferences";

// Coach rules live in Postgres, one jsonb document per athlete (`athlete_preferences`). No in-process cache: prod
// and the dev container share the database, so every read sees the other's changes.

function cleanAthleteId(athleteId: string): string {
  const id = athleteId.trim();
  if (!id || /[^a-zA-Z0-9_-]/.test(id)) throw new Error("Invalid athlete ID");
  return id;
}

/**
 * Older documents: `sundayRoutine` was removed (redundant with the day lists) and free-text terrain notes were replaced
 * by `terrain`. Drop them and fill new fields with defaults, so the next save writes the current shape.
 */
export function normalizePreferences(stored: unknown, athleteId: string): CoachPreferences {
  const {
    sundayRoutine: _removed,
    mountainTerrainNotes: _removedNotes,
    terrainNotes: _removedDetails,
    ...rest
  } = (stored ?? {}) as Partial<CoachPreferences> & {
    sundayRoutine?: unknown;
    mountainTerrainNotes?: unknown;
    terrainNotes?: unknown;
  };
  const defaults = createDefaultPreferences(athleteId);
  return {
    ...defaults,
    ...rest,
    // Nested, so merged on its own: documents written before gym preferences existed have none.
    gym: { ...defaults.gym, ...rest.gym },
  };
}

/** Inserts the document unless the athlete already has one. Also used by the JSON import. */
export async function insertPreferences(db: Queryable, preferences: CoachPreferences): Promise<boolean> {
  const { rows } = await db.query(
    `INSERT INTO athlete_preferences (athlete_id, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (athlete_id) DO NOTHING RETURNING athlete_id`,
    [preferences.athleteId, toJsonParam(preferences)],
  );
  return rows.length > 0;
}

export async function getPreferences(athleteId: string): Promise<CoachPreferences> {
  const id = cleanAthleteId(athleteId);
  const db = await getDb();
  const { rows } = await db.query<{ data: unknown }>("SELECT data FROM athlete_preferences WHERE athlete_id = $1", [
    id,
  ]);
  if (rows[0]) return normalizePreferences(rows[0].data, id);
  const defaults = createDefaultPreferences(id);
  await insertPreferences(db, defaults).catch((err) =>
    console.warn("[PreferencesStore] Could not save default preferences:", err),
  );
  return defaults;
}

/** Merges `update` into the saved preferences. A failed write throws: the change must not look saved when it isn't. */
export async function updatePreferences(
  athleteId: string,
  update: Omit<PreferencesUpdate, "athleteId">,
): Promise<{ before: CoachPreferences; after: CoachPreferences } | { error: string }> {
  const id = cleanAthleteId(athleteId);
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Locks the athlete's row, so concurrent updates (from any process) apply one after the other.
    await insertPreferences(tx, createDefaultPreferences(id));
    const { rows } = await tx.query<{ data: unknown }>(
      "SELECT data FROM athlete_preferences WHERE athlete_id = $1 FOR UPDATE",
      [id],
    );
    const before = normalizePreferences(rows[0].data, id);
    const merged = mergePreferences(before, update);
    const error = invalidPreferences(merged);
    if (error) return { error };
    const after = { ...merged, athleteId: id, updatedAt: new Date().toISOString() };
    await tx.query("UPDATE athlete_preferences SET data = $2::jsonb, updated_at = now() WHERE athlete_id = $1", [
      id,
      toJsonParam(after),
    ]);
    return { before, after };
  });
}
