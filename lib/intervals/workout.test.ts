import { describe, expect, it } from "vitest";
import { parseWorkout, powerZone } from "./workout";

const durations = (text: string) => parseWorkout(text).map((s) => s.duration);

describe("powerZone", () => {
  it("maps %FTP to Coggan zones by upper bound", () => {
    expect(powerZone(0)).toBe(0);
    expect(powerZone(54.9)).toBe(0);
    expect(powerZone(55)).toBe(1);
    expect(powerZone(105)).toBe(4);
    expect(powerZone(149)).toBe(5);
    expect(powerZone(150)).toBe(6);
    expect(powerZone(300)).toBe(6);
  });
});

describe("parseWorkout", () => {
  it("returns no steps for empty input", () => {
    expect(parseWorkout(undefined)).toEqual([]);
    expect(parseWorkout("")).toEqual([]);
    expect(parseWorkout("Just a note\nno steps here")).toEqual([]);
  });

  it("parses every duration format", () => {
    expect(durations("- 1h 60%\n- 12m 60%\n- 30s 60%\n- 1m30s 60%\n- 5' 60%\n- 30\" 60%")).toEqual([
      3600, 720, 30, 90, 300, 30,
    ]);
  });

  it("skips lines without a duration", () => {
    expect(parseWorkout("- 95rpm 60%")).toEqual([]);
  });

  it("reads single, range and ramp %FTP targets", () => {
    const [single, range, ramp] = parseWorkout("- 5m 90%\n- 5m 88-94%\n- 12m ramp 50-65%");
    expect(single).toMatchObject({ from: 90, to: 90 });
    expect(range).toMatchObject({ from: 91, to: 91 });
    expect(ramp).toMatchObject({ from: 50, to: 65, label: "" });
  });

  it("draws zone targets at the zone midpoint, but not HR zones", () => {
    const [z2, z5, hr] = parseWorkout("- 10m Z2\n- 3m z5\n- 10m Z2 HR");
    expect(z2).toMatchObject({ from: 65, to: 65 });
    expect(z5).toMatchObject({ from: 113, to: 113 });
    expect(hr).toMatchObject({ from: null, to: null });
  });

  it("keeps free text as the label and drops key=value options", () => {
    const [step] = parseWorkout("- 10m 60% 95rpm intensity=warmup Spin easy");
    expect(step).toEqual({ duration: 600, from: 60, to: 60, label: "95rpm Spin easy" });
  });

  it("expands a header repeat up to the next blank line", () => {
    const steps = parseWorkout("Warmup\n- 10m 60%\n\nMain set 3x\n- 3m 115%\n- 3m 50%\n\n- 10m 55%");
    expect(steps.map((s) => s.from)).toEqual([60, 115, 50, 115, 50, 115, 50, 55]);
  });

  it("closes a repeat at the next header", () => {
    const steps = parseWorkout("2x\n- 1m 120%\nCooldown\n- 5m 50%");
    expect(steps.map((s) => s.from)).toEqual([120, 120, 50]);
  });

  it("accepts a repeat count at the start of a header", () => {
    expect(durations("4x Over-unders\n- 2m 95%\n- 1m 105%")).toHaveLength(8);
  });

  it("expands inline repeats", () => {
    const steps = parseWorkout("- 5x 3m 115%, 3m 50%");
    expect(steps).toHaveLength(10);
    expect(steps.slice(0, 2).map((s) => s.from)).toEqual([115, 50]);
  });
});
