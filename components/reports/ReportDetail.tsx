"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, RotateCw } from "lucide-react";
import { CadenceMark } from "@/components/CadenceMark";
import { WorkoutChart } from "@/components/chat/WorkoutChart";
import { formatDuration } from "@/lib/intervals/metrics";
import { parseWorkout } from "@/lib/intervals/workout";
import type { StoredReport } from "@/lib/reports/types";
import { complianceClass, longDay } from "./format";

interface ReportDetailProps {
  report: StoredReport | null;
  loading: boolean;
  regenerating: boolean;
  /** Last regenerate error; the saved report is kept. */
  error?: string;
  onBack: () => void;
  onRegenerate: () => void;
}

function Tile({
  label,
  value,
  detail,
  className = "",
}: {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-ink-line px-3.5 py-3">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span className={`font-display text-[34px] font-bold leading-[0.95] sm:text-[40px] ${className}`}>{value}</span>
      {detail && <span className="font-mono text-[11px] text-fg-muted">{detail}</span>}
    </div>
  );
}

export function ReportDetail({ report, loading, regenerating, error, onBack, onRegenerate }: ReportDetailProps) {
  const steps = useMemo(() => parseWorkout(report?.workout), [report?.workout]);

  if (!report) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-fg-muted">
        {loading ? <CadenceMark size={20} spinning /> : "Pick a report to read it."}
      </div>
    );
  }

  const { meta, body } = report;
  const m = meta.metrics;
  const generated = new Date(meta.createdAt).toLocaleString("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 box-content flex h-14 shrink-0 items-center justify-between gap-2 border-b border-ink-hair bg-ink/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6 lg:px-10 lg:pt-0">
        <div className="flex min-w-0 items-center gap-1">
          <button
            onClick={onBack}
            aria-label="Back to reports"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:text-fg lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="truncate font-mono text-xs text-fg-muted">{longDay(meta.date)} · planned workout</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`https://intervals.icu/activities/${meta.activityId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-8 items-center rounded-lg border border-ink-line px-3 text-xs transition hover:bg-ink-raised sm:flex"
          >
            Open in Intervals.icu
          </a>
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            aria-label="Regenerate report"
            className="flex h-10 items-center gap-1.5 rounded-lg border border-ink-line px-3 text-xs transition hover:bg-ink-raised disabled:cursor-wait sm:h-8"
          >
            {regenerating ? <CadenceMark size={14} spinning /> : <RotateCw className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Regenerate</span>
          </button>
        </div>
      </div>

      <article className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        {error && !regenerating && (
          <p
            role="alert"
            className="rounded-[10px] border border-signal-warn/40 px-3.5 py-2.5 text-[13px] text-signal-warn"
          >
            Couldn&apos;t regenerate the report: {error}
          </p>
        )}
        <h1 className="text-[22px] font-semibold tracking-tight sm:text-[26px]">{meta.name}</h1>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
          <Tile
            label="Duration"
            value={formatDuration(m.movingTime)}
            detail={m.plannedTime ? `plan ${formatDuration(m.plannedTime)}` : undefined}
          />
          <Tile
            label="Load"
            value={m.load ? String(Math.round(m.load)) : "—"}
            detail={m.plannedLoad ? `plan ${Math.round(m.plannedLoad)} TSS` : "TSS"}
          />
          <Tile
            label="NP · IF"
            value={m.normalizedPower ? String(Math.round(m.normalizedPower)) : "—"}
            detail={m.intensity ? `IF ${m.intensity.toFixed(2)}` : undefined}
          />
          <Tile
            label="Compliance"
            value={m.compliance !== undefined ? `${m.compliance}%` : "—"}
            detail={m.plannedLoad ? "of planned load" : "of planned time"}
            className={complianceClass(m.compliance)}
          />
        </div>

        {steps.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">Planned profile</h2>
            <WorkoutChart steps={steps} />
          </section>
        )}

        {body ? (
          <div className="coach-md break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-[13px] text-signal-warn">{meta.error ?? "This report is empty."}</p>
        )}

        <span className="font-mono text-[11px] text-fg-faint">
          Generated {generated}
          {meta.model ? ` · ${meta.model}` : ""}
        </span>
      </article>
    </div>
  );
}
