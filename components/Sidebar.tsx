"use client";

import React from "react";
import { PanelLeftClose, PanelLeftOpen, RefreshCw, Settings, SlidersHorizontal } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { CadenceMark } from "@/components/CadenceMark";
import {
  FORM_LABELS,
  eventZoneColor,
  formatDuration,
  formatSigned,
  toLocalDate,
  type MetricsResponse,
} from "@/lib/intervals/metrics";

interface SidebarProps {
  athleteId: string;
  metrics: MetricsResponse | null;
  loading: boolean;
  modelLabel: string;
  /** Narrow icon rail instead of the full sidebar. */
  compact: boolean;
  onToggleCompact: () => void;
  onRefresh: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
}

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-2">
      <CadenceMark size={size === "sm" ? 16 : 20} />
      <span className={`font-semibold tracking-tight ${size === "sm" ? "text-base" : "text-lg"}`}>{APP_NAME}</span>
    </div>
  );
}

/** True when form is in a range worth flagging rather than celebrating. */
function isFormWarning(metrics: MetricsResponse | null) {
  const status = metrics?.fitness?.form_status;
  return status === "fatigued" || status === "very_fatigued";
}

export function Sidebar({
  athleteId,
  metrics,
  loading,
  modelLabel,
  compact,
  onToggleCompact,
  onRefresh,
  onOpenRules,
  onOpenSettings,
}: SidebarProps) {
  const fitness = metrics?.fitness;
  const athleteName = metrics?.athlete?.name || athleteId;
  const initials = athleteName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const intervalsHref = `https://intervals.icu/athlete/${athleteId}`;

  if (compact) {
    const tsbTitle = fitness
      ? `Form ${fitness.tsb != null ? formatSigned(fitness.tsb) : "—"} · ${FORM_LABELS[fitness.form_status]} — CTL ${
          fitness.ctl != null ? Math.round(fitness.ctl) : "—"
        }, ATL ${fitness.atl != null ? Math.round(fitness.atl) : "—"}`
      : "Form";
    return (
      <aside className="hidden lg:flex w-[68px] shrink-0 flex-col items-center gap-6 border-r border-ink-line bg-ink-rail pt-5 pb-5 h-screen sticky top-0 overflow-y-auto">
        <div className="flex flex-col items-center gap-3">
          <CadenceMark size={20} />
          <IconButton label="Expand sidebar" onClick={onToggleCompact}>
            <PanelLeftOpen className="w-4 h-4" />
          </IconButton>
        </div>

        {/* Form */}
        <div className="flex flex-col items-center gap-1" title={tsbTitle}>
          <span className="font-display font-bold text-[28px] leading-none">
            {fitness?.tsb != null ? formatSigned(fitness.tsb) : "—"}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-fg-muted">
            {fitness && (
              <span className={`w-1.5 h-1.5 rounded-full ${isFormWarning(metrics) ? "bg-signal-warn" : "bg-signal"}`} />
            )}
            TSB
          </span>
        </div>

        {/* Week */}
        {metrics && (
          <div className="flex flex-col items-center gap-0.5" aria-label="This week">
            {weekDays(metrics).map((day) => (
              <div
                key={day.label}
                title={`${day.label}: ${day.first ? `${day.events.map((e) => e.name).join(" + ")} (${formatDuration(day.duration)})` : "Rest"}`}
                aria-current={day.isToday ? "date" : undefined}
                className={`flex items-center gap-2 h-7 px-2 rounded-md ${day.isToday ? "bg-ink-raised" : ""}`}
              >
                <span className="w-2.5 font-mono text-[10px] text-fg-muted">{day.label[0]}</span>
                <span
                  className={`w-2 h-2 rounded-[2px] ${day.first ? "" : "border border-ink-edge"}`}
                  style={day.first ? { background: eventZoneColor(day.first) } : undefined}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex-1" />

        <div className="flex flex-col items-center gap-1">
          <a
            href={intervalsHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Intervals.icu"
            title="Open Intervals.icu"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-ink-raised transition"
          >
            <IntervalsIcon />
          </a>
          <IconButton label="Coach rules" onClick={onOpenRules}>
            <SlidersHorizontal className="w-4 h-4" />
          </IconButton>
          <IconButton label={`Settings (${modelLabel})`} onClick={onOpenSettings}>
            <Settings className="w-4 h-4" />
          </IconButton>
          <div
            title={`${athleteName} · ${athleteId}`}
            className="mt-2 w-7 h-7 rounded-full bg-ink-line flex items-center justify-center text-[11px] font-semibold"
          >
            {initials}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex w-[300px] shrink-0 flex-col gap-7 border-r border-ink-line bg-ink-rail px-6 pt-6 pb-5 h-screen sticky top-0 overflow-y-auto">
      <div className="flex items-center justify-between">
        <Wordmark />
        <div className="flex items-center gap-0.5 -mr-2">
          <a
            href={intervalsHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Intervals.icu"
            title="Open Intervals.icu"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-ink-raised transition"
          >
            <IntervalsIcon />
          </a>
          <IconButton label="Collapse sidebar" onClick={onToggleCompact} size="sm">
            <PanelLeftClose className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      {/* Form */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">Form today</span>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh from Intervals.icu"
            className="flex items-center gap-1.5 font-mono text-[11px] text-fg-muted hover:text-fg transition"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {fitness?.date ? fitness.date.slice(5).replace("-", "/") : "sync"}
          </button>
        </div>
        <div className="flex items-end gap-3">
          <span className="font-display font-bold text-[72px] leading-[0.85]">
            {fitness?.tsb != null ? formatSigned(fitness.tsb) : "—"}
          </span>
          {fitness && (
            <div className="flex flex-col gap-0.5 pb-1">
              <span className={`text-sm font-semibold ${isFormWarning(metrics) ? "text-signal-warn" : "text-signal"}`}>
                {FORM_LABELS[fitness.form_status]}
              </span>
              <span className="text-xs text-fg-muted">TSB · form</span>
            </div>
          )}
        </div>
        <FormSparkline points={metrics?.formHistory ?? []} />
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Fitness · CTL" value={fitness?.ctl} />
          <Stat label="Fatigue · ATL" value={fitness?.atl} />
        </div>
      </section>

      {/* Week */}
      <section className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">This week</span>
        <WeekList metrics={metrics} />
      </section>

      <div className="flex-1" />

      <section className="flex flex-col gap-1.5">
        <RailButton icon={SlidersHorizontal} label="Coach rules" onClick={onOpenRules} />
        <RailButton icon={Settings} label="Settings" detail={modelLabel} onClick={onOpenSettings} />
        <div className="flex items-center gap-2.5 px-2.5 pt-3 mt-1.5 border-t border-ink-line">
          <div className="w-7 h-7 rounded-full bg-ink-line flex items-center justify-center text-[11px] font-semibold">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] truncate">{athleteName}</span>
            <span className="font-mono text-[11px] text-fg-muted">{athleteId}</span>
          </div>
        </div>
      </section>
    </aside>
  );
}

/** Compact top bar for screens without the rail. */
export function MobileBar({
  metrics,
  onOpenRules,
  onOpenSettings,
}: Pick<SidebarProps, "metrics" | "onOpenRules" | "onOpenSettings">) {
  const tsb = metrics?.fitness?.tsb;
  return (
    <header className="lg:hidden sticky top-0 z-30 h-[60px] flex items-center justify-between px-4 border-b border-ink-hair bg-ink/95 backdrop-blur">
      <Wordmark size="sm" />
      <div className="flex items-center gap-1">
        {tsb != null && (
          <span className="h-9 flex items-center gap-2 px-3 mr-1 border border-ink-line rounded-full font-mono text-xs">
            <span className="text-fg-muted">TSB</span>
            <span>{formatSigned(tsb)}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isFormWarning(metrics) ? "bg-signal-warn" : "bg-signal"}`} />
          </span>
        )}
        <button
          onClick={onOpenRules}
          aria-label="Coach rules"
          className="w-11 h-11 flex items-center justify-center rounded-lg text-fg-muted hover:text-fg"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          className="w-11 h-11 flex items-center justify-center rounded-lg text-fg-muted hover:text-fg"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

/** The pulse line from the Intervals.icu app icon, for the link to the athlete's calendar. */
function IntervalsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <polyline
        points="1,11.9 5.8,11.9 7.3,8.2 10,15.4 12.8,4.4 14.8,11.7 19,11.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconButton({
  label,
  onClick,
  size = "md",
  children,
}: {
  label: string;
  onClick: () => void;
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${size === "sm" ? "w-8 h-8" : "w-10 h-10"} flex items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-ink-raised transition`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="px-3 py-2.5 border border-ink-line rounded-[10px] flex flex-col gap-0.5">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span className="font-mono text-lg font-medium">{value != null ? Math.round(value) : "—"}</span>
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 h-10 px-2.5 rounded-lg text-[13px] text-left hover:bg-ink-raised transition"
    >
      <Icon className="w-4 h-4 text-fg-muted" />
      <span className="flex-1">{label}</span>
      {detail && <span className="font-mono text-[11px] text-fg-muted truncate max-w-[130px]">{detail}</span>}
    </button>
  );
}

function FormSparkline({ points }: { points: Array<{ tsb: number }> }) {
  const width = 252;
  const height = 56;
  if (points.length < 2) {
    return <div style={{ height }} className="border-y border-dashed border-ink-line" />;
  }
  const values = points.map((p) => p.tsb);
  // Keep zero on the chart so the dashed baseline always means "neutral form".
  const max = Math.max(...values, 0) + 2;
  const min = Math.min(...values, 0) - 2;
  const y = (v: number) => ((max - v) / (max - min)) * height;
  const x = (i: number) => (i / (points.length - 1)) * width;
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" role="img" aria-label="Form, last 6 weeks" className="overflow-visible">
      <line x1="0" y1={y(0)} x2={width} y2={y(0)} stroke="#2e302a" strokeDasharray="2 4" />
      <polyline points={line} stroke="#8c8e85" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={width} cy={y(last)} r="3.5" className="fill-signal" />
    </svg>
  );
}

/** The current Monday–Sunday week, one entry per day with its planned sessions. */
function weekDays(metrics: MetricsResponse) {
  const today = toLocalDate(new Date());
  const start = new Date(`${metrics.weekStart}T00:00:00`);
  return DAY_LABELS.map((label, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = toLocalDate(d);
    const events = metrics.week.filter((e) => e.date === date);
    return {
      label,
      events,
      first: events[0],
      isToday: date === today,
      duration: events.reduce((sum, e) => sum + (e.movingTime ?? 0), 0),
    };
  });
}

function WeekList({ metrics }: { metrics: MetricsResponse | null }) {
  if (!metrics) {
    return <div className="text-xs text-fg-muted px-2">Loading calendar…</div>;
  }

  return (
    <div className="flex flex-col">
      {weekDays(metrics).map(({ label, events, first, isToday, duration }) => (
        <div
          key={label}
          className={`flex items-center gap-3 h-[34px] px-2 rounded-lg ${isToday ? "bg-ink-raised" : ""}`}
          aria-current={isToday ? "date" : undefined}
        >
          <span className="w-7 font-mono text-[11px] text-fg-muted">{label}</span>
          <span
            className="w-2 h-2 rounded-[2px] shrink-0"
            style={{ background: first ? eventZoneColor(first) : "transparent" }}
          />
          <span className={`flex-1 min-w-0 truncate text-[13px] ${first ? (isToday ? "text-fg" : "text-fg-soft") : "text-fg-muted"}`}>
            {first ? first.name : "Rest"}
            {events.length > 1 && <span className="text-fg-muted"> +{events.length - 1}</span>}
          </span>
          <span className="font-mono text-[11px] text-fg-muted">{first ? formatDuration(duration) : ""}</span>
        </div>
      ))}
    </div>
  );
}
