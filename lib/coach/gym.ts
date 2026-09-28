// Shared by the server and the UI, so it must not import server-only code.

export type GymGoal = "cycling_performance" | "injury_prevention" | "muscle" | "bone_health" | "mobility";
export type GymExperience = "beginner" | "intermediate" | "advanced";
export type GymEquipment = "full_gym" | "home" | "bodyweight";

export interface GymPreferences {
  goals: GymGoal[];
  experience: GymExperience;
  equipment: GymEquipment;
  sessionMinutes: number;
  notes: string;
}

export const createDefaultGymPreferences = (): GymPreferences => ({
  goals: ["cycling_performance", "injury_prevention"],
  experience: "intermediate",
  equipment: "full_gym",
  sessionMinutes: 45,
  notes: "",
});

export const GYM_GOALS: Array<{ id: GymGoal; label: string; guidance: string }> = [
  {
    id: "cycling_performance",
    label: "Faster on the bike",
    guidance:
      "Max strength and power transfer to the pedals: heavy compound lower-body lifts (squat, deadlift/hinge, leg press) at 3–6 reps, single-leg work (split squat, step-up), explosive jumps in base; low total volume so it doesn't cost bike sessions.",
  },
  {
    id: "injury_prevention",
    label: "Injury prevention",
    guidance:
      "Robustness for the demands of cycling: posterior chain (RDL, hip thrust, back extension), glute medius and hip stability, anti-rotation and anti-extension core, upper back and neck for posture on the bike, moderate loads at 8–12 reps.",
  },
  {
    id: "muscle",
    label: "Build muscle",
    guidance:
      "Hypertrophy: more weekly sets per muscle (10+), 6–12 reps close to failure (RPE 8–9), full-body including upper body and arms. Accept some extra fatigue and body mass; put the heavier leg days away from key bike sessions.",
  },
  {
    id: "bone_health",
    label: "Bone health",
    guidance:
      "Cycling doesn't load the skeleton: heavy axial loading (squat, deadlift, overhead press) and impact work (jumps, hops) progressed gradually.",
  },
  {
    id: "mobility",
    label: "Mobility",
    guidance:
      "Hip flexor, thoracic spine, hamstring and ankle mobility; loaded stretching and full range of motion; short mobility blocks can close any session.",
  },
];

export const GYM_EXPERIENCE: Array<{ id: GymExperience; label: string }> = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

export const GYM_EQUIPMENT: Array<{ id: GymEquipment; label: string; description: string }> = [
  { id: "full_gym", label: "Full gym", description: "barbells, racks, machines, dumbbells and cables" },
  { id: "home", label: "Home", description: "dumbbells, kettlebells and resistance bands; no barbell rack or machines" },
  { id: "bodyweight", label: "Bodyweight", description: "no equipment; bodyweight and household items only" },
];

export interface GymExercise {
  name: string;
  hevy_exercise_id?: string;
  sets: number;
  warmup_sets?: number;
  reps?: number;
  rep_min?: number;
  rep_max?: number;
  duration_seconds?: number;
  weight_kg?: number;
  rpe?: number;
  rest_seconds?: number;
  notes?: string;
}

export interface GymSessionInput {
  name: string;
  start_date_local: string;
  moving_time?: number;
  icu_training_load?: number;
  notes?: string;
  /** Session already on Intervals.icu: only create the Hevy routine. */
  hevy_only?: boolean;
  exercises: GymExercise[];
}

export interface GymSessionResult {
  /** `skipped`: the session was already on the calendar (a Hevy-only retry). */
  intervals: { id: number } | { error: string } | "skipped";
  /** `unmatched`: exercises not in the athlete's Hevy library, listed in the routine notes instead. */
  hevy: { routine_id: string; title: string; unmatched?: string[] } | { error: string } | "not_connected";
}

export const RPE_VALUES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return s ? `${m}:${s.toString().padStart(2, "0")}` : `${m}:00`;
}

export function formatSetsReps(e: Partial<GymExercise>): string {
  const sets = e.sets ?? 0;
  let per = "";
  if (e.rep_min != null && e.rep_max != null && e.rep_min !== e.rep_max) per = `${e.rep_min}–${e.rep_max}`;
  else if (e.reps != null) per = `${e.reps}`;
  else if (e.rep_min != null) per = `${e.rep_min}`;
  else if (e.duration_seconds != null) per = formatSeconds(e.duration_seconds);
  return per ? `${sets}×${per}` : `${sets} sets`;
}

export function formatRest(seconds?: number): string | null {
  return seconds ? formatSeconds(seconds) : null;
}

/** Target intensity written into Hevy exercise notes (routine sets have no RPE field). */
export function formatRpe(rpe?: number): string | null {
  if (rpe == null) return null;
  const rir = Math.max(0, 10 - rpe);
  const reps = Number.isInteger(rir) ? `${rir} rep${rir === 1 ? "" : "s"}` : `${Math.floor(rir)}–${Math.ceil(rir)} reps`;
  return `RPE ${rpe} (${reps} in reserve)`;
}

export function formatExerciseLine(e: GymExercise): string {
  const facts = [
    e.weight_kg != null ? `${e.weight_kg} kg` : null,
    e.rest_seconds ? `rest ${formatSeconds(e.rest_seconds)}` : null,
    e.warmup_sets ? `${e.warmup_sets} warm-up set${e.warmup_sets > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  const main = `${e.name} — ${formatSetsReps(e)}${e.rpe != null ? ` @ RPE ${e.rpe}` : ""}`;
  return `- ${[main, ...facts].join(" · ")}${e.notes ? `. ${e.notes}` : ""}`;
}

export function formatGymDescription(input: GymSessionInput): string {
  return [input.notes?.trim(), input.exercises.map(formatExerciseLine).join("\n")].filter(Boolean).join("\n\n");
}
