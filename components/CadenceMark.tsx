import React from "react";

interface CadenceMarkProps {
  /** Rendered width and height in px. */
  size?: number;
  /** Turn like a crank while the coach is working (still under prefers-reduced-motion). */
  spinning?: boolean;
  className?: string;
}

/**
 * The Cadence logo: a chainring with a lit lead pedal and a muted trailing one.
 * Spins at 90 rpm (one turn per pedal stroke) via the `animate-pedal` Tailwind animation.
 */
export function CadenceMark({ size = 20, spinning = false, className = "" }: CadenceMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${spinning ? "motion-safe:animate-pedal" : ""} ${className}`}
    >
      <circle cx="12" cy="12" r="8" strokeWidth="2" className="stroke-fg-faint" />
      <circle cx="17.66" cy="6.34" r="3" className="fill-signal" />
      <circle cx="6.34" cy="17.66" r="3" className="fill-fg-muted" />
    </svg>
  );
}
