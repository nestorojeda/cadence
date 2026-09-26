import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAthleteId } from "./athlete";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveAthleteId", () => {
  it("prefers the requested ID over the env var", () => {
    vi.stubEnv("INTERVALS_ICU_ATHLETE_ID", "i999");
    expect(resolveAthleteId(" i123 ")).toBe("i123");
  });

  it("falls back to INTERVALS_ICU_ATHLETE_ID", () => {
    vi.stubEnv("INTERVALS_ICU_ATHLETE_ID", "i999");
    expect(resolveAthleteId(null)).toBe("i999");
    expect(resolveAthleteId("  ")).toBe("i999");
  });

  it("is null when nothing is set", () => {
    vi.stubEnv("INTERVALS_ICU_ATHLETE_ID", "");
    expect(resolveAthleteId(undefined)).toBeNull();
  });

  it("rejects IDs that are unsafe as file names", () => {
    expect(resolveAthleteId("../etc")).toBeNull();
    expect(resolveAthleteId("i1 2")).toBeNull();
    expect(resolveAthleteId("a".repeat(33))).toBeNull();
  });
});
