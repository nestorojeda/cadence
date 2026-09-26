import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { eventsBeforeWrites, wroteToCalendar } from "./known-events";

type Part = UIMessage["parts"][number];

const read = (id: string, output: unknown): Part =>
  ({ type: "tool-icu_get_calendar_events", toolCallId: id, state: "output-available", input: {}, output }) as Part;
const update = (id: string, input: object, state = "output-available", output?: unknown): Part =>
  ({ type: "tool-icu_update_calendar_event", toolCallId: id, state, input, output }) as Part;
const remove = (id: string, input: object): Part =>
  ({ type: "tool-icu_delete_calendar_event", toolCallId: id, state: "approval-requested", input, approval: { id: `a-${id}` } }) as Part;
const coach = (id: string, parts: Part[]) => ({ id, role: "assistant", parts }) as UIMessage;

const vo2 = { id: 7, name: "VO2", start_date_local: "2026-09-29T09:00:00", category: "WORKOUT" };

describe("eventsBeforeWrites", () => {
  it("gives each change the event as last read before it", () => {
    const messages = [
      coach("m1", [
        read("r1", [vo2, { id: 8, name: "Long ride", start_date_local: "2026-10-03T08:00:00" }]),
        update("u1", { event_id: "7", start_date_local: "2026-09-30T09:00:00" }, "output-available", {
          id: 7,
          name: "VO2",
          start_date_local: "2026-09-30T09:00:00",
        }),
      ]),
      coach("m2", [update("u2", { event_id: "7", name: "Endurance" }, "approval-requested"), remove("d1", { event_id: "8" })]),
    ];
    const before = eventsBeforeWrites(messages);
    expect(before.get("u1")).toEqual(vo2);
    // The second change starts from the first one's result.
    expect(before.get("u2")).toMatchObject({ name: "VO2", start_date_local: "2026-09-30T09:00:00", category: "WORKOUT" });
    expect(before.get("d1")).toMatchObject({ name: "Long ride" });
  });

  it("skips events it never read and ignores failed updates and read errors", () => {
    const messages = [
      coach("m1", [
        read("r1", { error: "timeout" }),
        read("r2", [vo2]),
        update("u1", { event_id: "7", name: "Z2" }, "output-available", { error: "Failed to update" }),
        update("u2", { event_id: "99", name: "Z2" }, "approval-requested"),
      ]),
      coach("m2", [update("u3", { event_id: "7", name: "Tempo" }, "approval-requested")]),
    ];
    const before = eventsBeforeWrites(messages);
    expect(before.has("u2")).toBe(false);
    expect(before.get("u3")).toEqual(vo2);
  });
});

describe("wroteToCalendar", () => {
  it("is true only for a write that went through", () => {
    expect(wroteToCalendar(coach("m1", [update("u1", { event_id: "7" }, "output-available", vo2)]))).toBe(true);
    expect(wroteToCalendar(coach("m1", [update("u1", { event_id: "7" }, "output-available", { error: "past" })]))).toBe(false);
    expect(wroteToCalendar(coach("m1", [remove("d1", { event_id: "7" })]))).toBe(false);
    expect(wroteToCalendar(coach("m1", [read("r1", [vo2])]))).toBe(false);
  });
});
