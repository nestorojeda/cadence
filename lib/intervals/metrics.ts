import type { FitnessSummary } from "./client";

/** Shape returned by GET /api/metrics, consumed by the sidebar and the chat's empty state. */
export interface MetricsResponse {
  athlete: { id: string; name: string; firstname: string } | null;
  fitness: FitnessSummary | null;
  /** Daily form (TSB), oldest first, for the last ~42 days. */
  formHistory: Array<{ date: string; tsb: number }>;
  /** Planned calendar events for the current Monday–Sunday week. */
  week: WeekEvent[];
  /** Activities this week that aren't paired with a planned event. */
  unplanned: WeekActivity[];
  /** Monday of the current week, YYYY-MM-DD. */
  weekStart: string;
}

export interface WeekEvent {
  id: number;
  date: string; // YYYY-MM-DD
  name: string;
  type?: string;
  category: string;
  movingTime?: number; // seconds
  load?: number; // TSS
  /** The activity that fulfilled this session, once ridden. */
  completed?: WeekActivity;
}

export interface WeekActivity {
  date: string; // YYYY-MM-DD
  name: string;
  type?: string;
  movingTime?: number; // seconds
  load?: number; // TSS
  /** Intensity factor as a fraction (0.78), when Intervals.icu computed one. */
  intensity?: number;
}

export const FORM_LABELS: Record<FitnessSummary["form_status"], string> = {
  very_fresh: "Very fresh",
  recovered: "Fresh",
  optimal: "Productive",
  fatigued: "Fatigued",
  very_fatigued: "Overreached",
};

/** Formats a signed number with a true minus sign (−8, +4, 0). */
export function formatSigned(value: number): string {
  const n = Math.round(value);
  if (n < 0) return `−${Math.abs(n)}`;
  if (n > 0) return `+${n}`;
  return "0";
}

/** h:mm from seconds. */
export function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

/** Sessions with no intensity to go on; a CSS variable so it follows the color mode. */
export const NO_ZONE_COLOR = "rgb(var(--zone-none))";

const ZONE_COLORS = ["#94a3b8", "#38bdf8", "#4ade80", "#facc15", "#fb923c"];
const STRENGTH_COLOR = "#c084fc";
/** Upper IF bound of Z1–Z4; anything above is Z5+. */
const INTENSITY_BOUNDS = [0.55, 0.75, 0.9, 1.05];

/** Key for the week list's colours. */
export const ZONE_LEGEND = [
  ...["Z1", "Z2", "Z3", "Z4", "Z5+"].map((label, i) => ({ label, color: ZONE_COLORS[i] })),
  { label: "Gym", color: STRENGTH_COLOR },
];

export function isStrength(name: string, type?: string): boolean {
  return /weight|strength|gym/i.test(`${type ?? ""} ${name}`);
}

/** Zone colour for an intensity factor. */
export function intensityZoneColor(intensity: number): string {
  const zone = INTENSITY_BOUNDS.findIndex((b) => intensity < b);
  return ZONE_COLORS[zone === -1 ? ZONE_COLORS.length - 1 : zone];
}

/** IF estimated from load per hour (TSS/h ≈ IF² × 100); null when there's nothing to go on. */
function estimatedIntensity(load?: number, movingTime?: number): number | null {
  if (!load || !movingTime) return null;
  return Math.sqrt(load / ((movingTime / 3600) * 100));
}

/**
 * Colour for a planned session: the intensity zone implied by its load per hour, purple for strength work, neutral
 * when there's nothing to go on.
 */
export function eventZoneColor(event: Omit<WeekEvent, "id" | "completed">): string {
  if (isStrength(event.name, event.type)) return STRENGTH_COLOR;
  const intensity = estimatedIntensity(event.load, event.movingTime);
  return intensity === null ? NO_ZONE_COLOR : intensityZoneColor(intensity);
}

/** Colour for a ridden session: its measured IF, or the load-per-hour estimate when there is none. */
export function activityZoneColor(activity: WeekActivity): string {
  if (isStrength(activity.name, activity.type)) return STRENGTH_COLOR;
  const intensity = activity.intensity ?? estimatedIntensity(activity.load, activity.movingTime);
  return intensity == null ? NO_ZONE_COLOR : intensityZoneColor(intensity);
}

/** Local-date YYYY-MM-DD (toISOString would shift to UTC). */
export function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}
