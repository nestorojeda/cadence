import { describe, expect, it } from "vitest";
import {
  NO_ZONE_COLOR,
  STRENGTH_COLOR,
  activityZoneColor,
  eventZoneColor,
  formatCountdown,
  formatDuration,
  formatSigned,
  intensityZoneColor,
  toLocalDate,
} from "./metrics";
import { POWER_ZONE_COLORS } from "./workout";

describe("formatCountdown", () => {
  it("counts days, then weeks", () => {
    expect(formatCountdown(-2)).toBe("today");
    expect(formatCountdown(0)).toBe("today");
    expect(formatCountdown(1)).toBe("tomorrow");
    expect(formatCountdown(20)).toBe("20 d");
    expect(formatCountdown(63)).toBe("9 wk");
  });
});

describe("formatSigned", () => {
  it("uses a true minus sign and rounds", () => {
    expect(formatSigned(-8.4)).toBe("−8");
    expect(formatSigned(3.6)).toBe("+4");
    expect(formatSigned(0.2)).toBe("0");
  });
});

describe("formatDuration", () => {
  it("formats h:mm", () => {
    expect(formatDuration(5400)).toBe("1:30");
    expect(formatDuration(600)).toBe("0:10");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(0)).toBe("—");
  });
});

describe("zone colours", () => {
  it("maps intensity factor to Z1–Z5+", () => {
    expect(intensityZoneColor(0.5)).toBe(POWER_ZONE_COLORS[0]);
    expect(intensityZoneColor(0.55)).toBe(POWER_ZONE_COLORS[1]);
    expect(intensityZoneColor(0.95)).toBe(POWER_ZONE_COLORS[3]);
    expect(intensityZoneColor(1.2)).toBe(POWER_ZONE_COLORS[4]);
  });

  it("estimates a planned session's zone from load per hour", () => {
    // 1 h at 81 TSS → IF 0.9 → Z4.
    expect(
      eventZoneColor({ date: "2026-09-26", name: "Threshold", category: "WORKOUT", load: 81, movingTime: 3600 }),
    ).toBe(POWER_ZONE_COLORS[3]);
    expect(eventZoneColor({ date: "2026-09-26", name: "Ride", category: "WORKOUT" })).toBe(NO_ZONE_COLOR);
  });

  it("colours strength work purple", () => {
    expect(eventZoneColor({ date: "2026-09-26", name: "Legs", type: "WeightTraining", category: "WORKOUT" })).toBe(
      STRENGTH_COLOR,
    );
    expect(activityZoneColor({ date: "2026-09-26", name: "Gym session" })).toBe(STRENGTH_COLOR);
  });

  it("prefers an activity's measured intensity", () => {
    expect(activityZoneColor({ date: "2026-09-26", name: "Ride", intensity: 0.7, load: 200, movingTime: 3600 })).toBe(
      POWER_ZONE_COLORS[1],
    );
    expect(activityZoneColor({ date: "2026-09-26", name: "Ride" })).toBe(NO_ZONE_COLOR);
  });
});

describe("toLocalDate", () => {
  it("formats the local calendar date", () => {
    expect(toLocalDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
