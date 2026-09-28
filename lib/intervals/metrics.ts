import type { FitnessSummary } from "./client";
import { POWER_ZONE_COLORS } from "./workout";

export interface MetricsResponse {
  athlete: { id: string; name: string; firstname: string } | null;
  fitness: FitnessSummary | null;
  formHistory: Array<{ date: string; tsb: number }>;
  week: WeekEvent[];
  unplanned: WeekActivity[];
  weekStart: string;
  keyEvents: KeyEvent[] | null;
}

export interface KeyEvent {
  id: number;
  kind: "race" | "block";
  category: string;
  priority?: "A" | "B" | "C";
  name: string;
  date: string; // YYYY-MM-DD, first day
  /** Inclusive. */
  lastDate?: string;
  /** Negative for a block already under way. */
  daysOut: number;
  type?: string;
  distanceKm?: number;
  movingTime?: number; // seconds
  description?: string;
  unavailable?: boolean;
}

export function formatCountdown(daysOut: number): string {
  if (daysOut <= 0) return "today";
  if (daysOut === 1) return "tomorrow";
  if (daysOut < 21) return `${daysOut} d`;
  return `${Math.round(daysOut / 7)} wk`;
}

export interface WeekEvent {
  id: number;
  date: string; // YYYY-MM-DD
  name: string;
  type?: string;
  category: string;
  movingTime?: number; // seconds
  load?: number; // TSS
  completed?: WeekActivity;
}

export interface WeekActivity {
  date: string; // YYYY-MM-DD
  name: string;
  type?: string;
  movingTime?: number; // seconds
  load?: number; // TSS
  /** A fraction, e.g. 0.78. */
  intensity?: number;
}

export const FORM_LABELS: Record<FitnessSummary["form_status"], string> = {
  very_fresh: "Very fresh",
  recovered: "Fresh",
  optimal: "Productive",
  fatigued: "Fatigued",
  very_fatigued: "Overreached",
};

export function formatSigned(value: number): string {
  const n = Math.round(value);
  if (n < 0) return `−${Math.abs(n)}`;
  if (n > 0) return `+${n}`;
  return "0";
}

export function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export const NO_ZONE_COLOR = "rgb(var(--zone-none))";

const ZONE_COLORS = POWER_ZONE_COLORS.slice(0, 5);
export const STRENGTH_COLOR = POWER_ZONE_COLORS[6];
const INTENSITY_BOUNDS = [0.55, 0.75, 0.9, 1.05];

export const ZONE_LEGEND = [
  ...["Z1", "Z2", "Z3", "Z4", "Z5+"].map((label, i) => ({ label, color: ZONE_COLORS[i] })),
  { label: "Gym", color: STRENGTH_COLOR },
];

export function isStrength(name: string, type?: string): boolean {
  return /weight|strength|gym/i.test(`${type ?? ""} ${name}`);
}

export function intensityZoneColor(intensity: number): string {
  const zone = INTENSITY_BOUNDS.findIndex((b) => intensity < b);
  return ZONE_COLORS[zone === -1 ? ZONE_COLORS.length - 1 : zone];
}

/** TSS/h ≈ IF² × 100. */
function estimatedIntensity(load?: number, movingTime?: number): number | null {
  if (!load || !movingTime) return null;
  return Math.sqrt(load / ((movingTime / 3600) * 100));
}

export function eventZoneColor(event: Omit<WeekEvent, "id" | "completed">): string {
  if (isStrength(event.name, event.type)) return STRENGTH_COLOR;
  const intensity = estimatedIntensity(event.load, event.movingTime);
  return intensity === null ? NO_ZONE_COLOR : intensityZoneColor(intensity);
}

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
