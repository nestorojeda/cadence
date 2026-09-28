import { upstreamError } from "@/lib/api/upstream";

export interface HevyExerciseTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  equipment?: string;
  is_custom: boolean;
}

export interface HevySet {
  index?: number;
  type: string;
  weight_kg?: number | null;
  reps?: number | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  rpe?: number | null;
}

export interface HevyWorkout {
  id: string;
  title: string;
  routine_id?: string;
  start_time: string;
  end_time?: string;
  exercises: Array<{
    title: string;
    exercise_template_id: string;
    notes?: string;
    sets: HevySet[];
  }>;
}

export interface HevyExerciseHistoryEntry {
  workout_id: string;
  workout_title: string;
  workout_start_time: string;
  weight_kg?: number | null;
  reps?: number | null;
  duration_seconds?: number | null;
  rpe?: number | null;
  set_type: string;
}

export interface HevyRoutineSet {
  type: "warmup" | "normal" | "failure" | "dropset";
  weight_kg?: number | null;
  reps?: number | null;
  duration_seconds?: number | null;
  rep_range?: { start: number; end: number } | null;
}

export interface HevyRoutineInput {
  title: string;
  folder_id: number | null;
  notes?: string;
  exercises: Array<{
    exercise_template_id: string;
    superset_id?: number | null;
    rest_seconds?: number | null;
    notes?: string | null;
    sets: HevyRoutineSet[];
  }>;
}

export interface HevyRoutine {
  id: string;
  title: string;
  folder_id?: number | null;
}

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const templateCache = new Map<string, CacheEntry<HevyExerciseTemplate[]>>();
// Holds the pending lookup, not just the result: sessions approved together run in parallel and must share one
// lookup-or-create, or each would make its own folder.
const folderCache = new Map<string, Promise<number>>();
const TEMPLATE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;

export const HEVY_FOLDER_TITLE = "Cadence";

export class HevyClient {
  private baseUrl = "https://api.hevyapp.com/v1";

  constructor(private apiKey: string) {}

  private async request<T>(path: string, what: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const hint = res.status === 401 ? " — check the Hevy API key (Hevy Pro is required)" : "";
      throw await upstreamError(res, what, hint);
    }
    return res.json() as Promise<T>;
  }

  async getExerciseTemplates(): Promise<HevyExerciseTemplate[]> {
    const cached = templateCache.get(this.apiKey);
    if (cached && cached.expires > Date.now()) return cached.value;

    const all: HevyExerciseTemplate[] = [];
    for (let page = 1; ; page++) {
      const data = await this.request<{ page_count?: number; exercise_templates?: HevyExerciseTemplate[] }>(
        `/exercise_templates?page=${page}&pageSize=100`,
        "fetch Hevy exercises"
      );
      const templates = data.exercise_templates ?? [];
      all.push(...templates);
      if (page >= (data.page_count ?? 0) || templates.length === 0 || page >= 20) break;
    }
    templateCache.set(this.apiKey, { value: all, expires: Date.now() + TEMPLATE_TTL_MS });
    return all;
  }

  async getWorkouts(pageSize = 5): Promise<HevyWorkout[]> {
    const data = await this.request<{ workouts?: HevyWorkout[] }>(
      `/workouts?page=1&pageSize=${Math.min(10, Math.max(1, pageSize))}`,
      "fetch Hevy workouts"
    );
    return data.workouts ?? [];
  }

  async getExerciseHistory(templateId: string, startDate?: string, endDate?: string): Promise<HevyExerciseHistoryEntry[]> {
    const params = new URLSearchParams();
    if (startDate) params.set("start_date", new Date(`${startDate}T00:00:00Z`).toISOString());
    if (endDate) params.set("end_date", new Date(`${endDate}T23:59:59Z`).toISOString());
    const qs = params.toString() ? `?${params}` : "";
    const data = await this.request<{ exercise_history?: HevyExerciseHistoryEntry[] }>(
      `/exercise_history/${encodeURIComponent(templateId)}${qs}`,
      "fetch Hevy exercise history"
    );
    return data.exercise_history ?? [];
  }

  getOrCreateFolder(title = HEVY_FOLDER_TITLE): Promise<number> {
    const cacheKey = `${this.apiKey}:${title}`;
    let pending = folderCache.get(cacheKey);
    if (!pending) {
      pending = this.findOrCreateFolder(title);
      folderCache.set(cacheKey, pending);
      // A failed lookup is retried on the next routine rather than cached.
      pending.catch(() => folderCache.delete(cacheKey));
    }
    return pending;
  }

  private async findOrCreateFolder(title: string): Promise<number> {
    type Folder = { id: number; title: string };
    const matches: Folder[] = [];
    for (let page = 1; page <= 10; page++) {
      const data = await this.request<{ page_count?: number; routine_folders?: Folder[] }>(
        `/routine_folders?page=${page}&pageSize=10`,
        "fetch Hevy routine folders"
      ).catch((error: Error) => {
        // Hevy answers 404 past the last page, and for accounts without folders.
        if (/\(404\)/.test(error.message)) return { page_count: 0, routine_folders: [] as Folder[] };
        throw error;
      });
      const folders = data.routine_folders ?? [];
      matches.push(...folders.filter((f) => f.title === title));
      if (page >= (data.page_count ?? 0) || folders.length === 0) break;
    }
    // Earlier versions could create duplicates; always use the oldest so routines stay together.
    if (matches.length > 0) return Math.min(...matches.map((f) => f.id));

    const created = await this.request<{ routine_folder?: Folder | Folder[] } & Partial<Folder>>(
      "/routine_folders",
      "create the Hevy routine folder",
      { method: "POST", body: JSON.stringify({ routine_folder: { title } }) }
    );
    const folder = Array.isArray(created.routine_folder) ? created.routine_folder[0] : created.routine_folder;
    const id = folder?.id ?? created.id;
    if (id == null) throw new Error(`Hevy did not return the new routine folder's id (${JSON.stringify(created)})`);
    return id;
  }

  async createRoutine(routine: HevyRoutineInput): Promise<HevyRoutine> {
    // Documented as a Routine; the live API wraps it as { routine: [Routine] }.
    const data = await this.request<HevyRoutine | { routine: HevyRoutine | HevyRoutine[] }>(
      "/routines",
      "create the Hevy routine",
      { method: "POST", body: JSON.stringify({ routine }) }
    );
    const created = "routine" in data ? (Array.isArray(data.routine) ? data.routine[0] : data.routine) : data;
    if (!created?.id) throw new Error(`Hevy did not return the new routine (${JSON.stringify(data).slice(0, 300)})`);
    return created;
  }
}
