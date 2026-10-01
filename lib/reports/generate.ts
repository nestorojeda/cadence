import { generateText } from "ai";
import type { IntervalsClient } from "@/lib/intervals/client";
import { compactActivityDetails, compactIntervals } from "@/lib/intervals/compact";
import { getKeyEvents } from "@/lib/intervals/events";
import { formatDuration, type KeyEvent } from "@/lib/intervals/metrics";
import { getMemory } from "@/lib/storage/memory-store";
import { loadReport, saveReport } from "@/lib/storage/report-store";
import { errorMessage, type ResolvedModel } from "@/lib/llm/provider";
import { pendingSession, type Session } from "./eligible";
import { MAX_ATTEMPTS, type ReportMeta, type StoredReport } from "./types";

const INSTRUCTIONS = `You are an elite cycling coach writing a short post-session report for your athlete. It is read on its own, not as a chat: don't greet, don't ask questions, don't offer to do anything.

Compare what was done with what was planned, using only the data provided. Quote real numbers (watts, %FTP, heart rate, cadence, durations). If a figure is missing, don't invent it.

Write Markdown with exactly these sections, as "## " headings, in this order:
## Summary
Two or three sentences: how the session went overall and the one thing that matters most.
## Execution vs plan
How the work intervals compared with their targets (power, duration, number of reps), pacing, and anything cut short or overdone.
## Physiology
Heart rate response, drift/decoupling, cadence, and what they say about fatigue or fitness. Relate it to form (TSB) when given.
## Takeaways
Two to four bullet points the athlete can act on: recovery, fueling, how to adjust the next similar session, anything to watch before upcoming races.

Keep the whole report under 300 words. Use the athlete's units (metric).`;

export interface ReportContext {
  client: IntervalsClient;
  athleteId: string;
  resolved: ResolvedModel;
  /** Earlier failed attempts of this report. */
  attempts?: number;
}

function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function plannedLines(session: Session): string {
  const { event } = session;
  const facts = [
    event.moving_time ? `${formatDuration(event.moving_time)} h` : null,
    event.icu_training_load ? `${event.icu_training_load} TSS` : null,
  ].filter(Boolean);
  return `${event.name}${facts.length ? ` (${facts.join(", ")})` : ""}\n${event.description ?? "(no workout text)"}`;
}

function raceLines(keyEvents: KeyEvent[] | null): string {
  const races = (keyEvents ?? []).filter((e) => e.kind === "race").slice(0, 3);
  return races.length
    ? races.map((e) => `- ${e.date}: ${e.name} (${e.priority} race, in ${e.daysOut} d)`).join("\n")
    : "None.";
}

export async function buildReportPrompt(session: Session, client: IntervalsClient, athleteId: string) {
  const date = session.activity.start_date_local.slice(0, 10);
  const [details, intervals, wellness, memory, keyEvents] = await Promise.all([
    client.getActivity(session.activity.id),
    client.getActivityIntervals(session.activity.id).catch(() => null),
    client.getWellness(date, date).catch(() => []),
    getMemory(athleteId),
    getKeyEvents(client, athleteId).catch(() => null),
  ]);
  const day = wellness[0];
  const form = day
    ? `CTL ${Math.round(day.ctl ?? 0)}, ATL ${Math.round(day.atl ?? 0)}, TSB ${Math.round(day.tsb ?? (day.ctl ?? 0) - (day.atl ?? 0))}` +
      `${day.hrv ? `, HRV ${day.hrv}` : ""}${day.restingHR ? `, resting HR ${day.restingHR}` : ""}`
    : "Not available.";
  const facts = memory.facts.filter((f) => ["health", "feedback", "goal"].includes(f.category));

  return `Planned workout (Intervals.icu workout text, % is of FTP):
${plannedLines(session)}

Completed activity:
${JSON.stringify(compactActivityDetails(details))}

Laps / intervals:
${intervals?.icu_intervals?.length ? JSON.stringify(compactIntervals(intervals.icu_intervals)) : "Not available."}

Form on ${date}: ${form}

Upcoming races:
${raceLines(keyEvents)}

What the coach knows about the athlete:
${facts.length ? facts.map((f) => `- ${f.text}`).join("\n") : "Nothing relevant."}
${memory.plan ? `Current plan: ${memory.plan.phase}, focus ${memory.plan.focus}.` : ""}`;
}

/** Writes the report (or a failed entry) for one session and returns its meta. */
export async function generateReport(session: Session, ctx: ReportContext): Promise<ReportMeta> {
  const { activityId, eventId, date, name, type, metrics } = pendingSession(session);
  const base = { activityId, eventId, date, name, type, metrics, model: ctx.resolved.label };
  let report: StoredReport;
  try {
    const result = await generateText({
      model: ctx.resolved.model,
      instructions: INSTRUCTIONS,
      prompt: await buildReportPrompt(session, ctx.client, ctx.athleteId),
      providerOptions: ctx.resolved.providerOptions,
      timeout: 120_000,
    });
    const body = stripThinking(result.text);
    if (!body) throw new Error("The model returned an empty report.");
    report = {
      meta: { ...base, status: "ready", attempts: (ctx.attempts ?? 0) + 1, createdAt: new Date().toISOString() },
      body,
      workout: session.event.description,
    };
  } catch (error) {
    const attempts = (ctx.attempts ?? 0) + 1;
    console.warn(
      `[reports] Could not write the report for ${activityId} (attempt ${attempts}/${MAX_ATTEMPTS}):`,
      errorMessage(error),
    );
    report = {
      meta: {
        ...base,
        status: "failed",
        attempts,
        error: ctx.resolved.describeError(error),
        createdAt: new Date().toISOString(),
      },
      body: "",
      workout: session.event.description,
    };
  }
  if (report.meta.status === "failed" && (await loadReport(ctx.athleteId, activityId))?.meta.status === "ready") {
    return report.meta;
  }
  await saveReport(ctx.athleteId, report);
  return report.meta;
}
