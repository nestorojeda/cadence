"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

const PROMPTS = [
  {
    title: "Am I ready to train hard?",
    sub: "Fitness, fatigue, form and recent HRV",
    prompt: "Assess my current fitness (CTL), fatigue (ATL), form (TSB), and readiness to train based on my Intervals.icu data.",
  },
  {
    title: "Plan this week",
    sub: "Around your fatigue and your saved coach rules",
    prompt: "Plan my upcoming training week based on my current fatigue and my active schedule preferences (intervals, Saturday long ride, gym).",
  },
  {
    title: "Review my recent rides",
    sub: "Power and TSS against what was planned",
    prompt: "Review my recent rides and activities this past week. How did my actual power and TSS compare to targets?",
  },
  {
    title: "Prepare my long ride",
    sub: "Pacing and fueling for your terrain",
    prompt: "What structure, pacing and fueling strategy should I target for my next long ride, given my local terrain?",
  },
];

/** Short follow-ups offered under the composer once a conversation is going. */
export const COMPOSER_CHIPS = [
  { label: "Readiness", prompt: "How ready am I to train today?" },
  { label: "Last ride", prompt: "Review my most recent ride." },
  { label: "Move a workout", prompt: "I need to move a planned workout. What do you suggest?" },
];

export function QuickPrompts({ onSelectPrompt, disabled }: QuickPromptsProps) {
  return (
    <div className="flex flex-col border-t border-ink-hair">
      {PROMPTS.map((item, idx) => (
        <button
          key={item.title}
          disabled={disabled}
          onClick={() => onSelectPrompt(item.prompt)}
          className="group flex items-center gap-4 min-h-14 py-2 px-1 border-b border-ink-hair text-left transition hover:bg-ink-rail disabled:opacity-50"
        >
          <span className="w-5 font-mono text-xs text-fg-muted">{(idx + 1).toString().padStart(2, "0")}</span>
          <span className="flex-1 flex flex-col gap-0.5">
            <span className="text-[15px] font-medium">{item.title}</span>
            <span className="text-[13px] text-fg-muted">{item.sub}</span>
          </span>
          <ArrowRight className="w-4 h-4 text-fg-muted transition group-hover:text-signal group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
  );
}
