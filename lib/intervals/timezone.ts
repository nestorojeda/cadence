import type { IntervalsClient } from "./client";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; timeZone: string | undefined }>();

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The athlete's IANA time zone from their Intervals.icu profile; undefined (server time) when it can't be loaded. */
export async function getAthleteTimeZone(client: IntervalsClient, athleteId: string): Promise<string | undefined> {
  const hit = cache.get(athleteId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.timeZone;
  try {
    const { timezone } = await client.getAthlete();
    const timeZone = timezone && isValidTimeZone(timezone) ? timezone : undefined;
    cache.set(athleteId, { at: Date.now(), timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

/** YYYY-MM-DD of `now` in `timeZone`, or in the server's time zone when none is given. */
export function dateInZone(now: Date, timeZone?: string): string {
  if (!timeZone) {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function weekdayName(date: string, style: "long" | "short" = "long"): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: style, timeZone: "UTC" });
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function daysFromToday(days: number, timeZone?: string, now = new Date()): string {
  return addDays(dateInZone(now, timeZone), days);
}
