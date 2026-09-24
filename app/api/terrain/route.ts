import { NextRequest, NextResponse } from "next/server";
import { IntervalsClient } from "@/lib/intervals/client";
import { toLocalDate } from "@/lib/intervals/metrics";
import { summarizeTerrain } from "@/lib/intervals/terrain";

const LOOKBACK_DAYS = 90;

/** Suggests the athlete's terrain type from their recent outdoor rides. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const athleteId = searchParams.get("athleteId") || process.env.INTERVALS_ICU_ATHLETE_ID || "i435091";
    // Key entered in Settings travels in a header (never the URL); falls back to the server's env var.
    const apiKey = req.headers.get("x-intervals-api-key") || process.env.INTERVALS_ICU_API_KEY || "";

    const client = new IntervalsClient(apiKey, athleteId);
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    const activities = await client.getActivities(athleteId, 200, toLocalDate(since));

    const summary = summarizeTerrain(activities);
    if (!summary) {
      return NextResponse.json(
        { error: `Not enough outdoor rides in the last ${LOOKBACK_DAYS} days to tell.` },
        { status: 422 }
      );
    }
    return NextResponse.json({ ...summary, days: LOOKBACK_DAYS });
  } catch (error) {
    console.error("[GET /api/terrain] Error:", error);
    return NextResponse.json({ error: "Could not load your rides from Intervals.icu." }, { status: 500 });
  }
}
