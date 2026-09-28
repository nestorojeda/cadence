"use client";

import React from "react";
import { STRENGTH_COLOR, formatDuration } from "@/lib/intervals/metrics";
import { formatRest, formatSetsReps, type GymSessionInput, type GymSessionResult } from "@/lib/coach/gym";
import { CardStat, SessionCardShell, SessionCardStatus, formatDay, type WorkoutCardStatus } from "./SessionCardParts";

interface GymCardProps {
  input: Partial<GymSessionInput>;
  status: WorkoutCardStatus;
  output?: GymSessionResult;
  errorText?: string;
  onDecide?: (approved: boolean) => void;
}

function describeOutcome(output: GymSessionResult | undefined): {
  failed?: string;
  added?: string;
  warning?: string;
} {
  if (!output) return {};
  const icuSkipped = output.intervals === "skipped";
  const icuError = typeof output.intervals === "object" && "error" in output.intervals ? output.intervals.error : undefined;
  const hevy = output.hevy;
  const hevyError = typeof hevy === "object" && "error" in hevy ? hevy.error : undefined;
  const hevyOk = typeof hevy === "object" && "routine_id" in hevy ? hevy : undefined;
  const unmatched = hevyOk?.unmatched?.length
    ? `Not in your Hevy library (listed in the routine notes): ${hevyOk.unmatched.join(", ")}`
    : undefined;

  if (icuError && !hevyOk) {
    return { failed: hevyError ? `${icuError} · Hevy: ${hevyError}` : icuError };
  }
  if (icuError) {
    return { added: `Added to Hevy as “${hevyOk!.title}”`, warning: `Not on Intervals.icu: ${icuError}` };
  }
  if (icuSkipped) {
    return hevyOk
      ? { added: `Added to Hevy as “${hevyOk.title}”`, warning: unmatched }
      : { failed: `Hevy routine not created: ${hevyError ?? "Hevy is not connected"}` };
  }
  if (hevyOk) {
    return { added: `Added to Intervals.icu and to Hevy as “${hevyOk.title}”`, warning: unmatched };
  }
  if (hevyError) {
    return { added: "Added to your Intervals.icu calendar", warning: `Hevy routine not created: ${hevyError}` };
  }
  return { added: "Added to your Intervals.icu calendar" };
}

export function GymCard({ input, status, output, errorText, onDecide }: GymCardProps) {
  const exercises = (input.exercises ?? []).filter((e) => e?.name);
  const outcome = describeOutcome(status === "added" ? output : undefined);
  const shownStatus = outcome.failed ? "failed" : status;

  return (
    <SessionCardShell status={shownStatus}>
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-2 font-mono text-[11px] text-fg-muted">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: STRENGTH_COLOR }} />
            {[formatDay(input.start_date_local), "STRENGTH", input.hevy_only ? "HEVY ONLY" : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="font-display font-bold text-[26px] leading-none break-words">{input.name ?? "Gym"}</span>
        </div>
        <div className="flex gap-5 font-mono">
          <CardStat label="time" value={formatDuration(input.moving_time)} />
          <CardStat label="load" value={input.icu_training_load != null ? Math.round(input.icu_training_load).toString() : "—"} />
          <CardStat label="exercises" value={exercises.length ? exercises.length.toString() : "—"} />
        </div>
      </div>

      {input.notes && <p className="text-[13px] leading-relaxed text-fg-subtle whitespace-pre-line">{input.notes}</p>}

      {exercises.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[420px] font-mono text-xs">
            <thead>
              <tr className="text-[11px] text-fg-muted text-left">
                <th className="font-normal px-1 pb-1.5">exercise</th>
                <th className="font-normal px-1 pb-1.5 text-right">sets</th>
                <th className="font-normal px-1 pb-1.5 text-right">load</th>
                <th className="font-normal px-1 pb-1.5 text-right">RPE</th>
                <th className="font-normal px-1 pb-1.5 text-right">rest</th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((e, i) => (
                <tr key={i} className="border-t border-ink-hair align-top">
                  <td className="px-1 py-2 text-fg">
                    <span className="font-sans text-[13px]">{e.name}</span>
                    {(e.warmup_sets || e.notes) && (
                      <span className="block text-[11px] text-fg-muted mt-0.5">
                        {[e.warmup_sets ? `+${e.warmup_sets} warm-up` : null, e.notes].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-2 text-right whitespace-nowrap">{formatSetsReps(e)}</td>
                  <td className="px-1 py-2 text-right whitespace-nowrap">{e.weight_kg != null ? `${e.weight_kg} kg` : "—"}</td>
                  <td className="px-1 py-2 text-right">{e.rpe ?? "—"}</td>
                  <td className="px-1 py-2 text-right">{formatRest(e.rest_seconds) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SessionCardStatus
        status={shownStatus}
        errorText={outcome.failed ?? errorText}
        addedText={outcome.added}
        addedWarning={outcome.warning}
        onDecide={onDecide}
      />
    </SessionCardShell>
  );
}
