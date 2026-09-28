import { formatExerciseLine, formatRpe, type GymExercise, type GymSessionInput } from "@/lib/coach/gym";
import type { HevyExerciseHistoryEntry, HevyExerciseTemplate, HevyRoutineInput, HevyRoutineSet, HevyWorkout } from "./client";

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function searchExerciseTemplates(
  templates: HevyExerciseTemplate[],
  { query, muscle, equipment }: { query?: string; muscle?: string; equipment?: string },
  limit = 15
) {
  const words = normalize(query ?? "").split(" ").filter(Boolean);
  const muscleKey = muscle ? normalize(muscle).replace(/ /g, "_") : undefined;
  return templates
    .filter((t) => {
      const title = normalize(t.title);
      if (!words.every((w) => title.includes(w))) return false;
      if (muscleKey && t.primary_muscle_group !== muscleKey && !t.secondary_muscle_groups?.includes(muscleKey)) return false;
      if (equipment && t.equipment !== equipment) return false;
      return true;
    })
    .sort((a, b) => a.title.length - b.title.length)
    .slice(0, limit)
    .map((t) => ({
      id: t.id,
      title: t.title,
      muscle: t.primary_muscle_group,
      equipment: t.equipment,
      type: t.type,
      ...(t.is_custom ? { custom: true } : {}),
    }));
}

function resolveTemplate(templates: HevyExerciseTemplate[], exercise: GymExercise): HevyExerciseTemplate | undefined {
  if (exercise.hevy_exercise_id) {
    const byId = templates.find((t) => t.id === exercise.hevy_exercise_id);
    if (byId) return byId;
  }
  const name = normalize(exercise.name);
  return templates.find((t) => normalize(t.title) === name);
}

function routineSets(e: GymExercise, template: HevyExerciseTemplate): HevyRoutineSet[] {
  const timed = /duration/.test(template.type) || (e.duration_seconds != null && e.reps == null && e.rep_min == null);
  const range =
    e.rep_min != null && e.rep_max != null && e.rep_min !== e.rep_max ? { start: e.rep_min, end: e.rep_max } : null;
  const reps = range ? null : (e.reps ?? e.rep_min ?? null);
  const loaded = /weight/.test(template.type);
  const working: HevyRoutineSet = {
    type: "normal",
    weight_kg: loaded ? (e.weight_kg ?? null) : null,
    reps: timed ? null : reps,
    rep_range: timed ? null : range,
    duration_seconds: timed ? (e.duration_seconds ?? null) : null,
  };
  const warmup: HevyRoutineSet = {
    ...working,
    type: "warmup",
    weight_kg: null,
  };
  return [
    ...Array.from({ length: Math.max(0, e.warmup_sets ?? 0) }, () => warmup),
    ...Array.from({ length: Math.max(1, e.sets) }, () => working),
  ];
}

export function toHevyRoutine(
  input: GymSessionInput,
  templates: HevyExerciseTemplate[],
  folderId: number | null,
  title: string
): { routine: HevyRoutineInput; unmatched: string[] } {
  const unmatched: GymExercise[] = [];
  const exercises: HevyRoutineInput["exercises"] = [];
  for (const e of input.exercises) {
    const template = resolveTemplate(templates, e);
    if (!template) {
      unmatched.push(e);
      continue;
    }
    exercises.push({
      exercise_template_id: template.id,
      superset_id: null,
      rest_seconds: e.rest_seconds ?? null,
      notes: [formatRpe(e.rpe), e.notes].filter(Boolean).join(". ") || null,
      sets: routineSets(e, template),
    });
  }
  const notes = [
    input.notes?.trim(),
    unmatched.length ? `Not in your Hevy library, add them yourself:\n${unmatched.map(formatExerciseLine).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    routine: { title, folder_id: folderId, notes: notes || undefined, exercises },
    unmatched: unmatched.map((e) => e.name),
  };
}

export function routineTitle(input: GymSessionInput): string {
  const d = new Date(input.start_date_local);
  if (Number.isNaN(d.getTime())) return input.name;
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
  return `${input.name} · ${day}`;
}

const setLabel = (s: { weight_kg?: number | null; reps?: number | null; duration_seconds?: number | null; rpe?: number | null }) =>
  [
    s.weight_kg != null ? `${s.weight_kg}kg` : null,
    s.reps != null ? `×${s.reps}` : s.duration_seconds != null ? `${s.duration_seconds}s` : null,
    s.rpe != null ? `@${s.rpe}` : null,
  ]
    .filter(Boolean)
    .join("");

// Workout titles are in the athlete's app language while the library is English, so the library title is added.
export function compactWorkouts(workouts: HevyWorkout[], templates: HevyExerciseTemplate[] = []) {
  const libraryTitle = new Map(templates.map((t) => [t.id, t.title]));
  return workouts.map((w) => ({
    date: w.start_time?.slice(0, 10),
    title: w.title,
    minutes: w.end_time ? Math.round((Date.parse(w.end_time) - Date.parse(w.start_time)) / 60000) : undefined,
    exercises: w.exercises.map((e) => {
      const library = libraryTitle.get(e.exercise_template_id);
      return {
        title: e.title,
        id: e.exercise_template_id,
        ...(library && library !== e.title ? { library_title: library } : {}),
        sets: e.sets.filter((s) => s.type !== "warmup").map(setLabel).join(", "),
      };
    }),
  }));
}

export function compactExerciseHistory(entries: HevyExerciseHistoryEntry[], limit = 10) {
  const byWorkout = new Map<string, { date: string; sets: string[] }>();
  for (const e of entries) {
    if (e.set_type === "warmup") continue;
    const row = byWorkout.get(e.workout_id) ?? { date: e.workout_start_time.slice(0, 10), sets: [] };
    row.sets.push(setLabel(e));
    byWorkout.set(e.workout_id, row);
  }
  return Array.from(byWorkout.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((r) => ({ date: r.date, sets: r.sets.join(", ") }));
}
