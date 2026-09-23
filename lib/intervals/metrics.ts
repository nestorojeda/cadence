import type { FitnessSummary } from "./client";

/** Shape returned by GET /api/metrics, consumed by the sidebar and the chat's empty state. */
export interface MetricsResponse {
  athlete: { id: string; name: string; firstname: string } | null;
  fitness: FitnessSummary | null;
  /** Daily form (TSB), oldest first, for the last ~42 days. */
  formHistory: Array<{ date: string; tsb: number }>;
  /** Planned calendar events for the current Monday–Sunday week. */
  week: WeekEvent[];
  /** Monday of the current week, YYYY-MM-DD. */
  weekStart: string;
}

export interface WeekEvent {
  date: string; // YYYY-MM-DD
  name: string;
  type?: string;
  category: string;
  movingTime?: number; // seconds
  load?: number; // TSS
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

const ZONE_COLORS = ["#94a3b8", "#38bdf8", "#4ade80", "#facc15", "#fb923c"];

/**
 * Colour for a planned session's dot: the intensity zone implied by load per hour
 * (TSS/h ≈ IF² × 100), purple for strength work, neutral when there's nothing to go on.
 */
export function eventZoneColor(event: WeekEvent): string {
  if (/weight|strength|gym/i.test(`${event.type ?? ""} ${event.name}`)) return "#c084fc";
  if (!event.load || !event.movingTime) return "#3a3c36";
  const intensity = Math.sqrt(event.load / ((event.movingTime / 3600) * 100));
  const bounds = [0.55, 0.75, 0.9, 1.05];
  const zone = bounds.findIndex((b) => intensity < b);
  return ZONE_COLORS[zone === -1 ? 4 : zone];
}

/** Local-date YYYY-MM-DD (toISOString would shift to UTC). */
export function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}
