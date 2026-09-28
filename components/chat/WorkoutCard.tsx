"use client";

import React from "react";
import { eventZoneColor, formatDuration } from "@/lib/intervals/metrics";
import { parseWorkout } from "@/lib/intervals/workout";
import { WorkoutChart } from "./WorkoutChart";
import {
  CardStat,
  SessionCardShell,
  SessionCardStatus,
  formatDay,
  type SessionCardKind,
  type WorkoutCardStatus,
} from "./SessionCardParts";

export type { WorkoutCardStatus };

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
  previous?: Partial<WorkoutEventInput>;
  eventId?: string;
  kind?: Extract<SessionCardKind, "create" | "update">;
  status: WorkoutCardStatus;
  errorText?: string;
  onDecide?: (approved: boolean) => void;
}

function previousSummary(previous: Partial<WorkoutEventInput>, changes: Partial<WorkoutEventInput>): string {
  const was: string[] = [];
  if (changes.start_date_local && formatDay(changes.start_date_local) !== formatDay(previous.start_date_local)) {
    was.push(formatDay(previous.start_date_local));
  }
  if (changes.name && changes.name !== previous.name && previous.name) was.push(previous.name);
  if (changes.type && changes.type !== previous.type && previous.type) was.push(previous.type.toUpperCase());
  if (changes.moving_time && changes.moving_time !== previous.moving_time)
    was.push(formatDuration(previous.moving_time));
  if (changes.icu_training_load != null && changes.icu_training_load !== previous.icu_training_load) {
    was.push(`${previous.icu_training_load != null ? Math.round(previous.icu_training_load) : "—"} TSS`);
  }
  if (changes.description && changes.description !== previous.description) was.push("other steps");
  return was.filter(Boolean).join(" · ");
}

export function WorkoutCard({
  input: changes,
  previous,
  eventId,
  kind = "create",
  status,
  errorText,
  onDecide,
}: WorkoutCardProps) {
  const input: Partial<WorkoutEventInput> = { ...previous, ...changes };
  const was = previous ? previousSummary(previous, changes) : "";
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 font-mono text-[11px] text-fg-muted">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: zoneColor }} />
            {[formatDay(input.start_date_local), (input.type ?? input.category)?.toUpperCase()]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="break-words font-display text-[26px] font-bold leading-none">
            {input.name ?? (eventId ? `Event #${eventId}` : "Workout")}
          </span>
          {was && <span className="font-mono text-[11px] text-fg-muted">was {was}</span>}
        </div>
        {input.category !== "NOTE" && (
          <div className="flex gap-5 font-mono">
            <CardStat label="time" value={formatDuration(movingTime)} />
            <CardStat
              label="TSS"
              value={input.icu_training_load != null ? Math.round(input.icu_training_load).toString() : "—"}
            />
            <CardStat label="IF" value={intensity ? intensity.toFixed(2) : "—"} />
          </div>
        )}
      </div>

      {steps.length > 0 && <WorkoutChart steps={steps} />}

      {input.description && (
        <p className="whitespace-pre-line border-t border-ink-hair pt-3 font-mono text-xs leading-relaxed text-fg-subtle">
          {input.description}
        </p>
      )}

      <SessionCardStatus status={status} kind={kind} errorText={errorText} onDecide={onDecide} />
    </SessionCardShell>
  );
}

export function RemovedEventCard({
  event,
  eventId,
  status,
  errorText,
  onDecide,
}: {
  event?: Partial<WorkoutEventInput>;
  eventId?: string;
  status: WorkoutCardStatus;
  errorText?: string;
  onDecide?: (approved: boolean) => void;
}) {
  const header = [formatDay(event?.start_date_local), (event?.type ?? event?.category)?.toUpperCase()]
    .filter(Boolean)
    .join(" · ");
  const removed = status === "added";
  return (
    <SessionCardShell status={status}>
      <div className="flex min-w-0 flex-col gap-1">
        {header && <span className="font-mono text-[11px] text-fg-muted">{header}</span>}
        <span
          className={`break-words font-display text-[26px] font-bold leading-none ${removed ? "text-fg-muted line-through" : ""}`}
        >
          {event?.name ?? `Event #${eventId ?? "?"}`}
        </span>
      </div>
      <SessionCardStatus status={status} kind="delete" errorText={errorText} onDecide={onDecide} />
    </SessionCardShell>
  );
}
