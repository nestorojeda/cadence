"use client";

import React from "react";
import { formatDuration } from "@/lib/intervals/metrics";
import { NO_ZONE_COLOR } from "@/lib/intervals/metrics";
import { POWER_ZONE_COLORS, powerZone, type WorkoutStep } from "@/lib/intervals/workout";

const WIDTH = 1000;
const HEIGHT = 96;
const UNTARGETED = 40;

function stepTitle(step: WorkoutStep) {
  const target =
    step.from === null
      ? ""
      : step.from === step.to
        ? ` @ ${Math.round(step.from)}%`
        : ` ramp ${Math.round(step.from)}–${Math.round(step.to ?? step.from)}%`;
  const minutes = step.duration >= 60 ? `${+(step.duration / 60).toFixed(1)}m` : `${step.duration}s`;
  return `${minutes}${target}${step.label ? ` · ${step.label}` : ""}`;
}

export function WorkoutChart({ steps }: { steps: WorkoutStep[] }) {
  const total = steps.reduce((sum, s) => sum + s.duration, 0);
  if (!total) return null;
  const peak = Math.max(125, ...steps.map((s) => Math.max(s.from ?? 0, s.to ?? 0) + 10));
  const y = (percent: number) => HEIGHT - (percent / peak) * HEIGHT;

  let x = 0;
  const blocks = steps.map((step, i) => {
    const x0 = x;
    const x1 = (x += (step.duration / total) * WIDTH);
    const from = step.from ?? UNTARGETED;
    const to = step.to ?? from;
    const color = step.from === null ? NO_ZONE_COLOR : POWER_ZONE_COLORS[powerZone((from + to) / 2)];
    return (
      <polygon
        key={i}
        points={`${x0},${HEIGHT} ${x0},${y(from)} ${Math.max(x0, x1 - 1.5)},${y(to)} ${Math.max(x0, x1 - 1.5)},${HEIGHT}`}
        // Inline style, not the fill attribute: NO_ZONE_COLOR is a CSS variable.
        style={{ fill: color }}
      >
        <title>{stepTitle(step)}</title>
      </polygon>
    );
  });

  return (
    <figure className="flex flex-col gap-1.5" aria-label={`Workout profile, ${steps.length} steps`}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="block h-24 w-full">
        {blocks}
        <line
          x1={0}
          x2={WIDTH}
          y1={y(100)}
          y2={y(100)}
          stroke="currentColor"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
          className="text-fg-muted"
        />
      </svg>
      <figcaption className="flex justify-between font-mono text-[11px] text-fg-muted">
        <span>0:00</span>
        <span>— 100% FTP</span>
        <span>{formatDuration(total)}</span>
      </figcaption>
    </figure>
  );
}
