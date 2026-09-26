/**
 * Parses the Intervals.icu workout text of a planned session (the event `description`) into timed steps, so the chat
 * can draw its power profile. Supports the subset the coach writes:
 *
 *   Warmup
 *   - 12m ramp 50-65%
 *
 *   Main set 5x
 *   - 3m 115%
 *   - 3m 50%
 *
 * Durations: `1h`, `12m`, `30s`, `1m30s`, `5'`, `30"`. Targets: `%` of FTP (single, range or `ramp a-b`) or zones
 * `Z1`–`Z7`. A repeat is a line ending (or starting) in `Nx` followed by its steps, up to the next blank line or
 * header; an inline `- 5x 3m 115%, 3m 50%` is accepted too. Other tokens (cadence, HR, labels) are ignored.
 */

export interface WorkoutStep {
  /** Seconds. */
  duration: number;
  /** %FTP at the start and end of the step (equal unless it's a ramp); null when there is no power target. */
  from: number | null;
  to: number | null;
  /** Free text left on the line, e.g. "Warmup" or "95rpm". */
  label: string;
}

/** Coggan power zones by upper bound in %FTP; the last zone is open-ended. */
const ZONE_UPPER = [55, 75, 90, 105, 120, 150];
/** Z1–Z7; the single source for zone colours (sidebar week, Coach rules, cards reuse them). */
export const POWER_ZONE_COLORS = ["#94a3b8", "#38bdf8", "#4ade80", "#facc15", "#fb923c", "#f87171", "#c084fc"];
/** %FTP drawn for a `Zn` target: roughly the middle of the zone. */
const ZONE_MIDPOINT = [45, 65, 83, 98, 113, 135, 160];

export function powerZone(percent: number): number {
  const zone = ZONE_UPPER.findIndex((upper) => percent < upper);
  return zone === -1 ? ZONE_UPPER.length : zone;
}

const DURATION = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i;

function parseDuration(token: string): number | null {
  const prime = token.match(/^(\d+(?:\.\d+)?)(['"])$/);
  if (prime) return Number(prime[1]) * (prime[2] === "'" ? 60 : 1);
  const match = token.match(DURATION);
  if (!match || !(match[1] || match[2] || match[3])) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function parseStep(text: string): WorkoutStep | null {
  let duration = 0;
  let from: number | null = null;
  let to: number | null = null;
  const label: string[] = [];

  const tokens = text.trim().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const seconds = parseDuration(token);
    if (seconds !== null && !duration) {
      duration = seconds;
      continue;
    }
    const percent = token.match(/^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?%$/);
    if (percent && from === null) {
      const low = Number(percent[1]);
      const high = percent[2] ? Number(percent[2]) : low;
      const ramp = tokens[i - 1]?.toLowerCase() === "ramp";
      // A range is drawn at its middle; a ramp goes from one end to the other.
      from = ramp ? low : (low + high) / 2;
      to = ramp ? high : (low + high) / 2;
      continue;
    }
    const zone = token.match(/^Z([1-7])$/i);
    if (zone && from === null && !/^hr$/i.test(tokens[i + 1] ?? "")) {
      from = to = ZONE_MIDPOINT[Number(zone[1]) - 1];
      continue;
    }
    if (token.toLowerCase() === "ramp") continue;
    // Options like `power=1s` or `intensity=warmup` aren't targets.
    if (!token.includes("=")) label.push(token);
  }
  return duration > 0 ? { duration, from, to, label: label.join(" ") } : null;
}

const REPEAT = /(?:^|\s)(\d+)\s*x(?:\s|$)/i;

/** Timed steps of a workout description, with repeats expanded. Empty when nothing could be parsed. */
export function parseWorkout(description: string | undefined): WorkoutStep[] {
  if (!description) return [];
  const steps: WorkoutStep[] = [];
  let repeat: { times: number; steps: WorkoutStep[] } | null = null;
  const closeRepeat = () => {
    if (repeat) for (let i = 0; i < repeat.times; i++) steps.push(...repeat.steps);
    repeat = null;
  };

  for (const raw of description.split("\n")) {
    const line = raw.trim();
    if (!line) {
      closeRepeat();
      continue;
    }

    if (!line.startsWith("-")) {
      // A header: section name, optionally with a repeat count ("Main set 5x").
      closeRepeat();
      const count = line.match(REPEAT);
      if (count) repeat = { times: Number(count[1]), steps: [] };
      continue;
    }

    const body = line.replace(/^-\s*/, "");
    const inline = body.match(/^(\d+)\s*x\s+(.+)$/i);
    if (inline) {
      // "- 5x 3m 115%, 3m 50%": a repeat on one line.
      closeRepeat();
      const inner = inline[2].split(/,|;/).map(parseStep).filter((s): s is WorkoutStep => s !== null);
      for (let i = 0; i < Number(inline[1]); i++) steps.push(...inner);
      continue;
    }

    const step = parseStep(body);
    if (!step) continue;
    if (repeat) repeat.steps.push(step);
    else steps.push(step);
  }
  closeRepeat();
  return steps;
}
