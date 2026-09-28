import { describe, expect, it } from "vitest";
import type { HevyExerciseTemplate } from "./client";
import {
  compactExerciseHistory,
  compactWorkouts,
  routineTitle,
  searchExerciseTemplates,
  toHevyRoutine,
} from "./routine";

const template = (id: string, title: string, type = "weight_reps", extra: Partial<HevyExerciseTemplate> = {}) => ({
  id,
  title,
  type,
  primary_muscle_group: "quadriceps",
  secondary_muscle_groups: [],
  equipment: "barbell",
  is_custom: false,
  ...extra,
});

const TEMPLATES: HevyExerciseTemplate[] = [
  template("SQ", "Squat (Barbell)"),
  template("BSS", "Bulgarian Split Squat", "weight_reps", {
    equipment: "dumbbell",
    secondary_muscle_groups: ["glutes"],
  }),
  template("PL", "Plank", "duration", { primary_muscle_group: "abdominals", equipment: "none" }),
  template("CUSTOM", "Squat Jump", "bodyweight_reps", { is_custom: true, equipment: "none" }),
];

describe("searchExerciseTemplates", () => {
  it("matches every query word, shortest titles first", () => {
    expect(searchExerciseTemplates(TEMPLATES, { query: "squat" }).map((t) => t.id)).toEqual(["CUSTOM", "SQ", "BSS"]);
    expect(searchExerciseTemplates(TEMPLATES, { query: "split squat" }).map((t) => t.id)).toEqual(["BSS"]);
  });

  it("filters by muscle (primary or secondary) and equipment", () => {
    expect(searchExerciseTemplates(TEMPLATES, { muscle: "Glutes" }).map((t) => t.id)).toEqual(["BSS"]);
    expect(searchExerciseTemplates(TEMPLATES, { query: "squat", equipment: "none" })).toEqual([
      {
        id: "CUSTOM",
        title: "Squat Jump",
        muscle: "quadriceps",
        equipment: "none",
        type: "bodyweight_reps",
        custom: true,
      },
    ]);
  });
});

describe("toHevyRoutine", () => {
  const { routine, unmatched } = toHevyRoutine(
    {
      name: "Gym",
      start_date_local: "2026-09-29T00:00:00",
      notes: "Strength block",
      exercises: [
        { name: "squat (barbell)", sets: 3, warmup_sets: 1, reps: 5, weight_kg: 80, rpe: 8, rest_seconds: 150 },
        {
          name: "Split squat",
          hevy_exercise_id: "BSS",
          sets: 2,
          rep_min: 8,
          rep_max: 10,
          weight_kg: 12,
          notes: "Slow",
        },
        { name: "Plank", sets: 2, duration_seconds: 45 },
        { name: "Nordic Curl", sets: 3, reps: 5 },
      ],
    },
    TEMPLATES,
    42,
    "Gym · Tue 29 Sep",
  );

  it("matches templates by id, then by normalized name", () => {
    expect(routine.exercises.map((e) => e.exercise_template_id)).toEqual(["SQ", "BSS", "PL"]);
    expect(routine).toMatchObject({ title: "Gym · Tue 29 Sep", folder_id: 42 });
  });

  it("lists unmatched exercises in the notes", () => {
    expect(unmatched).toEqual(["Nordic Curl"]);
    expect(routine.notes).toBe("Strength block\n\nNot in your Hevy library, add them yourself:\n- Nordic Curl — 3×5");
  });

  it("puts RPE into exercise notes and ramps warm-ups without a load", () => {
    const [squat] = routine.exercises;
    expect(squat.notes).toBe("RPE 8 (2 reps in reserve)");
    expect(squat.rest_seconds).toBe(150);
    expect(squat.sets).toEqual([
      { type: "warmup", weight_kg: null, reps: 5, rep_range: null, duration_seconds: null },
      ...Array(3).fill({ type: "normal", weight_kg: 80, reps: 5, rep_range: null, duration_seconds: null }),
    ]);
  });

  it("uses rep ranges and timed sets", () => {
    const [, split, plank] = routine.exercises;
    expect(split.notes).toBe("Slow");
    expect(split.sets[0]).toEqual({
      type: "normal",
      weight_kg: 12,
      reps: null,
      rep_range: { start: 8, end: 10 },
      duration_seconds: null,
    });
    expect(plank.notes).toBeNull();
    expect(plank.sets).toEqual(
      Array(2).fill({ type: "normal", weight_kg: null, reps: null, rep_range: null, duration_seconds: 45 }),
    );
  });
});

describe("routineTitle", () => {
  it("appends the day, or keeps the name for a bad date", () => {
    expect(routineTitle({ name: "Gym", start_date_local: "2026-09-29T00:00:00", exercises: [] })).toMatch(
      /^Gym · Tue 29 Sep/,
    );
    expect(routineTitle({ name: "Gym", start_date_local: "soon", exercises: [] })).toBe("Gym");
  });
});

describe("compactWorkouts", () => {
  it("summarizes working sets and adds the library title when it differs", () => {
    const [w] = compactWorkouts(
      [
        {
          id: "w1",
          title: "Pierna",
          start_time: "2026-09-20T08:00:00Z",
          end_time: "2026-09-20T09:05:00Z",
          exercises: [
            {
              title: "Sentadilla (Barra)",
              exercise_template_id: "SQ",
              sets: [
                { type: "warmup", weight_kg: 40, reps: 8 },
                { type: "normal", weight_kg: 80, reps: 5, rpe: 8 },
                { type: "normal", duration_seconds: 30 },
              ],
            },
            { title: "Plank", exercise_template_id: "PL", sets: [] },
          ],
        },
      ],
      TEMPLATES,
    );
    expect(w).toEqual({
      date: "2026-09-20",
      title: "Pierna",
      minutes: 65,
      exercises: [
        { title: "Sentadilla (Barra)", id: "SQ", library_title: "Squat (Barbell)", sets: "80kg×5@8, 30s" },
        { title: "Plank", id: "PL", sets: "" },
      ],
    });
  });
});

describe("compactExerciseHistory", () => {
  it("groups sets per workout, newest first, without warm-ups", () => {
    const entry = (workout_id: string, date: string, weight_kg: number, set_type = "normal") => ({
      workout_id,
      workout_title: "Legs",
      workout_start_time: `${date}T08:00:00Z`,
      weight_kg,
      reps: 5,
      set_type,
    });
    expect(
      compactExerciseHistory(
        [
          entry("a", "2026-09-01", 40, "warmup"),
          entry("a", "2026-09-01", 75),
          entry("b", "2026-09-08", 80),
          entry("b", "2026-09-08", 80),
        ],
        1,
      ),
    ).toEqual([{ date: "2026-09-08", sets: "80kg×5, 80kg×5" }]);
  });
});
