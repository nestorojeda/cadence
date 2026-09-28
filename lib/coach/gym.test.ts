import { describe, expect, it } from "vitest";
import { formatExerciseLine, formatGymDescription, formatRest, formatRpe, formatSetsReps } from "./gym";

describe("formatSetsReps", () => {
  it("formats reps, ranges and timed sets", () => {
    expect(formatSetsReps({ sets: 4, reps: 5 })).toBe("4×5");
    expect(formatSetsReps({ sets: 3, rep_min: 8, rep_max: 10 })).toBe("3×8–10");
    expect(formatSetsReps({ sets: 3, rep_min: 8, rep_max: 8 })).toBe("3×8");
    expect(formatSetsReps({ sets: 3, duration_seconds: 45 })).toBe("3×45s");
    expect(formatSetsReps({ sets: 2, duration_seconds: 90 })).toBe("2×1:30");
    expect(formatSetsReps({ sets: 3 })).toBe("3 sets");
  });
});

describe("formatRest", () => {
  it("formats minutes and seconds", () => {
    expect(formatRest(150)).toBe("2:30");
    expect(formatRest(120)).toBe("2:00");
    expect(formatRest(undefined)).toBeNull();
  });
});

describe("formatRpe", () => {
  it("adds reps in reserve", () => {
    expect(formatRpe(8)).toBe("RPE 8 (2 reps in reserve)");
    expect(formatRpe(9)).toBe("RPE 9 (1 rep in reserve)");
    expect(formatRpe(7.5)).toBe("RPE 7.5 (2–3 reps in reserve)");
    expect(formatRpe(undefined)).toBeNull();
  });
});

describe("formatExerciseLine", () => {
  it("lists load, rest and warm-ups", () => {
    expect(
      formatExerciseLine({
        name: "Back Squat (Barbell)",
        sets: 4,
        reps: 5,
        rpe: 8,
        weight_kg: 80,
        rest_seconds: 150,
        warmup_sets: 2,
        notes: "Pause at the bottom",
      }),
    ).toBe("- Back Squat (Barbell) — 4×5 @ RPE 8 · 80 kg · rest 2:30 · 2 warm-up sets. Pause at the bottom");
  });

  it("builds a description from notes and exercises", () => {
    expect(
      formatGymDescription({
        name: "Gym",
        start_date_local: "2026-09-29T00:00:00",
        notes: " Keep it light ",
        exercises: [{ name: "Plank", sets: 3, duration_seconds: 45 }],
      }),
    ).toBe("Keep it light\n\n- Plank — 3×45s");
  });
});
