import { NextRequest, NextResponse } from "next/server";
import { IntervalsClient, type ActivitySummary } from "@/lib/intervals/client";
import { toLocalDate, type MetricsResponse, type WeekActivity } from "@/lib/intervals/metrics";

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

    const [athlete, fitness, wellness, events, activities] = await Promise.all([
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
      client.getActivities(athleteId, 50, weekStart, toLocalDate(sunday)).catch((e) => {
        console.warn("Could not load this week's activities:", e);
        return [];
      }),
    ]);

    const formHistory = wellness.flatMap((r) => {
      const tsb = r.tsb ?? (r.ctl != null && r.atl != null ? r.ctl - r.atl : null);
      return tsb == null ? [] : [{ date: r.id, tsb: Math.round(tsb * 10) / 10 }];
    });

    // Pair each planned session with the activity that fulfilled it: Intervals.icu's own match first, then the
    // first unused activity of the same sport on the same day.
    const unused = new Set(activities);
    const take = (match: (a: ActivitySummary) => boolean) => {
      const found = [...unused].find(match);
      if (found) unused.delete(found);
      return found;
    };
    const planned = events
      .filter((e) => e.category !== "NOTE")
      .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));
    const paired = new Map(planned.map((e) => [e.id, take((a) => a.paired_event_id === e.id)]));
    const week = planned.map((e) => {
      const date = e.start_date_local.slice(0, 10);
      const activity =
        paired.get(e.id) ??
        take((a) => !a.paired_event_id && a.start_date_local.slice(0, 10) === date && (!e.type || a.type === e.type));
      return {
        id: e.id,
        date,
        name: e.name,
        type: e.type,
        category: e.category,
        movingTime: e.moving_time,
        load: e.icu_training_load,
        completed: activity ? weekActivity(activity) : undefined,
      };
    });
    const unplanned = [...unused].map(weekActivity).sort((a, b) => a.date.localeCompare(b.date));

    const body: MetricsResponse = {
      athlete: athlete ? { id: athlete.id, name: athlete.name, firstname: athlete.firstname } : null,
      fitness,
      formHistory,
      week,
      unplanned,
      weekStart,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[GET /api/metrics] Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

function weekActivity(a: ActivitySummary): WeekActivity {
  return {
    date: a.start_date_local.slice(0, 10),
    name: a.name,
    type: a.type,
    movingTime: a.moving_time,
    load: a.icu_training_load,
    intensity: a.icu_intensity ? a.icu_intensity / 100 : undefined,
  };
}
