"use client";

import React from "react";
import { AlertTriangle, CalendarCog, CalendarMinus, CalendarPlus, Check, X } from "lucide-react";
import { CadenceMark } from "@/components/CadenceMark";

/** `pending`: proposed by the coach, waiting for the athlete; `declined`: skipped, never written. */
export type WorkoutCardStatus = "pending" | "adding" | "added" | "declined" | "failed";

export function formatDay(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .replace(",", "")
    .toUpperCase();
}

/** What a card proposes to do to the calendar; picks the card's wording. */
export type SessionCardKind = "create" | "update" | "delete";

const COPY: Record<
  SessionCardKind,
  { icon: typeof CalendarPlus; pending: string; approve: string; declined: string; working: string; done: string; failed: string }
> = {
  create: {
    icon: CalendarPlus,
    pending: "Not on your calendar yet",
    approve: "Add to calendar",
    declined: "Not added",
    working: "Adding to your calendar…",
    done: "Added to your Intervals.icu calendar",
    failed: "Couldn’t add to calendar",
  },
  update: {
    icon: CalendarCog,
    pending: "Not changed yet",
    approve: "Apply change",
    declined: "Not changed",
    working: "Updating your calendar…",
    done: "Updated on your Intervals.icu calendar",
    failed: "Couldn’t change it",
  },
  delete: {
    icon: CalendarMinus,
    pending: "Still on your calendar",
    approve: "Remove",
    declined: "Kept on your calendar",
    working: "Removing from your calendar…",
    done: "Removed from your Intervals.icu calendar",
    failed: "Couldn’t remove it",
  },
};

/** Outer shell of a session card; dashed while it waits for the athlete. */
export function SessionCardShell({ status, children }: { status: WorkoutCardStatus; children: React.ReactNode }) {
  return (
    <div
      className={`border rounded-[14px] bg-ink-card px-5 py-4 flex flex-col gap-4 transition ${
        status === "pending" ? "border-ink-edge border-dashed" : "border-ink-line"
      } ${status === "declined" ? "opacity-50" : ""}`}
    >
      {children}
    </div>
  );
}

export function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span className="text-[15px]">{value}</span>
    </div>
  );
}

/** Status row with Add/Skip while pending. `added` may carry a note (e.g. a partial Hevy failure). */
export function SessionCardStatus({
  status,
  kind = "create",
  errorText,
  addedText,
  addedWarning,
  onDecide,
}: {
  status: WorkoutCardStatus;
  kind?: SessionCardKind;
  errorText?: string;
  /** Replaces the kind's default "done" text. */
  addedText?: string;
  /** Shown with a warning icon next to `addedText` when part of the write failed. */
  addedWarning?: string;
  /** Approves (true) or skips (false) a pending change; omitted when the athlete can't decide right now. */
  onDecide?: (approved: boolean) => void;
}) {
  const copy = COPY[kind];
  const Icon = copy.icon;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" role="status">
      {status === "pending" && (
        <>
          <Icon className="w-3.5 h-3.5 text-fg-muted" />
          <span className="text-fg-subtle mr-auto">{copy.pending}</span>
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
            {copy.approve}
          </button>
        </>
      )}
      {status === "declined" && (
        <>
          <X className="w-3.5 h-3.5 text-fg-muted" />
          <span className="text-fg-subtle">{copy.declined}</span>
        </>
      )}
      {status === "added" && (
        <>
          <Check className="w-3.5 h-3.5 text-signal" strokeWidth={2.5} />
          <span className="text-fg-subtle">{addedText ?? copy.done}</span>
          {addedWarning && (
            <span className="basis-full flex items-start gap-2 text-fg-subtle break-words">
              <AlertTriangle className="w-3.5 h-3.5 text-signal-warn shrink-0" />
              {addedWarning}
            </span>
          )}
        </>
      )}
      {status === "adding" && (
        <>
          <CadenceMark size={14} spinning />
          <span className="text-fg-subtle">{copy.working}</span>
        </>
      )}
      {status === "failed" && (
        <>
          <AlertTriangle className="w-3.5 h-3.5 text-signal-warn shrink-0" />
          <span className="text-fg-subtle break-words">{copy.failed}{errorText ? `: ${errorText}` : ""}</span>
        </>
      )}
    </div>
  );
}
