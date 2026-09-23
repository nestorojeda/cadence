"use client";

import React from "react";
import { AlertTriangle, Check } from "lucide-react";
import { eventZoneColor, formatDuration } from "@/lib/intervals/metrics";
import { CadenceMark } from "@/components/CadenceMark";

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
  status: "adding" | "added" | "failed";
  errorText?: string;
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

/** A session the coach put on the Intervals.icu calendar. */
export function WorkoutCard({ input, status, errorText }: WorkoutCardProps) {
  const hours = input.moving_time ? input.moving_time / 3600 : 0;
  const intensity = hours && input.icu_training_load ? Math.sqrt(input.icu_training_load / (hours * 100)) : null;
  const zoneColor = eventZoneColor({
    date: "",
    name: input.name ?? "",
    type: input.type,
    category: input.category ?? "WORKOUT",
    movingTime: input.moving_time,
    load: input.icu_training_load,
  });

  return (
    <div className="border border-ink-line rounded-[14px] bg-ink-card px-5 py-4 flex flex-col gap-4">
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
            <CardStat label="time" value={formatDuration(input.moving_time)} />
            <CardStat label="TSS" value={input.icu_training_load != null ? Math.round(input.icu_training_load).toString() : "—"} />
            <CardStat label="IF" value={intensity ? intensity.toFixed(2) : "—"} />
          </div>
        )}
      </div>

      {input.description && (
        <p className="font-mono text-xs leading-relaxed text-fg-subtle whitespace-pre-line border-t border-ink-hair pt-3">
          {input.description}
        </p>
      )}

      <div className="flex items-center gap-2 text-xs" role="status">
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
