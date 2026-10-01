import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredReport } from "@/lib/reports/types";

let root: string;
let store: typeof import("./report-store");

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
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cadence-reports-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.resetModules();
  store = await import("./report-store");
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
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

  it("rejects activity IDs that could leave the folder", async () => {
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
