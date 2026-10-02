import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivitySummary, CalendarEvent, IntervalsClient } from "@/lib/intervals/client";
import type { ResolvedModel } from "@/lib/llm/provider";
import { resetDb, setDbForTests } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/testing";

let service: typeof import("./service");
let store: typeof import("@/lib/storage/report-store");

const today = new Date().toISOString().slice(0, 10);

const workout: CalendarEvent = {
  id: 1,
  name: "Threshold",
  start_date_local: `${today}T00:00:00`,
  category: "WORKOUT",
  type: "Ride",
  moving_time: 3600,
  icu_training_load: 80,
  description: "- 4x 8m 100%",
  workout_doc: { steps: [{}] },
};

const ride = (id: string, created: string, over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  id,
  name: "Threshold",
  type: "Ride",
  start_date_local: `${today}T08:00:00`,
  created,
  moving_time: 3500,
  icu_training_load: 78,
  paired_event_id: 1,
  ...over,
});

function fakeClient(activities: ActivitySummary[]) {
  return {
    getActivities: vi.fn(async () => activities),
    getEvents: vi.fn(async () => [workout]),
    getActivity: vi.fn(async (id: string) => ({ id, name: "Threshold", icu_average_watts: 240 })),
    getActivityIntervals: vi.fn(async () => ({ id: "x", icu_intervals: [{ type: "WORK", average_watts: 270 }] })),
    getWellness: vi.fn(async () => [{ id: today, ctl: 60, atl: 70 }]),
  } as unknown as IntervalsClient;
}

function resolvedModel(text: string | Error): { resolved: ResolvedModel; prompts: string[] } {
  const prompts: string[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      prompts.push(JSON.stringify(options.prompt));
      if (text instanceof Error) throw text;
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return {
    resolved: { model, label: "mock · test", providerOptions: undefined, describeError: (e) => String(e) },
    prompts,
  };
}

beforeEach(async () => {
  setDbForTests(await createTestDb());
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.resetModules();
  service = await import("./service");
  store = await import("@/lib/storage/report-store");
});

afterEach(async () => {
  vi.restoreAllMocks();
  await resetDb();
});

describe("autoReports", () => {
  it("writes reports only for uploads after the baseline", async () => {
    await store.getBaseline("i1", new Date("2026-09-30T12:00:00Z"));
    const client = fakeClient([
      ride("i10", "2026-09-30T18:00:00Z"),
      ride("i11", "2026-09-30T09:00:00Z"),
      ride("i12", "2026-09-30T19:00:00Z", { paired_event_id: undefined }),
    ]);
    const { resolved, prompts } = resolvedModel("<think>hmm</think>\n## Summary\nSolid work.");

    const written = await service.autoReports(client, { athleteId: "i1", resolved });

    expect(written.map((r) => [r.activityId, r.status])).toEqual([["i10", "ready"]]);
    const saved = await store.loadReport("i1", "i10");
    expect(saved?.body).toBe("## Summary\nSolid work.");
    expect(saved?.meta).toMatchObject({ model: "mock · test", attempts: 1, metrics: { compliance: 98 } });
    expect(prompts[0]).toContain("4x 8m 100%");
    expect(prompts[0]).toContain("TSB -10");

    expect(await service.autoReports(client, { athleteId: "i1", resolved })).toEqual([]);
  });

  it("stores failures and stops retrying after the last attempt", async () => {
    await store.getBaseline("i1", new Date("2026-09-30T12:00:00Z"));
    const client = fakeClient([ride("i10", "2026-09-30T18:00:00Z")]);
    const { resolved } = resolvedModel(new Error("rate limited"));

    for (let i = 0; i < 3; i++) await service.autoReports(client, { athleteId: "i1", resolved });
    const [meta] = await store.listReports("i1");
    expect(meta).toMatchObject({ status: "failed", attempts: 3 });
    expect(meta.error).toContain("rate limited");
    expect(await service.autoReports(client, { athleteId: "i1", resolved })).toEqual([]);
  });

  it("keeps a written report when regenerating it fails", async () => {
    const client = fakeClient([ride("i10", "2026-09-30T18:00:00Z")]);
    const [session] = await service.findSessions(client, 2);
    await service.runReport(session, {
      client,
      athleteId: "i1",
      resolved: resolvedModel("## Summary\nGood.").resolved,
    });
    const failed = await service.runReport(session, {
      client,
      athleteId: "i1",
      resolved: resolvedModel(new Error("down")).resolved,
      attempts: 1,
    });
    expect(failed.status).toBe("failed");
    expect((await store.loadReport("i1", "i10"))?.body).toBe("## Summary\nGood.");
  });

  it("lists last week's sessions without a report as pending", async () => {
    const client = fakeClient([ride("i10", "2026-09-30T18:00:00Z"), ride("i11", "2026-09-29T18:00:00Z")]);
    await store.saveReport("i1", {
      meta: {
        activityId: "i11",
        eventId: 1,
        date: today,
        name: "x",
        status: "failed",
        attempts: 1,
        metrics: {},
        createdAt: "2026-09-29T20:00:00.000Z",
      },
      body: "",
    });
    expect((await service.listPending(client, "i1")).map((p) => p.activityId)).toEqual(["i10"]);
  });
});
