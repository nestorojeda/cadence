import { toLocalDate } from "./metrics";

/**
 * Trims Intervals.icu API objects to what the coach uses before they go to the model. Raw responses are large (dozens
 * of fields per record, full-precision floats, `workout_doc` trees), and each tool result is re-sent on every step of a
 * turn, so this is the main lever on token cost.
 */

type Row = Record<string, unknown>;

/** Most wellness days the coach can request at once. */
export const MAX_WELLNESS_DAYS = 90;
/** Most calendar days the coach can request at once (races and time off further out are in the system prompt). */
export const MAX_EVENT_DAYS = 62;
/** Longest event description sent; structured workouts fit, long free-text notes are cut. */
const MAX_EVENT_DESCRIPTION_CHARS = 600;

function round(value: unknown): unknown {
  return typeof value === "number" && !Number.isInteger(value) ? Math.round(value * 10) / 10 : value;
}

/** Copies `keys` from `source` (renamed when given as [from, to]), dropping empty values and rounding decimals. */
function pick(source: Row, keys: Array<string | [string, string]>): Row {
  const out: Row = {};
  for (const key of keys) {
    const [from, to] = typeof key === "string" ? [key, key] : key;
    const value = source[from];
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    out[to] = round(value);
  }
  return out;
}

export function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

/** Date range for a wellness request: the last 14 days by default, never longer than MAX_WELLNESS_DAYS. */
export function wellnessRange(oldest?: string, newest?: string): { oldest: string; newest: string } {
  const end = newest || daysFromToday(0);
  const earliest = new Date(`${end}T00:00:00`);
  earliest.setDate(earliest.getDate() - (MAX_WELLNESS_DAYS - 1));
  const floor = toLocalDate(earliest);
  const start = oldest || daysFromToday(-13);
  return { oldest: start < floor ? floor : start, newest: end };
}

/** `date` (YYYY-MM-DD) moved by `days`, in local time. */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

/**
 * Date range for a calendar request: 7 days back to 14 ahead by default, never longer than MAX_EVENT_DAYS from
 * `oldest` (a longer request is cut at the end, so the coach pages forward with a later `oldest`).
 */
export function eventsRange(oldest?: string, newest?: string): { oldest: string; newest: string } {
  const start = oldest || daysFromToday(-7);
  const end = newest || daysFromToday(14);
  const latest = addDays(start, MAX_EVENT_DAYS - 1);
  return { oldest: start, newest: end > latest ? latest : end };
}

export function compactWellness(records: Row[]): Row[] {
  return records.map((r) => {
    const ride = (r.sportInfo as Row[] | undefined)?.find((s) => s.type === "Ride");
    const ctl = typeof r.ctl === "number" ? r.ctl : null;
    const atl = typeof r.atl === "number" ? r.atl : null;
    return {
      ...pick(r, ["id", "ctl", "atl"]),
      ...(ctl !== null && atl !== null ? { form: round(ctl - atl) } : {}),
      ...pick(r, [
        "rampRate",
        "restingHR",
        "hrv",
        "readiness",
        "sleepScore",
        "sleepQuality",
        "avgSleepingHR",
        "soreness",
        "fatigue",
        "stress",
        "mood",
        "motivation",
        "injury",
        "weight",
        "comments",
      ]),
      ...(typeof r.sleepSecs === "number" ? { sleepHours: round(r.sleepSecs / 3600) } : {}),
      ...(ride?.eftp ? { eFTP: Math.round(ride.eftp as number) } : {}),
    };
  });
}

function truncate(value: unknown, max: number): unknown {
  return typeof value === "string" && value.length > max ? `${value.slice(0, max)}…` : value;
}

export function compactEvents(events: Row[]): Row[] {
  return events.map((e) => ({
    ...pick({ ...e, description: truncate(e.description, MAX_EVENT_DESCRIPTION_CHARS) }, [
      "id",
      "start_date_local",
      // Exclusive; only worth sending for events that span several days (holidays, illness).
      ...(isMultiDay(e) ? ["end_date_local"] : []),
      "category",
      "type",
      "name",
      "moving_time",
      "distance",
      "icu_training_load",
      "icu_intensity",
      // Set once a ride has been done against this plan.
      "paired_activity_id",
      "description",
    ]),
    ...(e.training_availability && e.training_availability !== "NORMAL"
      ? { training_availability: e.training_availability }
      : {}),
  }));
}

function isMultiDay(e: Row): boolean {
  const start = typeof e.start_date_local === "string" ? new Date(e.start_date_local) : null;
  const end = typeof e.end_date_local === "string" ? new Date(e.end_date_local) : null;
  return !!start && !!end && end.getTime() - start.getTime() > 86_400_000;
}

const ACTIVITY_FIELDS: Array<string | [string, string]> = [
  "id",
  "start_date_local",
  "type",
  "name",
  "distance",
  "moving_time",
  "total_elevation_gain",
  ["icu_average_watts", "average_watts"],
  ["icu_weighted_avg_watts", "normalized_power"],
  "icu_ftp",
  "icu_intensity",
  "icu_training_load",
  "average_heartrate",
  "max_heartrate",
  "average_cadence",
  "icu_rpe",
  "feel",
];

export function compactActivities(activities: Row[]): Row[] {
  return activities.map((a) => pick(a, ACTIVITY_FIELDS));
}

/** One activity in more depth: the summary plus zone distribution, pacing and interval breakdown. */
export function compactActivityDetails(activity: Row): Row {
  const zoneTimes = activity.icu_zone_times as Array<{ id: string; secs: number }> | undefined;
  return {
    ...pick(activity, [
      ...ACTIVITY_FIELDS,
      "description",
      "calories",
      "icu_variability_index",
      "icu_efficiency_factor",
      "decoupling",
      "icu_power_hr",
      "icu_joules_above_ftp",
      "max_watts",
      "icu_pm_ftp",
      "icu_hr_zone_times",
      "interval_summary",
    ]),
    ...(zoneTimes?.length ? { power_zone_secs: Object.fromEntries(zoneTimes.map((z) => [z.id, z.secs])) } : {}),
  };
}
