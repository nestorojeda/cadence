import { describe, expect, it } from "vitest";
import { pollerConfig } from "./poller";

describe("pollerConfig", () => {
  it("needs the Intervals.icu key and athlete", () => {
    expect(pollerConfig({})).toHaveProperty("disabled");
    expect(pollerConfig({ INTERVALS_ICU_API_KEY: "k" })).toHaveProperty("disabled");
    expect(pollerConfig({ INTERVALS_ICU_API_KEY: "k", INTERVALS_ICU_ATHLETE_ID: "../x" })).toHaveProperty("disabled");
  });

  it("polls every 10 minutes unless configured", () => {
    const env = { INTERVALS_ICU_API_KEY: "k", INTERVALS_ICU_ATHLETE_ID: "i1" };
    expect(pollerConfig(env)).toEqual({ athleteId: "i1", intervalsKey: "k", minutes: 10 });
    expect(pollerConfig({ ...env, REPORTS_POLL_MINUTES: "5" })).toMatchObject({ minutes: 5 });
    expect(pollerConfig({ ...env, REPORTS_POLL_MINUTES: "0" })).toHaveProperty("disabled");
    expect(pollerConfig({ ...env, REPORTS_POLL_MINUTES: "soon" })).toHaveProperty("disabled");
  });
});
