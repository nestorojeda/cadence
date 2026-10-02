import { describe, expect, it, vi } from "vitest";
import type { IntervalsClient } from "./client";
import { eventsRange, wellnessRange } from "./compact";
import {
  addDays,
  dateInZone,
  daysBetween,
  daysFromToday,
  getAthleteTimeZone,
  weekdayIndex,
  weekdayName,
} from "./timezone";

let athlete = 0;
const nextAthlete = () => `i${++athlete}`;

describe("dateInZone", () => {
  const instant = new Date("2026-10-02T23:30:00Z");

  it("gives the date in the athlete's zone, not the server's", () => {
    expect(dateInZone(instant, "UTC")).toBe("2026-10-02");
    expect(dateInZone(instant, "Europe/Madrid")).toBe("2026-10-03");
    expect(dateInZone(instant, "America/Denver")).toBe("2026-10-02");
    expect(dateInZone(new Date("2026-10-03T02:00:00Z"), "America/Denver")).toBe("2026-10-02");
  });

  it("drives the default tool ranges", () => {
    expect(daysFromToday(0, "Pacific/Auckland", instant)).toBe("2026-10-03");
    vi.useFakeTimers();
    vi.setSystemTime(instant);
    try {
      expect(eventsRange(undefined, undefined, "Europe/Madrid")).toEqual({
        oldest: "2026-09-26",
        newest: "2026-10-17",
      });
      expect(wellnessRange(undefined, undefined, "Europe/Madrid").newest).toBe("2026-10-03");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("date-string arithmetic", () => {
  it("is unaffected by daylight saving changes", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-20", "2026-11-03")).toBe(14);
  });

  it("names weekdays from the date alone", () => {
    expect(weekdayIndex("2026-10-05")).toBe(0);
    expect(weekdayIndex("2026-10-04")).toBe(6);
    expect(weekdayName("2026-10-02")).toBe("Friday");
    expect(weekdayName("2026-10-02", "short")).toBe("Fri");
  });
});

describe("getAthleteTimeZone", () => {
  const clientWith = (getAthlete: () => Promise<unknown>) => {
    const spy = vi.fn(getAthlete);
    return { client: { getAthlete: spy } as unknown as IntervalsClient, spy };
  };

  it("reads the profile once and caches it", async () => {
    const { client, spy } = clientWith(async () => ({ timezone: "Atlantic/Canary" }));
    const id = nextAthlete();
    expect(await getAthleteTimeZone(client, id)).toBe("Atlantic/Canary");
    expect(await getAthleteTimeZone(client, id)).toBe("Atlantic/Canary");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("falls back to the server's zone for an unknown zone or a failed request, and retries after a failure", async () => {
    expect(await getAthleteTimeZone(clientWith(async () => ({ timezone: "Mars/Olympus" })).client, nextAthlete())).toBe(
      undefined,
    );
    const { client, spy } = clientWith(async () => {
      throw new Error("offline");
    });
    const id = nextAthlete();
    expect(await getAthleteTimeZone(client, id)).toBeUndefined();
    await getAthleteTimeZone(client, id);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
