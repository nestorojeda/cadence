import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compactActivities, compactActivityDetails, compactEvents, compactWellness, wellnessRange } from "./compact";

describe("compactWellness", () => {
  it("keeps coach fields, derives form, sleep and eFTP, drops empties", () => {
    const [row] = compactWellness([
      {
        id: "2026-09-25",
        ctl: 62.34,
        atl: 70.01,
        restingHR: 48,
        hrv: null,
        comments: "",
        sleepSecs: 27_000,
        sportInfo: [
          { type: "Run", eftp: 300 },
          { type: "Ride", eftp: 281.6 },
        ],
        someHugeField: [1, 2, 3],
      },
    ]);
    expect(row).toEqual({
      id: "2026-09-25",
      ctl: 62.3,
      atl: 70,
      form: -7.7,
      restingHR: 48,
      sleepHours: 7.5,
      eFTP: 282,
    });
  });
});

describe("compactEvents", () => {
  it("sends end dates only for multi-day events and availability only when limited", () => {
    const [ride, holiday] = compactEvents([
      {
        id: 1,
        start_date_local: "2026-09-26T00:00:00",
        end_date_local: "2026-09-27T00:00:00",
        category: "WORKOUT",
        name: "Z2",
        training_availability: "NORMAL",
        workout_doc: { steps: [] },
      },
      {
        id: 2,
        start_date_local: "2026-10-01T00:00:00",
        end_date_local: "2026-10-08T00:00:00",
        category: "HOLIDAY",
        name: "Trip",
        training_availability: "UNAVAILABLE",
      },
    ]);
    expect(ride).toEqual({ id: 1, start_date_local: "2026-09-26T00:00:00", category: "WORKOUT", name: "Z2" });
    expect(holiday).toMatchObject({ end_date_local: "2026-10-08T00:00:00", training_availability: "UNAVAILABLE" });
  });
});

describe("compactActivities", () => {
  it("renames Intervals power fields", () => {
    const [a] = compactActivities([{ id: "a1", icu_average_watts: 201.26, icu_weighted_avg_watts: 230, extra: 1 }]);
    expect(a).toEqual({ id: "a1", average_watts: 201.3, normalized_power: 230 });
  });

  it("flattens power zone times in details", () => {
    const details = compactActivityDetails({ id: "a1", icu_zone_times: [{ id: "Z1", secs: 60 }, { id: "Z2", secs: 120 }] });
    expect(details).toEqual({ id: "a1", power_zone_secs: { Z1: 60, Z2: 120 } });
  });
});

describe("wellnessRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 26, 12));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to the last 14 days", () => {
    expect(wellnessRange()).toEqual({ oldest: "2026-09-13", newest: "2026-09-26" });
  });

  it("clamps to 90 days before the end date", () => {
    expect(wellnessRange("2025-01-01", "2026-09-26")).toEqual({ oldest: "2026-06-29", newest: "2026-09-26" });
    expect(wellnessRange("2026-09-01", "2026-09-10")).toEqual({ oldest: "2026-09-01", newest: "2026-09-10" });
  });
});
