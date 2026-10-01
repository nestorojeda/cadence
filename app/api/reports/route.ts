import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { missingAthlete, resolveAthleteId } from "@/lib/api/athlete";
import { IntervalsClient, type ActivitySummary } from "@/lib/intervals/client";
import { THINKING_LEVELS, type ThinkingLevel } from "@/lib/llm/models";
import { errorMessage, resolveModel } from "@/lib/llm/provider";
import { eligibleSessions } from "@/lib/reports/eligible";
import { listPending, runReport } from "@/lib/reports/service";
import type { PendingSession, ReportsResponse } from "@/lib/reports/types";
import { isValidActivityId, listReports, loadReport } from "@/lib/storage/report-store";

export const maxDuration = 180;

const optionalString = z.string().max(4096).optional();

const generateSchema = z.object({
  activityId: z.string().refine(isValidActivityId),
  athleteId: optionalString,
  modelProvider: optionalString,
  modelName: optionalString,
  thinkingLevel: optionalString.transform((v) =>
    THINKING_LEVELS.includes(v as ThinkingLevel) ? (v as ThinkingLevel) : undefined,
  ),
  apiKey: optionalString,
  intervalsApiKey: optionalString,
});

export async function GET(req: NextRequest) {
  const athleteId = resolveAthleteId(req.nextUrl.searchParams.get("athleteId"));
  if (!athleteId) return missingAthlete();
  try {
    const apiKey = req.headers.get("x-intervals-api-key") || process.env.INTERVALS_ICU_API_KEY || "";
    const reports = await listReports(athleteId);
    let pending: PendingSession[] = [];
    let pendingLoaded = false;
    if (req.nextUrl.searchParams.get("pending") !== "0") {
      try {
        pending = await listPending(new IntervalsClient(apiKey, athleteId), athleteId);
        pendingLoaded = true;
      } catch (error) {
        console.warn("[GET /api/reports] Could not load recent sessions:", errorMessage(error));
      }
    }
    const body: ReportsResponse = { reports, pending, pendingLoaded };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[GET /api/reports] Error:", error);
    return NextResponse.json({ error: "Could not load reports." }, { status: 500 });
  }
}

/** Generates (or retries) one report with the model chosen in Settings. */
export async function POST(req: NextRequest) {
  const body = generateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Expected an `activityId`." }, { status: 400 });
  const { activityId, modelProvider, modelName, thinkingLevel, apiKey, intervalsApiKey } = body.data;
  const athleteId = resolveAthleteId(body.data.athleteId);
  if (!athleteId) return missingAthlete();

  const resolved = resolveModel({ provider: modelProvider, modelName, apiKey, thinkingLevel });
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });

  try {
    const client = new IntervalsClient(intervalsApiKey || process.env.INTERVALS_ICU_API_KEY || "", athleteId);
    const activity = (await client.getActivity(activityId)) as unknown as ActivitySummary;
    const event = activity.paired_event_id ? await client.getEvent(String(activity.paired_event_id)) : null;
    const [session] = event ? eligibleSessions([activity], [event]) : [];
    if (!session) {
      return NextResponse.json(
        { error: "Only sessions that completed a planned workout get a report (not free rides or gym sessions)." },
        { status: 400 },
      );
    }
    const existing = await loadReport(athleteId, activityId);
    const meta = await runReport(session, { client, athleteId, resolved, attempts: existing?.meta.attempts ?? 0 });
    return NextResponse.json(meta);
  } catch (error) {
    console.error("[POST /api/reports] Error:", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
