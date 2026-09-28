/**
 * The subset of Intervals.icu workout text the coach writes. Durations: `1h`, `12m`, `30s`, `1m30s`, `5'`, `30"`.
 * Targets: `%` of FTP (single, range or `ramp a-b`) or `Z1`–`Z7`. A repeat is a line ending (or starting) in `Nx`
 * followed by its steps up to the next blank line or header, or inline: `- 5x 3m 115%, 3m 50%`.
 */

export interface WorkoutStep {
  /** Seconds. */
  duration: number;
  /** %FTP; null when there is no power target. */
  from: number | null;
  to: number | null;
  label: string;
}

const ZONE_UPPER = [55, 75, 90, 105, 120, 150];
export const POWER_ZONE_COLORS = ["#94a3b8", "#38bdf8", "#4ade80", "#facc15", "#fb923c", "#f87171", "#c084fc"];
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
      closeRepeat();
      const count = line.match(REPEAT);
      if (count) repeat = { times: Number(count[1]), steps: [] };
      continue;
    }

    const body = line.replace(/^-\s*/, "");
    const inline = body.match(/^(\d+)\s*x\s+(.+)$/i);
    if (inline) {
      closeRepeat();
      const inner = inline[2]
        .split(/,|;/)
        .map(parseStep)
        .filter((s): s is WorkoutStep => s !== null);
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
