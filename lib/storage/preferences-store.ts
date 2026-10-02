import fs from "fs/promises";
import path from "path";
import { invalidPreferences, mergePreferences, type PreferencesUpdate } from "@/lib/coach/rules";
import { CoachPreferences, createDefaultPreferences } from "../types/preferences";
import { writeJsonAtomic } from "./json-file";
import { withLock } from "./lock";

const memoryCache = new Map<string, CoachPreferences>();

function getDataDirectory(): string {
  return path.join(process.cwd(), "data", "athletes");
}

function getFilePath(athleteId: string): string {
  // Sanitize athlete ID to prevent directory traversal
  const sanitized = athleteId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized) throw new Error("Invalid athlete ID");
  return path.join(getDataDirectory(), `${sanitized}.json`);
}

/** "missing" when there is no file yet, "unreadable" when it exists but can't be parsed. */
async function load(athleteId: string): Promise<CoachPreferences | "missing" | "unreadable"> {
  const cached = memoryCache.get(athleteId);
  if (cached) return cached;
  const filePath = getFilePath(athleteId);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    // Older files: `sundayRoutine` was removed (redundant with the day lists) and free-text terrain notes were
    // replaced by `terrain`. Drop them and fill new fields with defaults so the next save writes the current shape.
    const {
      sundayRoutine: _removed,
      mountainTerrainNotes: _removedNotes,
      terrainNotes: _removedDetails,
      ...stored
    } = JSON.parse(raw) as Partial<CoachPreferences> & {
      sundayRoutine?: unknown;
      mountainTerrainNotes?: unknown;
      terrainNotes?: unknown;
    };
    const defaults = createDefaultPreferences(athleteId);
    const parsed: CoachPreferences = {
      ...defaults,
      ...stored,
      // Nested, so merged on its own: files written before gym preferences existed have none.
      gym: { ...defaults.gym, ...stored.gym },
    };
    memoryCache.set(athleteId, parsed);
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    console.warn(`[PreferencesStore] Could not read ${filePath}:`, err);
    return "unreadable";
  }
}

async function save(preferences: CoachPreferences): Promise<void> {
  await writeJsonAtomic(getFilePath(preferences.athleteId), preferences, 2);
  memoryCache.set(preferences.athleteId, preferences);
}

const lockAthlete = <T>(athleteId: string, fn: () => Promise<T>) => withLock(getFilePath(athleteId), fn);

export async function getPreferences(athleteId: string): Promise<CoachPreferences> {
  const cleanId = athleteId.trim();
  const stored = await load(cleanId);
  if (typeof stored === "object") return stored;
  const defaults = createDefaultPreferences(cleanId);
  // Unreadable or corrupt: coach with defaults but leave the file alone so the athlete's rules can be recovered.
  if (stored === "unreadable") return defaults;
  await lockAthlete(cleanId, async () => {
    if ((await load(cleanId)) === "missing") await save(defaults);
  }).catch((err) => console.warn(`[PreferencesStore] Could not write default preferences:`, err));
  return defaults;
}

/** Merges `update` into the saved preferences. A disk failure throws: the change must not look saved when it isn't. */
export function updatePreferences(
  athleteId: string,
  update: Omit<PreferencesUpdate, "athleteId">,
): Promise<{ before: CoachPreferences; after: CoachPreferences } | { error: string }> {
  const cleanId = athleteId.trim();
  return lockAthlete(cleanId, async () => {
    const stored = await load(cleanId);
    if (stored === "unreadable") {
      throw new Error("The saved coach rules can't be read, so nothing was changed. Fix or remove the file first.");
    }
    const before = stored === "missing" ? createDefaultPreferences(cleanId) : stored;
    const merged = mergePreferences(before, update);
    const error = invalidPreferences(merged);
    if (error) return { error };
    const after = { ...merged, athleteId: cleanId, updatedAt: new Date().toISOString() };
    await save(after);
    return { before, after };
  });
}
