"use client";

import React from "react";
import {
  Flag,
  History,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  SquarePen,
} from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { CadenceMark } from "@/components/CadenceMark";
import { ThemeCycleButton, ThemeToggle } from "@/components/ThemeToggle";
import {
  FORM_LABELS,
  ZONE_LEGEND,
  activityZoneColor,
  eventZoneColor,
  formatCountdown,
  formatDuration,
  formatSigned,
  toLocalDate,
  type KeyEvent,
  type MetricsResponse,
} from "@/lib/intervals/metrics";
import { formatChatDate, type ChatMeta } from "@/lib/chat/types";

interface SidebarProps {
  athleteId: string;
  metrics: MetricsResponse | null;
  loading: boolean;
  modelLabel: string;
  compact: boolean;
  onToggleCompact: () => void;
  onRefresh: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
  chats: ChatMeta[];
  activeChatId?: string;
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onOpenHistory: () => void;
}

const RECENT_CHATS = 5;

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-2">
      <CadenceMark size={size === "sm" ? 16 : 20} />
      <span className={`font-semibold tracking-tight ${size === "sm" ? "text-base" : "text-lg"}`}>{APP_NAME}</span>
    </div>
  );
}

const MAX_RACES = 3;

function upcomingRaces(metrics: MetricsResponse | null): KeyEvent[] {
  return (metrics?.keyEvents ?? []).filter((e) => e.kind === "race");
}

function focusRace(metrics: MetricsResponse | null): KeyEvent | undefined {
  const races = upcomingRaces(metrics);
  return races.find((e) => e.priority === "A") ?? races[0];
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
  chats,
  activeChatId,
  onOpenChat,
  onNewChat,
  onOpenHistory,
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
      <aside className="sticky top-0 hidden h-screen w-[68px] shrink-0 flex-col items-center gap-6 overflow-y-auto border-r border-ink-line bg-ink-rail pb-5 pt-5 lg:flex">
        <div className="flex flex-col items-center gap-3">
          <CadenceMark size={20} />
          <IconButton label="Expand sidebar" onClick={onToggleCompact}>
            <PanelLeftOpen className="h-4 w-4" />
          </IconButton>
          <IconButton label="New chat" onClick={onNewChat}>
            <SquarePen className="h-4 w-4" />
          </IconButton>
          <IconButton label="Chats" onClick={onOpenHistory}>
            <History className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="flex flex-col items-center gap-1" title={tsbTitle}>
          <span className="font-display text-[28px] font-bold leading-none">
            {fitness?.tsb != null ? formatSigned(fitness.tsb) : "—"}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-fg-muted">
            {fitness && (
              <span className={`h-1.5 w-1.5 rounded-full ${isFormWarning(metrics) ? "bg-signal-warn" : "bg-signal"}`} />
            )}
            TSB
          </span>
        </div>

        {(() => {
          const race = focusRace(metrics);
          return race ? (
            <div
              className="flex flex-col items-center gap-1"
              title={`${race.name} (${race.priority} race) — ${shortDate(race.date)}, ${formatCountdown(race.daysOut)}`}
            >
              <Flag className={`h-3.5 w-3.5 ${race.priority === "A" ? "text-signal" : "text-fg-muted"}`} />
              <span className="font-mono text-[10px] text-fg-muted">{formatCountdown(race.daysOut)}</span>
            </div>
          ) : null;
        })()}

        {metrics && (
          <div className="flex flex-col items-center gap-0.5" aria-label="This week">
            {weekDays(metrics).map((day) => (
              <div
                key={day.label}
                title={`${day.label}: ${
                  day.sessions.length
                    ? day.sessions.map((x) => `${x.name} — ${x.status}`).join(" + ")
                    : day.away
                      ? `Away · ${day.away.name}`
                      : "Rest"
                }`}
                aria-current={day.isToday ? "date" : undefined}
                className={`flex h-7 items-center gap-2 rounded-md px-2 ${day.isToday ? "bg-ink-raised" : ""}`}
              >
                <span className="w-2.5 font-mono text-[10px] text-fg-muted">{day.label[0]}</span>
                {day.first ? <SessionMark session={day.first} /> : <span className="h-[9px] w-[9px]" />}
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
            className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted transition hover:bg-ink-raised hover:text-fg"
          >
            <IntervalsIcon />
          </a>
          <IconButton label="Coach rules" onClick={onOpenRules}>
            <SlidersHorizontal className="h-4 w-4" />
          </IconButton>
          <IconButton label={`Settings (${modelLabel})`} onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
          </IconButton>
          <ThemeCycleButton />
          <div
            title={`${athleteName} · ${athleteId}`}
            className="mt-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink-line text-[11px] font-semibold"
          >
            {initials}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col gap-7 overflow-y-auto border-r border-ink-line bg-ink-rail px-6 pb-5 pt-6 lg:flex">
      <div className="flex items-center justify-between">
        <Wordmark />
        <div className="-mr-2 flex items-center gap-0.5">
          <a
            href={intervalsHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Intervals.icu"
            title="Open Intervals.icu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition hover:bg-ink-raised hover:text-fg"
          >
            <IntervalsIcon />
          </a>
          <IconButton label="Collapse sidebar" onClick={onToggleCompact} size="sm">
            <PanelLeftClose className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <section className="flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">Form today</span>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh from Intervals.icu"
            className="flex items-center gap-1.5 font-mono text-[11px] text-fg-muted transition hover:text-fg"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {fitness?.date ? fitness.date.slice(5).replace("-", "/") : "sync"}
          </button>
        </div>
        <div className="flex items-end gap-3">
          <span className="font-display text-[72px] font-bold leading-[0.85]">
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

      {upcomingRaces(metrics).length > 0 && (
        <section className="flex flex-col gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">Next races</span>
          <RaceList races={upcomingRaces(metrics).slice(0, MAX_RACES)} />
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">This week</span>
          {metrics && <WeekTotals metrics={metrics} />}
        </div>
        <WeekList metrics={metrics} />
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">Chats</span>
          <button
            onClick={onNewChat}
            title="New chat"
            className="-mr-1 flex items-center gap-1.5 px-1 font-mono text-[11px] text-fg-muted transition hover:text-fg"
          >
            <SquarePen className="h-3 w-3" />
            new
          </button>
        </div>
        <RecentChats chats={chats} activeChatId={activeChatId} onOpenChat={onOpenChat} onOpenHistory={onOpenHistory} />
      </section>

      <div className="flex-1" />

      <section className="flex flex-col gap-1.5">
        <RailButton icon={SlidersHorizontal} label="Coach rules" onClick={onOpenRules} />
        <RailButton icon={Settings} label="Settings" detail={modelLabel} onClick={onOpenSettings} />
        <div className="mt-1">
          <ThemeToggle />
        </div>
        <div className="mt-1.5 flex items-center gap-2.5 border-t border-ink-line px-2.5 pt-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-line text-[11px] font-semibold">
            {initials}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px]">{athleteName}</span>
            <span className="font-mono text-[11px] text-fg-muted">{athleteId}</span>
          </div>
        </div>
      </section>
    </aside>
  );
}

export function MobileBar({
  metrics,
  onOpenRules,
  onOpenSettings,
  onOpenHistory,
}: Pick<SidebarProps, "metrics" | "onOpenRules" | "onOpenSettings" | "onOpenHistory">) {
  const tsb = metrics?.fitness?.tsb;
  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between border-b border-ink-hair bg-ink/95 px-4 backdrop-blur lg:hidden">
      <Wordmark size="sm" />
      <div className="flex items-center gap-1">
        {tsb != null && (
          <span className="mr-1 flex h-9 items-center gap-2 rounded-full border border-ink-line px-3 font-mono text-xs">
            <span className="text-fg-muted">TSB</span>
            <span>{formatSigned(tsb)}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${isFormWarning(metrics) ? "bg-signal-warn" : "bg-signal"}`} />
          </span>
        )}
        <button
          onClick={onOpenHistory}
          aria-label="Chats"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted hover:text-fg"
        >
          <History className="h-4 w-4" />
        </button>
        <button
          onClick={onOpenRules}
          aria-label="Coach rules"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted hover:text-fg"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted hover:text-fg"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

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
      className={`${size === "sm" ? "h-8 w-8" : "h-10 w-10"} flex items-center justify-center rounded-lg text-fg-muted transition hover:bg-ink-raised hover:text-fg`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[10px] border border-ink-line px-3 py-2.5">
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
      className="flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition hover:bg-ink-raised"
    >
      <Icon className="h-4 w-4 text-fg-muted" />
      <span className="flex-1">{label}</span>
      {detail && <span className="max-w-[130px] truncate font-mono text-[11px] text-fg-muted">{detail}</span>}
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
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      role="img"
      aria-label="Form, last 6 weeks"
      className="overflow-visible"
    >
      <line x1="0" y1={y(0)} x2={width} y2={y(0)} className="stroke-ink-edge" strokeDasharray="2 4" />
      <polyline points={line} className="stroke-fg-muted" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={width} cy={y(last)} r="3.5" className="fill-signal" />
    </svg>
  );
}

type SessionStatus = "planned" | "done" | "missed" | "unplanned";

interface Session {
  name: string;
  status: SessionStatus;
  color: string;
  race?: KeyEvent["priority"];
  /** Ridden time when done, otherwise planned; seconds. */
  duration?: number;
  planned?: number;
}

function weekDays(metrics: MetricsResponse) {
  const today = toLocalDate(new Date());
  const start = new Date(`${metrics.weekStart}T00:00:00`);
  return DAY_LABELS.map((label, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = toLocalDate(d);
    const sessions: Session[] = [
      ...metrics.week
        .filter((e) => e.date === date)
        .map((e): Session =>
          e.completed
            ? {
                name: e.name,
                status: "done",
                color: activityZoneColor(e.completed),
                race: racePriority(e.category),
                duration: e.completed.movingTime,
                planned: e.movingTime,
              }
            : {
                name: e.name,
                status: date < today ? "missed" : "planned",
                color: eventZoneColor(e),
                race: racePriority(e.category),
                duration: e.movingTime,
                planned: e.movingTime,
              },
        ),
      ...(metrics.unplanned ?? [])
        .filter((a) => a.date === date)
        .map((a): Session => ({
          name: a.name,
          status: "unplanned",
          color: activityZoneColor(a),
          duration: a.movingTime,
        })),
    ];
    const away = (metrics.keyEvents ?? []).find(
      (e) => e.kind === "block" && e.unavailable && e.date <= date && (e.lastDate ?? e.date) >= date,
    );
    return { label, sessions, first: sessions[0], isToday: date === today, away };
  });
}

function racePriority(category: string): KeyEvent["priority"] {
  const match = /^RACE_([ABC])$/.exec(category);
  return match ? (match[1] as KeyEvent["priority"]) : undefined;
}

function RaceList({ races }: { races: KeyEvent[] }) {
  return (
    <div className="flex flex-col gap-1">
      {races.map((race) => (
        <div key={race.id} className="flex items-center gap-3 px-2 py-1" title={`${race.name} — ${race.priority} race`}>
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] font-semibold ${
              race.priority === "A" ? "bg-signal text-on-signal" : "border border-ink-edge text-fg-muted"
            }`}
          >
            {race.priority}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={`truncate text-[13px] ${race.priority === "A" ? "text-fg" : "text-fg-soft"}`}>
              {race.name}
            </span>
            <span className="font-mono text-[11px] text-fg-muted">
              {shortDate(race.date)}
              {race.distanceKm ? ` · ${race.distanceKm} km` : ""}
            </span>
          </span>
          <span className="shrink-0 font-mono text-[11px] text-fg-muted">{formatCountdown(race.daysOut)}</span>
        </div>
      ))}
    </div>
  );
}

function SessionMark({ session }: { session: Pick<Session, "status" | "color" | "race"> }) {
  const { status, color } = session;
  if (session.race) {
    return (
      <Flag
        className={`-mx-px h-[11px] w-[11px] shrink-0 ${
          status === "missed" ? "text-ink-edge" : session.race === "A" ? "text-signal" : "text-fg-soft"
        }`}
      />
    );
  }
  const filled = status === "done" || status === "unplanned";
  return (
    <span
      className={`box-border h-[9px] w-[9px] shrink-0 rounded-full ${status === "missed" ? "border-[1.5px] border-ink-edge" : ""} ${
        status === "unplanned" ? "outline-dashed outline-1 outline-offset-2 outline-fg-muted" : ""
      }`}
      style={filled ? { background: color } : status === "planned" ? { border: `1.5px solid ${color}` } : undefined}
    />
  );
}

function sessionDuration(session: Session): string {
  if (session.status === "missed") return `— / ${formatDuration(session.planned)}`;
  return formatDuration(session.duration);
}

function WeekTotals({ metrics }: { metrics: MetricsResponse }) {
  const done =
    metrics.week.reduce((sum, e) => sum + (e.completed?.movingTime ?? 0), 0) +
    (metrics.unplanned ?? []).reduce((sum, a) => sum + (a.movingTime ?? 0), 0);
  const planned = metrics.week.reduce((sum, e) => sum + (e.movingTime ?? 0), 0);
  if (!done && !planned) return null;
  return (
    <span className="font-mono text-[11px] text-fg-muted" title="Ridden / planned this week">
      {formatDuration(done)} / {formatDuration(planned)}
    </span>
  );
}

function WeekList({ metrics }: { metrics: MetricsResponse | null }) {
  if (!metrics) {
    return <div className="px-2 text-xs text-fg-muted">Loading calendar…</div>;
  }

  return (
    <div className="flex flex-col">
      {weekDays(metrics).map(({ label, sessions, first, isToday, away }) => (
        <div
          key={label}
          className={`flex h-[34px] items-center gap-3 rounded-lg px-2 ${isToday ? "bg-ink-raised" : ""}`}
          aria-current={isToday ? "date" : undefined}
        >
          <span className="w-7 font-mono text-[11px] text-fg-muted">{label}</span>
          {first ? <SessionMark session={first} /> : <span className="w-[9px] shrink-0" />}
          <span
            className={`min-w-0 flex-1 truncate text-[13px] ${
              !first || first.status === "missed" ? "text-fg-muted" : isToday ? "text-fg" : "text-fg-soft"
            }`}
            title={first ? `${first.name} — ${first.status}` : undefined}
          >
            <span className={first?.status === "missed" ? "line-through" : ""}>
              {first ? first.name : away ? `Away · ${away.name}` : "Rest"}
            </span>
            {sessions.length > 1 && <span className="text-fg-muted"> +{sessions.length - 1}</span>}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-fg-muted">{first ? sessionDuration(first) : ""}</span>
        </div>
      ))}
      <WeekLegend />
    </div>
  );
}

function WeekLegend() {
  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-ink-line px-2 pt-2.5 text-[11px] text-fg-muted">
      <div className="flex flex-wrap gap-x-2.5 gap-y-1">
        {ZONE_LEGEND.map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-1">
        <span className="flex items-center gap-1.5">
          <span className="box-border h-2 w-2 rounded-full border-[1.5px] border-fg-muted" />
          planned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-fg-muted" />
          done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="box-border h-2 w-2 rounded-full border-[1.5px] border-ink-edge" />
          missed
        </span>
        <span className="flex items-center gap-1.5">
          <SessionMark session={{ status: "unplanned", color: "rgb(var(--fg-muted))" }} />
          unplanned
        </span>
        <span className="flex items-center gap-1.5">
          <Flag className="h-2.5 w-2.5" />
          race
        </span>
      </div>
    </div>
  );
}

function RecentChats({
  chats,
  activeChatId,
  onOpenChat,
  onOpenHistory,
}: Pick<SidebarProps, "chats" | "activeChatId" | "onOpenChat" | "onOpenHistory">) {
  if (chats.length === 0) {
    return <div className="px-2 text-xs text-fg-muted">Past conversations will appear here.</div>;
  }

  return (
    <div className="flex flex-col">
      {chats.slice(0, RECENT_CHATS).map((chat) => {
        const isActive = chat.id === activeChatId;
        return (
          <button
            key={chat.id}
            onClick={() => onOpenChat(chat.id)}
            aria-current={isActive ? "true" : undefined}
            title={chat.title}
            className={`flex h-[34px] items-center gap-3 rounded-lg px-2 text-left transition ${
              isActive ? "bg-ink-raised" : "hover:bg-ink-raised"
            }`}
          >
            <span className={`min-w-0 flex-1 truncate text-[13px] ${isActive ? "text-fg" : "text-fg-soft"}`}>
              {chat.title}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-fg-muted">{formatChatDate(chat.updatedAt)}</span>
          </button>
        );
      })}
      <button
        onClick={onOpenHistory}
        className="flex h-[30px] items-center gap-2 px-2 font-mono text-[11px] text-fg-muted transition hover:text-fg"
      >
        {chats.length > RECENT_CHATS ? `All ${chats.length} chats →` : "Manage chats →"}
      </button>
    </div>
  );
}
