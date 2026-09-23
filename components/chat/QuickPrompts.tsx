"use client";

import React from "react";
import { Activity, Calendar, Compass, BatteryCharging } from "lucide-react";

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickPrompts({ onSelectPrompt, disabled }: QuickPromptsProps) {
  const prompts = [
    {
      icon: BatteryCharging,
      title: "Assess Readiness",
      prompt: "Assess my current fitness (CTL), fatigue (ATL), form (TSB), and readiness to train based on my Intervals.icu data.",
      color: "text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/5",
    },
    {
      icon: Calendar,
      title: "Plan This Week",
      prompt: "Plan my upcoming training week based on my current fatigue and my active schedule preferences (intervals, Saturday long ride, gym).",
      color: "text-cyan-400 border-cyan-500/20 hover:border-cyan-500/40 bg-cyan-500/5",
    },
    {
      icon: Activity,
      title: "Review Recent Rides",
      prompt: "Review my recent rides and activities this past week. How did my actual power and TSS compare to targets?",
      color: "text-amber-400 border-amber-500/20 hover:border-amber-500/40 bg-amber-500/5",
    },
    {
      icon: Compass,
      title: "Saturday Mountain Ride",
      prompt: "What workout structure and fueling strategy should I target for my Saturday Gran Canaria mountain ride (+2,000m climbing)?",
      color: "text-purple-400 border-purple-500/20 hover:border-purple-500/40 bg-purple-500/5",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-4">
      {prompts.map((item, idx) => {
        const Icon = item.icon;
        return (
          <button
            key={idx}
            disabled={disabled}
            onClick={() => onSelectPrompt(item.prompt)}
            className={`p-3 rounded-xl border text-left transition flex items-start gap-3 text-xs disabled:opacity-50 ${item.color}`}
          >
            <div className="mt-0.5 p-1 rounded-lg bg-slate-900/60 border border-white/5">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-200">{item.title}</div>
              <div className="text-slate-400 line-clamp-1 mt-0.5">{item.prompt}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
