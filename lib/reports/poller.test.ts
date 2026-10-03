import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDb, setDbForTests } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/testing";
import { pollSource, pollerConfig, runPoll } from "./poller";

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

describe("pollSource", () => {
  it("needs only the Intervals.icu key and athlete, whatever the timer setting", () => {
    expect(
      pollSource({ INTERVALS_ICU_API_KEY: "k", INTERVALS_ICU_ATHLETE_ID: "i1", REPORTS_POLL_MINUTES: "0" }),
    ).toEqual({
      athleteId: "i1",
      intervalsKey: "k",
    });
    expect(pollSource({})).toHaveProperty("disabled");
  });
});

describe("runPoll", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    await resetDb();
  });

  it("skips while another poll holds the lock", async () => {
    setDbForTests(await createTestDb());
    const db = await getDb();
    const result = await db.withAdvisoryLock("cadence:report-poller", () =>
      runPoll({ athleteId: "i1", intervalsKey: "k" }),
    );
    expect(result).toEqual({ status: "busy" });
  });

  it("reports a pause when no report model can be resolved", async () => {
    setDbForTests(await createTestDb());
    vi.stubEnv("REPORT_MODEL_PROVIDER", "nope");
    expect(await runPoll({ athleteId: "i1", intervalsKey: "k" })).toMatchObject({ status: "paused" });
  });

  it("fails without a database instead of throwing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await runPoll({ athleteId: "i1", intervalsKey: "k" })).toMatchObject({ status: "failed" });
  });
});
