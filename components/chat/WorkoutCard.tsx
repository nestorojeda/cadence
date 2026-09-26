"use client";

import React from "react";
import { eventZoneColor, formatDuration } from "@/lib/intervals/metrics";
import { parseWorkout } from "@/lib/intervals/workout";
import { WorkoutChart } from "./WorkoutChart";
import { CardStat, SessionCardShell, SessionCardStatus, formatDay, type WorkoutCardStatus } from "./SessionCardParts";

export type { WorkoutCardStatus };

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

interface WorkoutCardProps {
  input: Partial<WorkoutEventInput>;
  status: WorkoutCardStatus;
  errorText?: string;
  /** Adds (true) or skips (false) a pending session; omitted when the athlete can't decide right now. */
  onDecide?: (approved: boolean) => void;
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
    <SessionCardShell status={status}>
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

      <SessionCardStatus status={status} errorText={errorText} onDecide={onDecide} />
    </SessionCardShell>
  );
}
