import type { IntervalsClient } from "@/lib/intervals/client";
import { daysFromToday } from "@/lib/intervals/compact";
import { getBaseline, listReports } from "@/lib/storage/report-store";
import { eligibleSessions, pendingSession, type Session } from "./eligible";
import { generateReport, type ReportContext } from "./generate";
import { MAX_ATTEMPTS, PENDING_DAYS, type PendingSession, type ReportMeta } from "./types";

export async function findSessions(client: IntervalsClient, days: number): Promise<Session[]> {
  const oldest = daysFromToday(-days);
  const newest = daysFromToday(0);
  const [activities, events] = await Promise.all([
    client.getActivities(100, oldest, newest),
    client.getEvents(oldest, newest),
  ]);
  return eligibleSessions(activities, events);
}

/** Sessions from the last week with no report at all (failed ones are listed as reports, with a Retry). */
export async function listPending(client: IntervalsClient, athleteId: string): Promise<PendingSession[]> {
  const [sessions, reports] = await Promise.all([findSessions(client, PENDING_DAYS), listReports(athleteId)]);
  const known = new Set(reports.map((r) => r.activityId));
  return sessions
    .filter((s) => !known.has(s.activity.id))
    .map(pendingSession)
    .sort((a, b) => b.date.localeCompare(a.date));
}

const running = new Map<string, Promise<ReportMeta>>();

/** One run per report at a time, whether the poller or the athlete started it. */
export function runReport(session: Session, ctx: ReportContext): Promise<ReportMeta> {
  const key = `${ctx.athleteId}/${session.activity.id}`;
  const current = running.get(key);
  if (current) return current;
  const run = generateReport(session, ctx).finally(() => running.delete(key));
  running.set(key, run);
  return run;
}

/** Reports the poller writes on its own: new uploads since the baseline, plus failed ones still worth retrying. */
export async function autoReports(
  client: IntervalsClient,
  ctx: Omit<ReportContext, "client" | "attempts">,
  now = new Date(),
): Promise<ReportMeta[]> {
  const [baseline, sessions, reports] = await Promise.all([
    getBaseline(ctx.athleteId, now),
    findSessions(client, 2),
    listReports(ctx.athleteId),
  ]);
  const byId = new Map(reports.map((r) => [r.activityId, r]));
  const due = sessions.filter(({ activity }) => {
    const uploaded = activity.created ?? activity.start_date;
    if (!uploaded || new Date(uploaded) < new Date(baseline)) return false;
    const report = byId.get(activity.id);
    return !report || (report.status === "failed" && report.attempts < MAX_ATTEMPTS);
  });
  const written: ReportMeta[] = [];
  for (const session of due) {
    written.push(await runReport(session, { ...ctx, client, attempts: byId.get(session.activity.id)?.attempts ?? 0 }));
  }
  return written;
}
