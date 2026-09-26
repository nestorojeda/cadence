import fs from "fs/promises";
import path from "path";
import { CoachPreferences, createDefaultPreferences } from "../types/preferences";

// In-memory fallback cache for serverless environments with read-only filesystems
const memoryCache = new Map<string, CoachPreferences>();

function getDataDirectory(): string {
  return path.join(process.cwd(), "data", "athletes");
}

function getFilePath(athleteId: string): string {
  // Sanitize athlete ID to prevent directory traversal
  const sanitized = athleteId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(getDataDirectory(), `${sanitized}.json`);
}

/**
 * Retrieves preferences for a given athlete ID.
 * If none exist on disk, creates and returns defaults.
 */
export async function getPreferences(athleteId: string): Promise<CoachPreferences> {
  const cleanId = athleteId.trim() || process.env.INTERVALS_ICU_ATHLETE_ID || "i435091";

  // Check memory cache first
  if (memoryCache.has(cleanId)) {
    return memoryCache.get(cleanId)!;
  }

  const filePath = getFilePath(cleanId);

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
    const defaults = createDefaultPreferences(cleanId);
    const parsed: CoachPreferences = {
      ...defaults,
      ...stored,
      // Nested, so merged on its own: files written before gym preferences existed have none.
      gym: { ...defaults.gym, ...stored.gym },
    };
    memoryCache.set(cleanId, parsed);
    return parsed;
  } catch {
    // File doesn't exist or failed to parse -> initialize with defaults
    const defaults = createDefaultPreferences(cleanId);
    await savePreferences(defaults);
    return defaults;
  }
}

/**
 * Persistently saves athlete preferences to disk.
 */
export async function savePreferences(preferences: CoachPreferences): Promise<void> {
  const cleanId = preferences.athleteId.trim() || process.env.INTERVALS_ICU_ATHLETE_ID || "i435091";
  const updatedPrefs: CoachPreferences = {
    ...preferences,
    athleteId: cleanId,
    updatedAt: new Date().toISOString(),
  };

  memoryCache.set(cleanId, updatedPrefs);

  try {
    const dataDir = getDataDirectory();
    await fs.mkdir(dataDir, { recursive: true });
    const filePath = getFilePath(cleanId);
    await fs.writeFile(filePath, JSON.stringify(updatedPrefs, null, 2), "utf-8");
  } catch (err) {
    console.warn(`[PreferencesStore] Could not write to disk (read-only environment?):`, err);
  }
}
