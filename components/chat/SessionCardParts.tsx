"use client";

import React from "react";
import { AlertTriangle, CalendarCog, CalendarMinus, CalendarPlus, Check, X } from "lucide-react";
import { CadenceMark } from "@/components/CadenceMark";

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

export type SessionCardKind = "create" | "update" | "delete";

const COPY: Record<
  SessionCardKind,
  {
    icon: typeof CalendarPlus;
    pending: string;
    approve: string;
    declined: string;
    working: string;
    done: string;
    failed: string;
  }
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

export function SessionCardShell({ status, children }: { status: WorkoutCardStatus; children: React.ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-[14px] border bg-ink-card px-5 py-4 transition ${
        status === "pending" ? "border-dashed border-ink-edge" : "border-ink-line"
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
  addedText?: string;
  addedWarning?: string;
  onDecide?: (approved: boolean) => void;
}) {
  const copy = COPY[kind];
  const Icon = copy.icon;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" role="status">
      {status === "pending" && (
        <>
          <Icon className="h-3.5 w-3.5 text-fg-muted" />
          <span className="mr-auto text-fg-subtle">{copy.pending}</span>
          <button
            type="button"
            disabled={!onDecide}
            onClick={() => onDecide?.(false)}
            className="h-8 rounded-lg border border-ink-edge px-3 text-fg transition hover:bg-ink-raised disabled:opacity-40"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={!onDecide}
            onClick={() => onDecide?.(true)}
            className="h-8 rounded-lg bg-signal px-3 font-semibold text-on-signal transition hover:brightness-95 disabled:opacity-40"
          >
            {copy.approve}
          </button>
        </>
      )}
      {status === "declined" && (
        <>
          <X className="h-3.5 w-3.5 text-fg-muted" />
          <span className="text-fg-subtle">{copy.declined}</span>
        </>
      )}
      {status === "added" && (
        <>
          <Check className="h-3.5 w-3.5 text-signal" strokeWidth={2.5} />
          <span className="text-fg-subtle">{addedText ?? copy.done}</span>
          {addedWarning && (
            <span className="flex basis-full items-start gap-2 break-words text-fg-subtle">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-signal-warn" />
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
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-signal-warn" />
          <span className="break-words text-fg-subtle">
            {copy.failed}
            {errorText ? `: ${errorText}` : ""}
          </span>
        </>
      )}
    </div>
  );
}
