import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent, IntervalsClient } from "./client";
import { getIntervalsTools } from "./tools";

const workout: CalendarEvent = {
  id: 7,
  name: "VO2",
  start_date_local: "2026-09-29T09:00:00",
  category: "WORKOUT",
  type: "Ride",
  moving_time: 3600,
};

function fakeClient(event: CalendarEvent) {
  const client = {
    getEvent: vi.fn(async () => event),
    updateEvent: vi.fn(async (_athlete: string, _id: string, changes: Record<string, unknown>) => ({ ...event, ...changes })),
    deleteEvent: vi.fn(async () => undefined),
  };
  return { client, tools: getIntervalsTools(client as unknown as IntervalsClient) };
}

/** Runs a tool's execute the way the AI SDK would, outside a model call. */
function run<T>(t: { execute?: (input: T, options: never) => unknown }, input: T) {
  return t.execute!(input, { toolCallId: "t1", messages: [] } as never);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 26, 12)); // 2026-09-26
});
afterEach(() => {
  vi.useRealTimers();
});

describe("icu_update_calendar_event", () => {
  it("sends only the fields that change and returns the compacted event", async () => {
    const { client, tools } = fakeClient(workout);
    const result = await run(tools.icu_update_calendar_event, {
      athlete_id: "i1",
      event_id: "7",
      start_date_local: "2026-09-30T09:00:00",
      name: undefined,
    });
    expect(client.updateEvent).toHaveBeenCalledWith("i1", "7", { start_date_local: "2026-09-30T09:00:00" });
    expect(result).toMatchObject({ id: 7, name: "VO2", start_date_local: "2026-09-30T09:00:00" });
  });

  it("refuses races and past events without writing", async () => {
    for (const event of [
      { ...workout, category: "RACE_A" },
      { ...workout, start_date_local: "2026-09-20T09:00:00" },
    ]) {
      const { client, tools } = fakeClient(event);
      const result = await run(tools.icu_update_calendar_event, { athlete_id: "i1", event_id: "7", name: "Endurance" });
      expect(result).toHaveProperty("error");
      expect(client.updateEvent).not.toHaveBeenCalled();
    }
  });

  it("refuses moving a session into the past", async () => {
    const { client, tools } = fakeClient(workout);
    const result = await run(tools.icu_update_calendar_event, {
      athlete_id: "i1",
      event_id: "7",
      start_date_local: "2026-09-25T09:00:00",
    });
    expect(result).toEqual({ error: "Sessions can't be moved into the past." });
    expect(client.updateEvent).not.toHaveBeenCalled();
  });

  it("refuses an empty change", async () => {
    const { client, tools } = fakeClient(workout);
    expect(await run(tools.icu_update_calendar_event, { athlete_id: "i1", event_id: "7" })).toHaveProperty("error");
    expect(client.updateEvent).not.toHaveBeenCalled();
  });

  it("returns client failures as { error }", async () => {
    const { client, tools } = fakeClient(workout);
    client.updateEvent.mockRejectedValueOnce(new Error("Failed to update calendar event 7 (500)"));
    expect(await run(tools.icu_update_calendar_event, { athlete_id: "i1", event_id: "7", name: "Z2" })).toEqual({
      error: "Failed to update calendar event 7 (500)",
    });
  });
});

describe("icu_delete_calendar_event", () => {
  it("deletes an upcoming workout and reports what was removed", async () => {
    const { client, tools } = fakeClient(workout);
    const result = await run(tools.icu_delete_calendar_event, { athlete_id: "i1", event_id: "7" });
    expect(client.deleteEvent).toHaveBeenCalledWith("i1", "7");
    expect(result).toEqual({
      deleted: { id: 7, name: "VO2", start_date_local: "2026-09-29T09:00:00", category: "WORKOUT" },
    });
  });

  it("refuses past, completed and time-off events without deleting", async () => {
    for (const event of [
      { ...workout, start_date_local: "2026-09-25T09:00:00" },
      { ...workout, paired_activity_id: "i99" },
      { ...workout, category: "SICK" },
    ]) {
      const { client, tools } = fakeClient(event);
      expect(await run(tools.icu_delete_calendar_event, { athlete_id: "i1", event_id: "7" })).toHaveProperty("error");
      expect(client.deleteEvent).not.toHaveBeenCalled();
    }
  });

  it("returns a missing event as { error }", async () => {
    const { client, tools } = fakeClient(workout);
    client.getEvent.mockRejectedValueOnce(new Error("Failed to fetch calendar event 7 (404)"));
    expect(await run(tools.icu_delete_calendar_event, { athlete_id: "i1", event_id: "7" })).toEqual({
      error: "Failed to fetch calendar event 7 (404)",
    });
  });
});
