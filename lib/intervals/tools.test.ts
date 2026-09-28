import { safeValidateUIMessages, type UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntervalsClient, type CalendarEvent } from "./client";
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
    updateEvent: vi.fn(async (_id: string, changes: Record<string, unknown>) => ({ ...event, ...changes })),
    deleteEvent: vi.fn(async () => undefined),
  };
  return { client, tools: getIntervalsTools(client as unknown as IntervalsClient) };
}

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
      event_id: "7",
      start_date_local: "2026-09-30T09:00:00",
      name: undefined,
    });
    expect(client.updateEvent).toHaveBeenCalledWith("7", { start_date_local: "2026-09-30T09:00:00" });
    expect(result).toMatchObject({ id: 7, name: "VO2", start_date_local: "2026-09-30T09:00:00" });
  });

  it("refuses races and past events without writing", async () => {
    for (const event of [
      { ...workout, category: "RACE_A" },
      { ...workout, start_date_local: "2026-09-20T09:00:00" },
    ]) {
      const { client, tools } = fakeClient(event);
      const result = await run(tools.icu_update_calendar_event, { event_id: "7", name: "Endurance" });
      expect(result).toHaveProperty("error");
      expect(client.updateEvent).not.toHaveBeenCalled();
    }
  });

  it("refuses moving a session into the past", async () => {
    const { client, tools } = fakeClient(workout);
    const result = await run(tools.icu_update_calendar_event, {
      event_id: "7",
      start_date_local: "2026-09-25T09:00:00",
    });
    expect(result).toEqual({ error: "Sessions can't be moved into the past." });
    expect(client.updateEvent).not.toHaveBeenCalled();
  });

  it("refuses an empty change", async () => {
    const { client, tools } = fakeClient(workout);
    expect(await run(tools.icu_update_calendar_event, { event_id: "7" })).toHaveProperty("error");
    expect(client.updateEvent).not.toHaveBeenCalled();
  });

  it("returns client failures as { error }", async () => {
    const { client, tools } = fakeClient(workout);
    client.updateEvent.mockRejectedValueOnce(new Error("Failed to update calendar event 7 (500)"));
    expect(await run(tools.icu_update_calendar_event, { event_id: "7", name: "Z2" })).toEqual({
      error: "Failed to update calendar event 7 (500)",
    });
  });
});

describe("icu_delete_calendar_event", () => {
  it("deletes an upcoming workout and reports what was removed", async () => {
    const { client, tools } = fakeClient(workout);
    const result = await run(tools.icu_delete_calendar_event, { event_id: "7" });
    expect(client.deleteEvent).toHaveBeenCalledWith("7");
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
      expect(await run(tools.icu_delete_calendar_event, { event_id: "7" })).toHaveProperty("error");
      expect(client.deleteEvent).not.toHaveBeenCalled();
    }
  });

  it("returns a missing event as { error }", async () => {
    const { client, tools } = fakeClient(workout);
    client.getEvent.mockRejectedValueOnce(new Error("Failed to fetch calendar event 7 (404)"));
    expect(await run(tools.icu_delete_calendar_event, { event_id: "7" })).toEqual({
      error: "Failed to fetch calendar event 7 (404)",
    });
  });
});

describe("athlete binding", () => {
  const ATHLETE = "i12345";
  const INVENTED = { athlete_id: "USER_A123" };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // GET /events/{id} returns the workout, other GETs an empty list, writes echo their body.
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return new Response(null, { status: 200 });
      if (init?.body) return Response.json({ ...workout, ...JSON.parse(String(init.body)) });
      return Response.json(/\/events\/\d+$/.test(new URL(url).pathname) ? workout : []);
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const bound = () => getIntervalsTools(new IntervalsClient("key", ATHLETE));
  const exec = (t: object, input: unknown) => run(t as { execute?: (input: unknown, options: never) => unknown }, input);
  const paths = () => fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);
  const bodies = () => fetchMock.mock.calls.flatMap(([, init]) => (init?.body ? [JSON.parse(String(init.body))] : []));

  it("has no athlete_id input on any tool", () => {
    for (const [name, t] of Object.entries(bound())) {
      const shape = (t.inputSchema as unknown as { shape: Record<string, unknown> }).shape;
      expect(Object.keys(shape), name).not.toContain("athlete_id");
    }
  });

  it("drops a model-invented athlete_id when parsing input", () => {
    const schema = bound().icu_create_calendar_event.inputSchema as unknown as {
      parse: (v: unknown) => Record<string, unknown>;
    };
    expect(schema.parse({ name: "VO2", start_date_local: "2026-09-29T09:00:00", ...INVENTED })).not.toHaveProperty(
      "athlete_id"
    );
  });

  it("only reaches the bound athlete and never forwards athlete_id, whatever the input says", async () => {
    // Approved write calls run with the input stored in the chat, which isn't re-parsed and may predate the schema.
    const t = bound();
    await exec(t.icu_get_fitness_summary, { athlete_id: "default_value" });
    await exec(t.icu_get_wellness_data, { athlete_id: "example_athlete" });
    await exec(t.icu_get_recent_activities, { ...INVENTED, limit: 5 });
    await exec(t.icu_get_calendar_events, INVENTED);
    await exec(t.icu_create_calendar_event, { ...INVENTED, name: "VO2", start_date_local: "2026-09-29T09:00:00", type: "Ride", category: "WORKOUT" });
    await exec(t.icu_update_calendar_event, { ...INVENTED, event_id: "7", name: "Z2" });
    await exec(t.icu_delete_calendar_event, { ...INVENTED, event_id: "7" });
    await exec(t.create_gym_session, {
      ...INVENTED,
      name: "Gym",
      start_date_local: "2026-09-29T18:00:00",
      exercises: [{ name: "Squat (Barbell)", sets: 3, reps: 5 }],
    });
    expect(paths().length).toBeGreaterThanOrEqual(9);
    for (const path of paths()) expect(path).toMatch(new RegExp(`^/api/v1/athlete/${ATHLETE}/`));
    expect(bodies()).toHaveLength(3);
    for (const body of bodies()) expect(body).not.toHaveProperty("athlete_id");
  });

  it("still validates stored history whose tool inputs carry athlete_id", async () => {
    const stored: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "Add a VO2 ride" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-icu_get_fitness_summary",
            toolCallId: "call-read",
            state: "output-available",
            input: { athlete_id: "default_value" },
            output: { ctl: 50 },
          },
          {
            type: "tool-icu_create_calendar_event",
            toolCallId: "call-write",
            state: "output-available",
            input: { ...INVENTED, name: "VO2", start_date_local: "2026-09-29T09:00:00", type: "Ride", category: "WORKOUT" },
            output: { id: 7 },
          },
        ],
      } as UIMessage,
    ];
    expect((await safeValidateUIMessages({ messages: stored, tools: bound() })).success).toBe(true);
  });
});
