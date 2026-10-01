"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowUpRight,
  Brain,
  CalendarDays,
  ChevronsUpDown,
  FileText,
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
import { ThemeToggle } from "@/components/ThemeToggle";
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
  modelLabel: string;
  compact: boolean;
  onToggleCompact: () => void;
  onOpenToday: () => void;
  onOpenRules: () => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  chats: ChatMeta[];
  activeChatId?: string;
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onOpenHistory: () => void;
  /** Session reports not opened yet. */
  unreadReports: number;
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

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Sidebar({
  athleteId,
  metrics,
  modelLabel,
  compact,
  onToggleCompact,
  onOpenToday,
  onOpenRules,
  onOpenMemory,
  onOpenSettings,
  chats,
  activeChatId,
  onOpenChat,
  onNewChat,
  onOpenHistory,
  unreadReports,
}: SidebarProps) {
  const fitness = metrics?.fitness;
  const athleteName = metrics?.athlete?.name || athleteId;
  const menu = { athleteId, athleteName, modelLabel, onOpenRules, onOpenMemory, onOpenSettings };

  if (compact) {
    const race = focusRace(metrics);
    const todayLabel = fitness
      ? `Form ${fitness.tsb != null ? formatSigned(fitness.tsb) : "—"}, ${FORM_LABELS[fitness.form_status]}. Open form and this week`
      : "Open form and this week";
    return (
      <aside className="sticky top-0 hidden h-screen w-[68px] shrink-0 flex-col items-center gap-5 overflow-y-auto border-r border-ink-line bg-ink-rail pb-4 pt-5 lg:flex">
        <div className="flex flex-col items-center gap-1">
          <div className="mb-2">
            <CadenceMark size={20} />
          </div>
          <IconButton label="Expand sidebar" onClick={onToggleCompact}>
            <PanelLeftOpen className="h-4 w-4" />
          </IconButton>
          <button
            type="button"
            onClick={onNewChat}
            aria-label="New chat"
            title="New chat"
            className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-ink-edge text-fg transition hover:bg-ink-raised"
          >
            <SquarePen className="h-4 w-4" />
          </button>
          <IconButton label="Chats" onClick={onOpenHistory}>
            <History className="h-4 w-4" />
          </IconButton>
          <Link
            href="/reports"
            aria-label={reportsLabel(unreadReports)}
            title={reportsLabel(unreadReports)}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted transition hover:bg-ink-raised hover:text-fg"
          >
            <FileText className="h-4 w-4" />
            {unreadReports > 0 && <UnreadBadge count={unreadReports} className="absolute -right-0.5 -top-0.5" />}
          </Link>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onOpenToday}
          aria-label={todayLabel}
          title={todayLabel}
          className="flex w-[52px] flex-col items-center gap-2.5 rounded-xl border border-ink-line pb-2 pt-3 transition hover:border-ink-edge"
        >
          <span className="font-display text-[28px] font-bold leading-[0.85]">
            {fitness?.tsb != null ? formatSigned(fitness.tsb) : "—"}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-fg-muted">
            {fitness && (
              <span className={`h-1.5 w-1.5 rounded-full ${isFormWarning(metrics) ? "bg-signal-warn" : "bg-signal"}`} />
            )}
            TSB
          </span>
          {metrics && (
            <>
              <span className="h-px w-7 bg-ink-line" />
              <span className="flex flex-col items-center">
                {weekDays(metrics).map((day) => (
                  <span
                    key={day.label}
                    className={`flex h-[22px] w-10 items-center justify-center gap-1.5 rounded-md ${day.isToday ? "bg-ink-raised" : ""}`}
                  >
                    <span className="w-2 font-mono text-[10px] text-fg-muted">{day.label[0]}</span>
                    {day.first ? <SessionMark session={day.first} /> : <span className="h-[9px] w-[9px]" />}
                  </span>
                ))}
              </span>
            </>
          )}
          {race && (
            <span className="flex flex-col items-center gap-0.5 pt-1">
              <Flag className={`h-3 w-3 ${race.priority === "A" ? "text-signal" : "text-fg-muted"}`} />
              <span className="font-mono text-[10px] text-fg-muted">{formatCountdown(race.daysOut)}</span>
            </span>
          )}
        </button>

        <AthleteMenu variant="compact" {...menu} />
      </aside>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-ink-line bg-ink-rail px-5 pb-4 pt-6 lg:flex">
      <div className="flex items-center justify-between px-1">
        <Wordmark />
        <div className="-mr-1.5">
          <IconButton label="Collapse sidebar" onClick={onToggleCompact} size="sm">
            <PanelLeftClose className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onNewChat}
          className="mb-1.5 flex h-10 items-center gap-2.5 rounded-[10px] border border-ink-edge px-2.5 text-left text-[13px] font-medium transition hover:bg-ink-raised"
        >
          <SquarePen className="h-4 w-4" />
          New chat
        </button>
        <button type="button" onClick={onOpenHistory} className={NAV_ROW}>
          <History className="h-4 w-4 text-fg-muted" />
          <span className="flex-1">Chats</span>
          {chats.length > 0 && <span className="font-mono text-[11px] text-fg-muted">{chats.length}</span>}
        </button>
        <Link href="/reports" className={NAV_ROW}>
          <FileText className="h-4 w-4 text-fg-muted" />
          <span className="flex-1">Reports</span>
          {unreadReports > 0 && <UnreadBadge count={unreadReports} />}
        </Link>
      </nav>

      <section className="flex flex-col gap-1.5">
        <span className={`${SECTION_LABEL} px-2.5`}>Recent</span>
        <RecentChats chats={chats} activeChatId={activeChatId} onOpenChat={onOpenChat} onOpenHistory={onOpenHistory} />
      </section>

      <div className="flex-1" />

      <TodayCard metrics={metrics} onOpenToday={onOpenToday} />

      <AthleteMenu variant="rail" {...menu} />
    </aside>
  );
}

const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted";

const NAV_ROW = "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition hover:bg-ink-raised";

function TodayCard({ metrics, onOpenToday }: Pick<SidebarProps, "metrics" | "onOpenToday">) {
  const fitness = metrics?.fitness;
  const race = focusRace(metrics);
  return (
    <button
      type="button"
      onClick={onOpenToday}
      title="Form, races and this week"
      className="flex flex-col gap-3 rounded-xl border border-ink-line px-3.5 pb-3 pt-3.5 text-left transition hover:border-ink-edge"
    >
      <span className="flex w-full items-end gap-2.5">
        <span className="font-display text-[44px] font-bold leading-[0.85]">
          {fitness?.tsb != null ? formatSigned(fitness.tsb) : "—"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {fitness ? (
            <span
              className={`text-[13px] font-semibold ${isFormWarning(metrics) ? "text-signal-warn" : "text-signal"}`}
            >
              {FORM_LABELS[fitness.form_status]}
            </span>
          ) : (
            <span className="text-[13px] text-fg-muted">Form</span>
          )}
          <span className="whitespace-nowrap font-mono text-[11px] text-fg-muted">
            CTL {fitness?.ctl != null ? Math.round(fitness.ctl) : "—"} · ATL{" "}
            {fitness?.atl != null ? Math.round(fitness.atl) : "—"}
          </span>
        </span>
        <FormSparkline points={metrics?.formHistory ?? []} width={56} height={30} />
      </span>
      <span className="flex w-full flex-col gap-1.5">
        <span className="flex items-center justify-between">
          <span className={SECTION_LABEL}>This week</span>
          {metrics && <WeekTotals metrics={metrics} />}
        </span>
        {metrics ? (
          <span className="grid grid-cols-7 gap-0.5">
            {weekDays(metrics).map((day) => (
              <span
                key={day.label}
                className={`flex h-10 flex-col items-center justify-center gap-1.5 rounded-lg ${day.isToday ? "bg-ink-raised" : ""}`}
              >
                <span className={`font-mono text-[10px] ${day.isToday ? "text-fg" : "text-fg-muted"}`}>
                  {day.label[0]}
                </span>
                {day.first ? <SessionMark session={day.first} /> : <span className="h-[9px] w-[9px]" />}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-xs text-fg-muted">Loading calendar…</span>
        )}
      </span>
      {race && (
        <span className="flex w-full items-center gap-2 border-t border-ink-hair pt-2.5">
          <RaceBadge priority={race.priority} />
          <span className="min-w-0 flex-1 truncate text-xs text-fg-soft">{race.name}</span>
          <span className="shrink-0 font-mono text-[11px] text-fg-muted">{formatCountdown(race.daysOut)}</span>
        </span>
      )}
    </button>
  );
}

const MENU_ITEM = "flex items-center gap-2.5 rounded-lg px-2.5 text-left transition hover:bg-ink-raised";

function AthleteMenu({
  variant,
  athleteId,
  athleteName,
  modelLabel,
  onOpenRules,
  onOpenMemory,
  onOpenSettings,
}: Pick<SidebarProps, "athleteId" | "modelLabel" | "onOpenRules" | "onOpenMemory" | "onOpenSettings"> & {
  variant: "rail" | "compact" | "sheet";
  athleteName: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const initials = initialsOf(athleteName);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const sheet = variant === "sheet";
  const item = `${MENU_ITEM} ${sheet ? "h-12 text-[15px]" : "h-10 text-[13px]"}`;
  const icon = sheet ? "h-[18px] w-[18px] text-fg-muted" : "h-4 w-4 text-fg-muted";

  const panel = (
    <div
      ref={panelRef}
      id={panelId}
      className={
        sheet
          ? "fixed inset-x-0 bottom-0 z-50 flex flex-col gap-0.5 rounded-t-2xl border-t border-ink-line bg-ink-rail px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2.5 text-fg shadow-2xl"
          : `z-40 flex flex-col gap-0.5 rounded-xl border border-ink-edge bg-ink-card p-1.5 shadow-2xl ${
              variant === "rail" ? "absolute inset-x-0 bottom-full mb-2" : "fixed bottom-4 left-[76px] w-[248px]"
            }`
      }
    >
      {sheet && <span className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-ink-edge" />}
      {variant !== "rail" && (
        <>
          <div className="flex items-center gap-3 px-2.5 pb-3 pt-1.5">
            {sheet && <Avatar initials={initials} size="lg" />}
            <div className="flex min-w-0 flex-col">
              <span className={`truncate ${sheet ? "text-[15px]" : "text-[13px]"}`}>{athleteName}</span>
              <span className="font-mono text-[11px] text-fg-muted">{athleteId}</span>
            </div>
          </div>
          {!sheet && <div className="mx-1 mb-1 h-px bg-ink-line" />}
        </>
      )}
      <button type="button" onClick={pick(onOpenRules)} className={item}>
        <SlidersHorizontal className={icon} />
        Coach rules
      </button>
      <button type="button" onClick={pick(onOpenMemory)} className={item}>
        <Brain className={icon} />
        Coach memory
      </button>
      <button type="button" onClick={pick(onOpenSettings)} className={item}>
        <Settings className={icon} />
        <span className="flex-1">Settings</span>
        {modelLabel && <span className="max-w-[130px] truncate font-mono text-[11px] text-fg-muted">{modelLabel}</span>}
      </button>
      {athleteId && (
        <a
          href={`https://intervals.icu/athlete/${athleteId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          className={item}
        >
          <span className="text-fg-muted">
            <IntervalsIcon />
          </span>
          <span className="flex-1">Intervals.icu</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-fg-muted" />
        </a>
      )}
      <div className={sheet ? "mt-2.5" : "mx-1 mt-1 border-t border-ink-line pt-2"}>
        <ThemeToggle size={sheet ? "md" : "sm"} />
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="relative">
      {variant === "rail" ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${athleteName} — rules, memory, settings`}
          className={`flex h-12 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left transition hover:bg-ink-raised ${
            open ? "bg-ink-raised" : ""
          }`}
        >
          <Avatar initials={initials} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px]">{athleteName}</span>
            <span className="font-mono text-[11px] text-fg-muted">{athleteId}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-fg-muted" />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${athleteName} — rules, memory, settings`}
          title={athleteName}
          className={`flex items-center justify-center ${sheet ? "h-11 w-11" : "h-10 w-10 rounded-full"}`}
        >
          <Avatar initials={initials} ring={open && !sheet} />
        </button>
      )}
      {open &&
        (sheet
          ? createPortal(
              <>
                <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/70" onClick={() => setOpen(false)} />
                {panel}
              </>,
              document.body,
            )
          : panel)}
    </div>
  );
}

function Avatar({ initials, size = "md", ring = false }: { initials: string; size?: "md" | "lg"; ring?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-ink-line font-semibold ${
        size === "lg" ? "h-9 w-9 text-[13px]" : "h-7 w-7 text-[11px]"
      } ${ring ? "ring-1 ring-ink-edge ring-offset-2 ring-offset-ink-rail" : ""}`}
    >
      {initials}
    </span>
  );
}

function RaceBadge({ priority }: { priority: KeyEvent["priority"] }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] font-semibold ${
        priority === "A" ? "bg-signal text-on-signal" : "border border-ink-edge text-fg-muted"
      }`}
    >
      {priority}
    </span>
  );
}

export function FormSection({
  metrics,
  loading,
  onRefresh,
  fluid = false,
}: {
  metrics: MetricsResponse | null;
  loading: boolean;
  onRefresh: () => void;
  fluid?: boolean;
}) {
  const fitness = metrics?.fitness;
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <span className={SECTION_LABEL}>Form today</span>
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh from Intervals.icu"
          className="-mr-2 flex h-8 items-center gap-1.5 px-2 font-mono text-[11px] text-fg-muted transition hover:text-fg"
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
      <FormSparkline points={metrics?.formHistory ?? []} fluid={fluid} />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Fitness · CTL" value={fitness?.ctl} />
        <Stat label="Fatigue · ATL" value={fitness?.atl} />
      </div>
    </section>
  );
}

export function RacesSection({ metrics }: { metrics: MetricsResponse | null }) {
  const races = upcomingRaces(metrics);
  if (races.length === 0) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <span className={SECTION_LABEL}>Next races</span>
      <RaceList races={races.slice(0, MAX_RACES)} />
    </section>
  );
}

export function WeekSection({ metrics }: { metrics: MetricsResponse | null }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className={SECTION_LABEL}>This week</span>
        {metrics && <WeekTotals metrics={metrics} />}
      </div>
      <WeekList metrics={metrics} />
    </section>
  );
}

function reportsLabel(unread: number) {
  return unread > 0 ? `Reports (${unread} new)` : "Reports";
}

function UnreadBadge({ count, className = "" }: { count: number; className?: string }) {
  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 font-mono text-[10px] font-medium text-on-signal ${className}`}
    >
      {count}
    </span>
  );
}

const MOBILE_ICON_BUTTON = "flex h-11 w-10 items-center justify-center rounded-lg text-fg-muted hover:text-fg";

export function MobileBar({
  athleteId,
  metrics,
  modelLabel,
  onOpenToday,
  onNewChat,
  onOpenRules,
  onOpenMemory,
  onOpenSettings,
  onOpenHistory,
  unreadReports,
}: Pick<
  SidebarProps,
  | "athleteId"
  | "metrics"
  | "modelLabel"
  | "onOpenToday"
  | "onNewChat"
  | "onOpenRules"
  | "onOpenMemory"
  | "onOpenSettings"
  | "onOpenHistory"
  | "unreadReports"
>) {
  const tsb = metrics?.fitness?.tsb;
  return (
    <header className="sticky top-0 z-30 box-content flex h-[60px] items-center justify-between gap-2 border-b border-ink-hair bg-ink/95 pl-4 pr-2 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <CadenceMark size={16} />
        <span className="hidden text-base font-semibold tracking-tight min-[400px]:inline">{APP_NAME}</span>
      </div>
      <div className="flex items-center">
        <button
          onClick={onOpenToday}
          aria-label="Form and this week"
          className="mr-1 flex h-9 items-center gap-2 rounded-full border border-ink-line px-3 font-mono text-xs transition hover:border-ink-edge"
        >
          {tsb != null ? (
            <>
              <span className="text-fg-muted">TSB</span>
              <span>{formatSigned(tsb)}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${isFormWarning(metrics) ? "bg-signal-warn" : "bg-signal"}`} />
            </>
          ) : (
            <>
              <CalendarDays className="h-3.5 w-3.5 text-fg-muted" />
              <span>Week</span>
            </>
          )}
        </button>
        <button onClick={onNewChat} aria-label="New chat" className={MOBILE_ICON_BUTTON}>
          <SquarePen className="h-4 w-4" />
        </button>
        <button onClick={onOpenHistory} aria-label="Chats" className={MOBILE_ICON_BUTTON}>
          <History className="h-4 w-4" />
        </button>
        <Link href="/reports" aria-label={reportsLabel(unreadReports)} className={`relative ${MOBILE_ICON_BUTTON}`}>
          <FileText className="h-4 w-4" />
          {unreadReports > 0 && <span className="absolute right-2.5 top-2.5 h-[7px] w-[7px] rounded-full bg-signal" />}
        </Link>
        <AthleteMenu
          variant="sheet"
          athleteId={athleteId}
          athleteName={metrics?.athlete?.name || athleteId}
          modelLabel={modelLabel}
          onOpenRules={onOpenRules}
          onOpenMemory={onOpenMemory}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </header>
  );
}

export function IntervalsIcon() {
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

function FormSparkline({
  points,
  fluid = false,
  width = 252,
  height = 56,
}: {
  points: Array<{ tsb: number }>;
  fluid?: boolean;
  width?: number;
  height?: number;
}) {
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
      width={fluid ? "100%" : width}
      height={fluid ? undefined : height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      role="img"
      aria-label="Form, last 6 weeks"
      className="overflow-visible"
    >
      <line x1="0" y1={y(0)} x2={width} y2={y(0)} className="stroke-ink-edge" strokeDasharray="2 4" />
      <polyline points={line} className="stroke-fg-muted" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={width} cy={y(last)} r={width < 100 ? 2.5 : 3.5} className="fill-signal" />
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
          <RaceBadge priority={race.priority} />
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
