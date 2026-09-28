import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent, IntervalsClient } from "./client";
import { editBlockReason, getKeyEvents } from "./events";

let athlete = 0;
const nextAthlete = () => `i${++athlete}`;

function fakeClient(events: Array<Partial<CalendarEvent> & Pick<CalendarEvent, "category" | "start_date_local">>) {
  const getEvents = vi.fn(async () => events.map((e, i) => ({ id: i + 1, name: `Event ${i + 1}`, ...e })));
  return { client: { getEvents } as unknown as IntervalsClient, getEvents };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 26, 12)); // 2026-09-26
});
afterEach(() => {
  vi.useRealTimers();
});

describe("getKeyEvents", () => {
  it("keeps races and time off, drops other categories and past races, sorts by date", async () => {
    const { client } = fakeClient([
      { category: "WORKOUT", start_date_local: "2026-09-27T00:00:00" },
      {
        category: "RACE_B",
        start_date_local: "2026-11-01T00:00:00",
        end_date_local: "2026-11-02T00:00:00",
        distance: 123_456,
      },
      { category: "RACE_A", start_date_local: "2026-09-20T00:00:00" },
      { category: "RACE_A", start_date_local: "2026-10-10T00:00:00", type: "Ride", moving_time: 14_400 },
    ]);
    const events = await getKeyEvents(client, nextAthlete());
    expect(events.map((e) => [e.category, e.date])).toEqual([
      ["RACE_A", "2026-10-10"],
      ["RACE_B", "2026-11-01"],
    ]);
    expect(events[0]).toMatchObject({ kind: "race", priority: "A", daysOut: 14, type: "Ride", movingTime: 14_400 });
    // Exclusive midnight end: a one-day race has no lastDate.
    expect(events[1]).toMatchObject({ priority: "B", distanceKm: 123.5 });
    expect(events[1].lastDate).toBeUndefined();
  });

  it("keeps a block already under way, with its inclusive last day", async () => {
    const { client } = fakeClient([
      {
        category: "SICK",
        start_date_local: "2026-09-24T00:00:00",
        end_date_local: "2026-09-29T00:00:00",
        training_availability: "UNAVAILABLE",
      },
      { category: "HOLIDAY", start_date_local: "2026-09-10T00:00:00", end_date_local: "2026-09-15T00:00:00" },
    ]);
    const [block, ...rest] = await getKeyEvents(client, nextAthlete());
    expect(rest).toEqual([]);
    expect(block).toMatchObject({
      kind: "block",
      date: "2026-09-24",
      lastDate: "2026-09-28",
      daysOut: -2,
      unavailable: true,
    });
    expect(block.priority).toBeUndefined();
  });

  it("truncates long descriptions", async () => {
    const { client } = fakeClient([
      { category: "RACE_C", start_date_local: "2026-10-01T00:00:00", description: "x".repeat(250) },
    ]);
    const [race] = await getKeyEvents(client, nextAthlete());
    expect(race.description).toBe(`${"x".repeat(200)}…`);
  });

  it("caches per athlete for five minutes", async () => {
    const { client, getEvents } = fakeClient([{ category: "RACE_A", start_date_local: "2026-10-10T00:00:00" }]);
    const id = nextAthlete();
    await getKeyEvents(client, id);
    await getKeyEvents(client, id);
    expect(getEvents).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await getKeyEvents(client, id);
    expect(getEvents).toHaveBeenCalledTimes(2);
  });
});

describe("editBlockReason", () => {
  const today = "2026-09-26";

  it("allows upcoming workouts and notes, including today's", () => {
    expect(editBlockReason({ category: "WORKOUT", start_date_local: "2026-09-26T09:00:00" }, today)).toBeNull();
    expect(editBlockReason({ category: "NOTE", start_date_local: "2026-10-03T00:00:00" }, today)).toBeNull();
  });

  it("refuses races and time off", () => {
    expect(editBlockReason({ category: "RACE_A", start_date_local: "2026-10-10T00:00:00" }, today)).toMatch(/RACE_A/);
    expect(editBlockReason({ category: "HOLIDAY", start_date_local: "2026-10-10T00:00:00" }, today)).toMatch(/athlete/);
  });

  it("refuses past and completed sessions", () => {
    expect(editBlockReason({ category: "WORKOUT", start_date_local: "2026-09-25T09:00:00" }, today)).toMatch(/past/);
    expect(
      editBlockReason(
        { category: "WORKOUT", start_date_local: "2026-09-26T09:00:00", paired_activity_id: "i123" },
        today,
      ),
    ).toMatch(/already been done/);
  });
});
