import { formatDuration, intensityZoneColor, NO_ZONE_COLOR, toLocalDate } from "@/lib/intervals/metrics";
import { isOnPlan, type ReportMetrics } from "@/lib/reports/types";

export function sessionColor(metrics: ReportMetrics): string {
  return metrics.intensity ? intensityZoneColor(metrics.intensity) : NO_ZONE_COLOR;
}

export function complianceClass(compliance?: number): string {
  if (compliance === undefined) return "text-fg-muted";
  return isOnPlan(compliance) ? "text-signal" : "text-signal-warn";
}

export function shortDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()}`;
}

export function longDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

export function sessionLine(date: string, metrics: ReportMetrics): string {
  return [
    shortDay(date),
    metrics.movingTime ? formatDuration(metrics.movingTime) : null,
    metrics.load ? `${Math.round(metrics.load)} TSS` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function weekGroup(date: string, now = new Date()): "This week" | "Last week" | "Earlier" {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const thisWeek = toLocalDate(monday);
  monday.setDate(monday.getDate() - 7);
  const lastWeek = toLocalDate(monday);
  return date >= thisWeek ? "This week" : date >= lastWeek ? "Last week" : "Earlier";
}
