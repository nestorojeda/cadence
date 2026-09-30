"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { mergePreferences, ruleChanges, type ProposeRulesResult, type RulesPatch } from "@/lib/coach/rules";
import type { CoachPreferences } from "@/lib/types/preferences";
import { SessionCardShell, SessionCardStatus, type WorkoutCardStatus } from "./SessionCardParts";

interface RulesCardProps {
  input: Partial<RulesPatch & { reason: string }>;
  status: WorkoutCardStatus;
  output?: ProposeRulesResult;
  errorText?: string;
  onDecide?: (approved: boolean) => void;
  athleteId: string;
}

export function RulesCard({ input, status, output, errorText, onDecide, athleteId }: RulesCardProps) {
  const [current, setCurrent] = useState<CoachPreferences | null>(null);
  const applied = status === "added" && output;

  useEffect(() => {
    if (applied) return;
    let cancelled = false;
    fetch(`/api/preferences?athleteId=${encodeURIComponent(athleteId)}`)
      .then((res) => res.json() as Promise<CoachPreferences | { error: string }>)
      .then((data) => {
        if (!cancelled && data && !("error" in data)) setCurrent(data);
      })
      .catch((e) => console.warn("Could not load preferences:", e));
    return () => {
      cancelled = true;
    };
  }, [applied, athleteId]);

  const { reason: _reason, ...patch } = input;
  const changes = applied ? output.changes : current ? ruleChanges(current, mergePreferences(current, patch)) : null;

  return (
    <SessionCardShell status={status}>
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[11px] text-fg-muted">COACH RULES</span>
        {input.reason && <p className="text-[13px] leading-relaxed text-fg-subtle">{input.reason}</p>}
      </div>

      {changes === null ? (
        <span className="font-mono text-xs text-fg-muted">Loading your current rules…</span>
      ) : changes.length === 0 ? (
        <span className="text-[13px] text-fg-subtle">
          {applied ? "Nothing needed changing." : "Matches your current rules."}
        </span>
      ) : (
        <dl className="flex flex-col font-mono text-xs">
          {changes.map((change) => (
            <div
              key={change.label}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-ink-hair py-2 first:border-t-0 first:pt-0"
            >
              <dt className="font-sans text-[13px] text-fg">{change.label}</dt>
              <dd className="flex items-center gap-2">
                <span className="text-fg-muted line-through">{change.before}</span>
                <ArrowRight className="h-3 w-3 shrink-0 text-fg-muted" />
                <span className="text-fg">{change.after}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <SessionCardStatus status={status} kind="rules" errorText={errorText} onDecide={onDecide} />
    </SessionCardShell>
  );
}
