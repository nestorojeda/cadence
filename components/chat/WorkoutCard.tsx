"use client";

import React from "react";
import { AlertTriangle, CalendarPlus, Check, X } from "lucide-react";
import { eventZoneColor, formatDuration } from "@/lib/intervals/metrics";
import { parseWorkout } from "@/lib/intervals/workout";
import { CadenceMark } from "@/components/CadenceMark";
import { WorkoutChart } from "./WorkoutChart";

/** Input of the `icu_create_calendar_event` tool (see lib/intervals/tools.ts). */
export interface WorkoutEventInput {
  name: string;
  start_date_local: string;
  type: string;
  category: "WORKOUT" | "NOTE";
  description?: string;
  moving_time?: number;
  icu_training_load?: number;
}

/** `pending`: proposed by the coach, waiting for the athlete; `declined`: skipped, never written. */
export type WorkoutCardStatus = "pending" | "adding" | "added" | "declined" | "failed";

interface WorkoutCardProps {
  input: Partial<WorkoutEventInput>;
  status: WorkoutCardStatus;
  errorText?: string;
  /** Adds (true) or skips (false) a pending session; omitted when the athlete can't decide right now. */
  onDecide?: (approved: boolean) => void;
}

function formatDay(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .replace(",", "")
    .toUpperCase();
}

/** A session the coach proposed for, or put on, the Intervals.icu calendar. */
export function WorkoutCard({ input, status, errorText, onDecide }: WorkoutCardProps) {
  const steps = parseWorkout(input.description);
  const movingTime = input.moving_time || steps.reduce((sum, s) => sum + s.duration, 0) || undefined;
  const hours = movingTime ? movingTime / 3600 : 0;
  const intensity = hours && input.icu_training_load ? Math.sqrt(input.icu_training_load / (hours * 100)) : null;
  const zoneColor = eventZoneColor({
    date: "",
    name: input.name ?? "",
    type: input.type,
    category: input.category ?? "WORKOUT",
    movingTime,
    load: input.icu_training_load,
  });

  return (
    <div
      className={`border rounded-[14px] bg-ink-card px-5 py-4 flex flex-col gap-4 transition ${
        status === "pending" ? "border-ink-edge border-dashed" : "border-ink-line"
      } ${status === "declined" ? "opacity-50" : ""}`}
    >
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-2 font-mono text-[11px] text-fg-muted">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: zoneColor }} />
            {[formatDay(input.start_date_local), input.type?.toUpperCase()].filter(Boolean).join(" · ")}
          </span>
          <span className="font-display font-bold text-[26px] leading-none break-words">{input.name ?? "Workout"}</span>
        </div>
        {input.category !== "NOTE" && (
          <div className="flex gap-5 font-mono">
            <CardStat label="time" value={formatDuration(movingTime)} />
            <CardStat label="TSS" value={input.icu_training_load != null ? Math.round(input.icu_training_load).toString() : "—"} />
            <CardStat label="IF" value={intensity ? intensity.toFixed(2) : "—"} />
          </div>
        )}
      </div>

      {steps.length > 0 && <WorkoutChart steps={steps} />}

      {input.description && (
        <p className="font-mono text-xs leading-relaxed text-fg-subtle whitespace-pre-line border-t border-ink-hair pt-3">
          {input.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs" role="status">
        {status === "pending" && (
          <>
            <CalendarPlus className="w-3.5 h-3.5 text-fg-muted" />
            <span className="text-fg-subtle mr-auto">Not on your calendar yet</span>
            <button
              type="button"
              disabled={!onDecide}
              onClick={() => onDecide?.(false)}
              className="h-8 px-3 rounded-lg border border-ink-edge text-fg hover:bg-ink-raised transition disabled:opacity-40"
            >
              Skip
            </button>
            <button
              type="button"
              disabled={!onDecide}
              onClick={() => onDecide?.(true)}
              className="h-8 px-3 rounded-lg bg-signal text-on-signal font-semibold hover:brightness-95 transition disabled:opacity-40"
            >
              Add to calendar
            </button>
          </>
        )}
        {status === "declined" && (
          <>
            <X className="w-3.5 h-3.5 text-fg-muted" />
            <span className="text-fg-subtle">Not added</span>
          </>
        )}
        {status === "added" && (
          <>
            <Check className="w-3.5 h-3.5 text-signal" strokeWidth={2.5} />
            <span className="text-fg-subtle">Added to your Intervals.icu calendar</span>
          </>
        )}
        {status === "adding" && (
          <>
            <CadenceMark size={14} spinning />
            <span className="text-fg-subtle">Adding to your calendar…</span>
          </>
        )}
        {status === "failed" && (
          <>
            <AlertTriangle className="w-3.5 h-3.5 text-signal-warn shrink-0" />
            <span className="text-fg-subtle break-words">Couldn’t add to calendar{errorText ? `: ${errorText}` : ""}</span>
          </>
        )}
      </div>
    </div>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span className="text-[15px]">{value}</span>
    </div>
  );
}
