"use client";

import React from "react";
import { RotateCw } from "lucide-react";
import { CadenceMark } from "@/components/CadenceMark";
import type { PendingSession, ReportMeta } from "@/lib/reports/types";
import { complianceClass, sessionColor, sessionLine, weekGroup } from "./format";

interface ReportListProps {
  reports: ReportMeta[];
  pending: PendingSession[];
  pendingLoaded: boolean;
  loading: boolean;
  selectedId?: string;
  running: Set<string>;
  errors: Record<string, string>;
  onSelect: (id: string) => void;
  onGenerate: (id: string) => void;
}

const SECTION_LABEL = "px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted";

export function ReportList({
  reports,
  pending,
  pendingLoaded,
  loading,
  selectedId,
  running,
  errors,
  onSelect,
  onGenerate,
}: ReportListProps) {
  const ready = reports.filter((r) => r.status === "ready");
  const failed = reports.filter((r) => r.status === "failed");
  const groups = ["This week", "Last week", "Earlier"]
    .map((label) => ({ label, items: ready.filter((r) => weekGroup(r.date) === label) }))
    .filter((g) => g.items.length > 0);
  const notAnalyzed = [
    ...failed.map((r) => ({ id: r.activityId, date: r.date, name: r.name, metrics: r.metrics, error: r.error })),
    ...pending.map((p) => ({ id: p.activityId, date: p.date, name: p.name, metrics: p.metrics, error: undefined })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center gap-2 px-5 py-6 text-[13px] text-fg-muted">
        <CadenceMark size={16} spinning />
        Loading reports…
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-6">
      {groups.length === 0 && (
        <p className="px-5 pt-5 text-[13px] leading-relaxed text-fg-muted">
          Reports appear here after you complete a planned workout. Free rides and gym sessions are skipped.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.label} className="flex flex-col">
          <h2 className={SECTION_LABEL}>{group.label}</h2>
          {group.items.map((r) => {
            const selected = r.activityId === selectedId;
            return (
              <button
                key={r.activityId}
                onClick={() => onSelect(r.activityId)}
                aria-current={selected ? "true" : undefined}
                className={`flex gap-3 border-b border-ink-hair px-5 py-3.5 text-left transition ${
                  selected ? "bg-ink-raised" : "hover:bg-ink-raised/60"
                }`}
              >
                <span
                  className="w-1 shrink-0 self-stretch rounded-sm"
                  style={{ background: sessionColor(r.metrics) }}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{r.name}</span>
                    {!r.readAt && (
                      <span aria-label="Unread" className="h-[7px] w-[7px] shrink-0 rounded-full bg-signal" />
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-fg-muted">{sessionLine(r.date, r.metrics)}</span>
                  <span className="mt-1 flex gap-1.5">
                    {r.metrics.compliance !== undefined && (
                      <span
                        className={`rounded-md bg-ink-raised px-2 py-0.5 font-mono text-[11px] ${complianceClass(r.metrics.compliance)}`}
                      >
                        {r.metrics.compliance}% of plan
                      </span>
                    )}
                    {r.metrics.intensity !== undefined && (
                      <span className="rounded-md bg-ink-raised px-2 py-0.5 font-mono text-[11px] text-fg-soft">
                        IF {r.metrics.intensity.toFixed(2)}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      ))}

      {(notAnalyzed.length > 0 || !pendingLoaded) && (
        <section className="flex flex-col">
          <h2 className={SECTION_LABEL}>Last 7 days · not analyzed</h2>
          {!pendingLoaded && (
            <p className="px-5 pb-2 text-[13px] text-fg-muted">
              Couldn&apos;t load recent sessions from Intervals.icu.
            </p>
          )}
          {notAnalyzed.map((s) => {
            const isRunning = running.has(s.id);
            const error = errors[s.id] ?? s.error;
            return (
              <div key={s.id} className="flex gap-3 border-b border-ink-hair px-5 py-3.5">
                <span
                  className="w-1 shrink-0 self-stretch rounded-sm"
                  style={{ background: sessionColor(s.metrics) }}
                />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm text-fg-soft">{s.name}</span>
                    <span
                      title={error}
                      className={`truncate font-mono text-[11px] ${error && !isRunning ? "text-signal-warn" : "text-fg-muted"}`}
                    >
                      {error && !isRunning ? `Failed · ${error}` : sessionLine(s.date, s.metrics)}
                    </span>
                  </div>
                  <button
                    onClick={() => onGenerate(s.id)}
                    disabled={isRunning}
                    className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs transition sm:h-8 ${
                      error
                        ? "border-ink-edge text-fg hover:bg-ink-raised"
                        : "border-signal text-signal hover:bg-signal hover:text-on-signal"
                    } disabled:cursor-wait disabled:border-ink-edge disabled:bg-transparent disabled:text-fg-muted`}
                  >
                    {isRunning ? (
                      <CadenceMark size={14} spinning />
                    ) : error ? (
                      <RotateCw className="h-3.5 w-3.5" />
                    ) : null}
                    {isRunning ? "Writing…" : error ? "Retry" : "Generate report"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
