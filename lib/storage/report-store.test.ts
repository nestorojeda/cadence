import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb, setDbForTests } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/testing";
import type { StoredReport } from "@/lib/reports/types";
import * as store from "./report-store";

const report = (activityId: string, date: string): StoredReport => ({
  meta: {
    activityId,
    eventId: 1,
    date,
    name: "Threshold",
    status: "ready",
    attempts: 1,
    metrics: {},
    createdAt: `${date}T20:00:00.000Z`,
  },
  body: "## Summary\nGood.",
});

beforeEach(async () => {
  setDbForTests(await createTestDb());
});

afterEach(async () => {
  await resetDb();
});

describe("report store", () => {
  it("saves, lists newest first, marks read and deletes", async () => {
    await store.saveReport("i1", report("i10", "2026-09-27"));
    await store.saveReport("i1", report("i11", "2026-09-29"));
    expect((await store.listReports("i1")).map((r) => r.activityId)).toEqual(["i11", "i10"]);

    const read = await store.markRead("i1", "i10");
    expect(read?.readAt).toBeTruthy();
    expect((await store.loadReport("i1", "i10"))?.meta.readAt).toBe(read?.readAt);
    expect((await store.listReports("i1")).find((r) => r.activityId === "i10")?.readAt).toBe(read?.readAt);
    expect(await store.markRead("i1", "i404")).toBeNull();

    await store.deleteReport("i1", "i10");
    expect(await store.loadReport("i1", "i10")).toBeNull();
    expect((await store.listReports("i1")).map((r) => r.activityId)).toEqual(["i11"]);
  });

  it("replaces a report for the same activity", async () => {
    await store.saveReport("i1", {
      ...report("i10", "2026-09-27"),
      meta: { ...report("i10", "2026-09-27").meta, status: "failed" },
    });
    await store.saveReport("i1", report("i10", "2026-09-27"));
    expect(await store.listReports("i1")).toHaveLength(1);
    expect((await store.listReports("i1"))[0].status).toBe("ready");
  });

  it("round-trips the full report and keeps the first read time", async () => {
    const full: StoredReport = {
      ...report("i10", "2026-09-27"),
      meta: {
        ...report("i10", "2026-09-27").meta,
        type: "Ride",
        model: "google · x",
        metrics: { load: 80, intensity: 0.86 },
      },
      workout: "- 4x 8m 100%",
    };
    await store.saveReport("i1", full);
    expect(await store.loadReport("i1", "i10")).toEqual(full);
    const read = await store.markRead("i1", "i10");
    expect((await store.markRead("i1", "i10"))?.readAt).toBe(read?.readAt);
    expect(await store.loadReport("i1", "i10")).toEqual({ ...full, meta: { ...full.meta, readAt: read?.readAt } });
    expect(await store.listReports("i2")).toEqual([]);
  });

  it("rejects invalid activity IDs", async () => {
    expect(store.isValidActivityId("i191637326")).toBe(true);
    expect(store.isValidActivityId("../index")).toBe(false);
    await expect(store.loadReport("i1", "../x")).rejects.toThrow("Invalid activity ID");
  });

  it("fixes the baseline on first use", async () => {
    const first = await store.getBaseline("i1", new Date("2026-09-30T10:00:00Z"));
    expect(first).toBe("2026-09-30T10:00:00.000Z");
    expect(await store.getBaseline("i1", new Date("2026-10-05T10:00:00Z"))).toBe(first);
  });
});
