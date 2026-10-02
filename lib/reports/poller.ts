import { IntervalsClient } from "@/lib/intervals/client";
import { resolveAthleteId } from "@/lib/api/athlete";
import { getAthleteTimeZone } from "@/lib/intervals/timezone";
import { errorMessage, resolveModel } from "@/lib/llm/provider";
import { autoReports } from "./service";

const DEFAULT_POLL_MINUTES = 10;

export interface PollerConfig {
  athleteId: string;
  intervalsKey: string;
  minutes: number;
}

/** `disabled` says why when the server lacks what it needs to write reports unattended. */
export function pollerConfig(
  env: Record<string, string | undefined> = process.env,
): PollerConfig | { disabled: string } {
  const intervalsKey = env.INTERVALS_ICU_API_KEY;
  const athleteId = resolveAthleteId(env.INTERVALS_ICU_ATHLETE_ID);
  if (!intervalsKey || !athleteId)
    return { disabled: "INTERVALS_ICU_API_KEY and INTERVALS_ICU_ATHLETE_ID are not set" };
  const raw = env.REPORTS_POLL_MINUTES?.trim();
  const minutes = raw ? Number(raw) : DEFAULT_POLL_MINUTES;
  if (!(minutes > 0)) return { disabled: "REPORTS_POLL_MINUTES is 0" };
  return { athleteId, intervalsKey, minutes };
}

export async function pollOnce(config: PollerConfig): Promise<void> {
  const resolved = resolveModel({
    provider: process.env.REPORT_MODEL_PROVIDER,
    modelName: process.env.REPORT_MODEL_NAME,
  });
  if ("error" in resolved) {
    console.warn(`[reports] Automatic reports are paused: ${resolved.error}`);
    return;
  }
  const client = new IntervalsClient(config.intervalsKey, config.athleteId);
  try {
    const timeZone = await getAthleteTimeZone(client, config.athleteId);
    const written = await autoReports(client, { athleteId: config.athleteId, resolved, timeZone });
    for (const r of written)
      console.log(`[reports] ${r.status === "ready" ? "Wrote" : "Failed"} report for ${r.name} (${r.date})`);
  } catch (error) {
    console.warn("[reports] Poll failed:", errorMessage(error));
  }
}

const started = globalThis as typeof globalThis & { __cadenceReportPoller?: boolean };

export function startReportPoller(): void {
  if (started.__cadenceReportPoller) return;
  started.__cadenceReportPoller = true;
  const config = pollerConfig();
  if ("disabled" in config) {
    console.log(`[reports] Automatic reports are off: ${config.disabled}.`);
    return;
  }
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await pollOnce(config);
    } finally {
      busy = false;
    }
  };
  setInterval(() => void tick(), config.minutes * 60_000).unref();
  setTimeout(() => void tick(), 15_000).unref();
  console.log(`[reports] Checking Intervals.icu for completed workouts every ${config.minutes} min.`);
}
