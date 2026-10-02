import { addDays, daysFromToday } from "./timezone";

type Row = Record<string, unknown>;

export const MAX_WELLNESS_DAYS = 90;
export const MAX_EVENT_DAYS = 62;
const MAX_EVENT_DESCRIPTION_CHARS = 600;

function round(value: unknown): unknown {
  return typeof value === "number" && !Number.isInteger(value) ? Math.round(value * 10) / 10 : value;
}

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

export function wellnessRange(oldest?: string, newest?: string, timeZone?: string): { oldest: string; newest: string } {
  const end = newest || daysFromToday(0, timeZone);
  const floor = addDays(end, -(MAX_WELLNESS_DAYS - 1));
  const start = oldest || daysFromToday(-13, timeZone);
  return { oldest: start < floor ? floor : start, newest: end };
}

export function eventsRange(oldest?: string, newest?: string, timeZone?: string): { oldest: string; newest: string } {
  const start = oldest || daysFromToday(-7, timeZone);
  const end = newest || daysFromToday(14, timeZone);
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
      // Exclusive; only worth sending for multi-day events.
      ...(isMultiDay(e) ? ["end_date_local"] : []),
      "category",
      "type",
      "name",
      "moving_time",
      "distance",
      "icu_training_load",
      "icu_intensity",
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

const MAX_INTERVALS = 60;

/** The activity's laps/intervals from `/activity/{id}/intervals`, trimmed to what a session review needs. */
export function compactIntervals(intervals: Row[]): Row[] {
  return intervals
    .slice(0, MAX_INTERVALS)
    .map((i) =>
      pick(i, [
        "type",
        "label",
        "moving_time",
        "average_watts",
        ["weighted_average_watts", "normalized_power"],
        ["intensity", "percent_ftp"],
        "zone",
        "average_heartrate",
        "max_heartrate",
        "average_cadence",
        "decoupling",
      ]),
    );
}
