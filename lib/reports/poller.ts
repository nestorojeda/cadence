import { getDb } from "@/lib/db/client";
import { IntervalsClient } from "@/lib/intervals/client";
import { resolveAthleteId } from "@/lib/api/athlete";
import { getAthleteTimeZone } from "@/lib/intervals/timezone";
import { errorMessage, resolveModel } from "@/lib/llm/provider";
import { autoReports } from "./service";

import type { ReportMeta } from "./types";

const DEFAULT_POLL_MINUTES = 10;

/** What a poll needs: the server's own Intervals.icu key and athlete (reports are written unattended). */
export interface PollSource {
  athleteId: string;
  intervalsKey: string;
}

export interface PollerConfig extends PollSource {
  minutes: number;
}

/** `disabled` says why when the server lacks what it needs to write reports unattended. */
export function pollSource(env: Record<string, string | undefined> = process.env): PollSource | { disabled: string } {
  const intervalsKey = env.INTERVALS_ICU_API_KEY;
  const athleteId = resolveAthleteId(env.INTERVALS_ICU_ATHLETE_ID);
  if (!intervalsKey || !athleteId)
    return { disabled: "INTERVALS_ICU_API_KEY and INTERVALS_ICU_ATHLETE_ID are not set" };
  return { athleteId, intervalsKey };
}

/** The in-process timer's settings. `REPORTS_POLL_MINUTES=0` turns it off (e.g. when a cron calls the poll route). */
export function pollerConfig(
  env: Record<string, string | undefined> = process.env,
): PollerConfig | { disabled: string } {
  const source = pollSource(env);
  if ("disabled" in source) return source;
  const raw = env.REPORTS_POLL_MINUTES?.trim();
  const minutes = raw ? Number(raw) : DEFAULT_POLL_MINUTES;
  if (!(minutes > 0)) return { disabled: "REPORTS_POLL_MINUTES is 0" };
  return { ...source, minutes };
}

export type PollResult =
  | { status: "done"; written: ReportMeta[] }
  /** Another process (the other container, an overlapping cron call) is polling right now. */
  | { status: "busy" }
  | { status: "paused" | "failed"; error: string };

async function pollOnce(source: PollSource): Promise<PollResult> {
  const resolved = resolveModel({
    provider: process.env.REPORT_MODEL_PROVIDER,
    modelName: process.env.REPORT_MODEL_NAME,
  });
  if ("error" in resolved) return { status: "paused", error: resolved.error };
  const client = new IntervalsClient(source.intervalsKey, source.athleteId);
  const timeZone = await getAthleteTimeZone(client, source.athleteId);
  const written = await autoReports(client, { athleteId: source.athleteId, resolved, timeZone });
  for (const r of written)
    console.log(`[reports] ${r.status === "ready" ? "Wrote" : "Failed"} report for ${r.name} (${r.date})`);
  return { status: "done", written };
}

/**
 * One check for newly uploaded workouts, used by the in-process timer and the poll route (`/api/reports/poll`).
 * Holds a lock shared through the database, so concurrent polls from any process never write the same report twice.
 */
export async function runPoll(source: PollSource): Promise<PollResult> {
  try {
    const db = await getDb();
    return (await db.withAdvisoryLock("cadence:report-poller", () => pollOnce(source))) ?? { status: "busy" };
  } catch (error) {
    return { status: "failed", error: errorMessage(error) };
  }
}

const started = globalThis as typeof globalThis & { __cadenceReportPoller?: boolean };

export function startReportPoller(): void {
  if (started.__cadenceReportPoller) return;
  started.__cadenceReportPoller = true;
  const config = pollerConfig();
  if ("disabled" in config) {
    console.log(`[reports] The in-process report poller is off: ${config.disabled}.`);
    return;
  }
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const result = await runPoll(config);
      if (result.status === "paused") console.warn(`[reports] Automatic reports are paused: ${result.error}`);
      if (result.status === "failed") console.warn("[reports] Poll failed:", result.error);
    } finally {
      busy = false;
    }
  };
  setInterval(() => void tick(), config.minutes * 60_000).unref();
  setTimeout(() => void tick(), 15_000).unref();
  console.log(`[reports] Checking Intervals.icu for completed workouts every ${config.minutes} min.`);
}
