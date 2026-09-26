import type { CalendarEvent, IntervalsClient } from "./client";
import { daysFromToday } from "./compact";
import { toLocalDate, type KeyEvent } from "./metrics";

/**
 * Races and time off from the Intervals.icu calendar. They sit weeks or months out, beyond the calendar tool's default
 * window, so the chat route puts them in the system prompt and the sidebar shows the next ones.
 */

export const RACE_CATEGORIES = ["RACE_A", "RACE_B", "RACE_C"];
export const BLOCK_CATEGORIES = ["HOLIDAY", "SICK", "INJURED"];

/** How far ahead key events are read: about half a season. */
const HORIZON_DAYS = 182;
/** Blocks that started up to this long ago may still be under way. */
const LOOKBACK_DAYS = 30;
const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, { at: number; events: KeyEvent[] }>();

function dayDiff(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000);
}

function toKeyEvent(e: CalendarEvent, today: string): KeyEvent | null {
  const race = RACE_CATEGORIES.includes(e.category);
  if (!race && !BLOCK_CATEGORIES.includes(e.category)) return null;
  const date = e.start_date_local.slice(0, 10);
  // end_date_local is exclusive for all-day events (a one-day race ends at 00:00 the next day).
  let lastDate = date;
  if (e.end_date_local) {
    const end = new Date(`${e.end_date_local.slice(0, 10)}T00:00:00`);
    if (e.end_date_local.slice(11) === "00:00:00") end.setDate(end.getDate() - 1);
    const endDate = toLocalDate(end);
    if (endDate > date) lastDate = endDate;
  }
  if ((race ? date : lastDate) < today) return null;
  const description = e.description?.trim();
  return {
    id: e.id,
    kind: race ? "race" : "block",
    category: e.category,
    ...(race ? { priority: e.category.slice(-1) as KeyEvent["priority"] } : {}),
    name: e.name,
    date,
    ...(lastDate !== date ? { lastDate } : {}),
    daysOut: dayDiff(today, date),
    ...(e.type ? { type: e.type } : {}),
    ...(e.distance ? { distanceKm: Math.round(e.distance / 100) / 10 } : {}),
    ...(e.moving_time ? { movingTime: e.moving_time } : {}),
    ...(description ? { description: description.length > 200 ? `${description.slice(0, 200)}…` : description } : {}),
    ...(e.training_availability && e.training_availability !== "NORMAL" ? { unavailable: true } : {}),
  };
}

/** Upcoming races and current/upcoming blocks, soonest first. Cached briefly per athlete. */
export async function getKeyEvents(client: IntervalsClient, athleteId: string): Promise<KeyEvent[]> {
  const hit = cache.get(athleteId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.events;

  const today = daysFromToday(0);
  const events = await client.getEvents(daysFromToday(-LOOKBACK_DAYS), daysFromToday(HORIZON_DAYS));
  const keyEvents = events
    .map((e) => toKeyEvent(e, today))
    .filter((e): e is KeyEvent => e !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  cache.set(athleteId, { at: Date.now(), events: keyEvents });
  return keyEvents;
}
