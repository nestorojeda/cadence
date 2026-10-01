import { describe, expect, it } from "vitest";
import type { ActivitySummary, CalendarEvent } from "@/lib/intervals/client";
import { eligibleSessions, pendingSession, sessionMetrics } from "./eligible";

const event = (id: number, over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  name: "Threshold",
  start_date_local: "2026-09-29T00:00:00",
  category: "WORKOUT",
  type: "Ride",
  moving_time: 3600,
  icu_training_load: 80,
  description: "- 10m 60%\n- 4x 8m 100%",
  workout_doc: { steps: [{}, {}] },
  ...over,
});

const activity = (id: string, over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  id,
  name: "4x8 threshold",
  type: "Ride",
  start_date_local: "2026-09-29T18:09:09",
  moving_time: 3420,
  icu_training_load: 76,
  icu_intensity: 86.4,
  icu_weighted_avg_watts: 251,
  ...over,
});

describe("eligibleSessions", () => {
  it("keeps activities paired with a structured bike workout", () => {
    const sessions = eligibleSessions(
      [
        activity("i1", { paired_event_id: 1 }),
        activity("i2"),
        activity("i3", { paired_event_id: 3, type: "WeightTraining", name: "Gym" }),
        activity("i4", { paired_event_id: 4 }),
        activity("i5", { paired_event_id: 5 }),
        activity("i6", { paired_event_id: 99 }),
      ],
      [
        event(1),
        event(3, { name: "Gym", type: "WeightTraining" }),
        event(4, { workout_doc: { steps: [] } }),
        event(5, { category: "NOTE" }),
      ],
    );
    expect(sessions.map((s) => s.activity.id)).toEqual(["i1"]);
  });
});

describe("sessionMetrics", () => {
  it("compares load with the plan, falling back to time", () => {
    const session = { activity: activity("i1", { paired_event_id: 1 }), event: event(1) };
    expect(sessionMetrics(session)).toEqual({
      movingTime: 3420,
      plannedTime: 3600,
      load: 76,
      plannedLoad: 80,
      normalizedPower: 251,
      intensity: 0.86,
      compliance: 95,
      averageHeartrate: undefined,
    });
    expect(
      sessionMetrics({ activity: activity("i1", { icu_training_load: undefined }), event: event(1) }).compliance,
    ).toBe(95);
    expect(
      sessionMetrics({
        activity: activity("i1", { moving_time: undefined, icu_training_load: undefined }),
        event: event(1),
      }).compliance,
    ).toBeUndefined();
  });

  it("names the session after the activity", () => {
    expect(pendingSession({ activity: activity("i1"), event: event(1, { name: "Ciclismo" }) })).toMatchObject({
      activityId: "i1",
      eventId: 1,
      date: "2026-09-29",
      name: "4x8 threshold",
    });
  });
});
