import { NextRequest, NextResponse } from "next/server";
import { IntervalsClient } from "@/lib/intervals/client";
import { toLocalDate, type MetricsResponse } from "@/lib/intervals/metrics";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const athleteId = searchParams.get("athleteId") || process.env.INTERVALS_ICU_ATHLETE_ID || "i435091";
    // Key entered in Settings travels in a header (never the URL); falls back to the server's env var.
    const apiKey = req.headers.get("x-intervals-api-key") || process.env.INTERVALS_ICU_API_KEY || "";

    const client = new IntervalsClient(apiKey, athleteId);

    const today = new Date();
    const historyStart = new Date(today);
    historyStart.setDate(today.getDate() - 42);
    // Monday of the current week (getDay: Sunday = 0).
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStart = toLocalDate(monday);

    const [athlete, fitness, wellness, events] = await Promise.all([
      client.getAthlete(athleteId).catch((e) => {
        console.warn("Could not load athlete profile:", e);
        return null;
      }),
      client.getFitnessSummary(athleteId).catch((e) => {
        console.warn("Could not load fitness summary:", e);
        return null;
      }),
      client.getWellness(athleteId, toLocalDate(historyStart)).catch((e) => {
        console.warn("Could not load wellness history:", e);
        return [];
      }),
      client.getEvents(athleteId, weekStart, toLocalDate(sunday)).catch((e) => {
        console.warn("Could not load this week's calendar:", e);
        return [];
      }),
    ]);

    const formHistory = wellness.flatMap((r) => {
      const tsb = r.tsb ?? (r.ctl != null && r.atl != null ? r.ctl - r.atl : null);
      return tsb == null ? [] : [{ date: r.id, tsb: Math.round(tsb * 10) / 10 }];
    });

    const week = events
      .filter((e) => e.category !== "NOTE")
      .map((e) => ({
        date: e.start_date_local.slice(0, 10),
        name: e.name,
        type: e.type,
        category: e.category,
        movingTime: e.moving_time,
        load: e.icu_training_load,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const body: MetricsResponse = {
      athlete: athlete ? { id: athlete.id, name: athlete.name, firstname: athlete.firstname } : null,
      fitness,
      formHistory,
      week,
      weekStart,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[GET /api/metrics] Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
