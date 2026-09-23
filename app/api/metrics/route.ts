import { NextRequest, NextResponse } from "next/server";
import { IntervalsClient } from "@/lib/intervals/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const athleteId = searchParams.get("athleteId") || process.env.INTERVALS_ICU_ATHLETE_ID || "i435091";
    const apiKey = searchParams.get("apiKey") || process.env.INTERVALS_ICU_API_KEY || "";

    const client = new IntervalsClient(apiKey, athleteId);

    const [athlete, fitness] = await Promise.all([
      client.getAthlete(athleteId).catch((e) => {
        console.warn("Could not load athlete profile:", e);
        return null;
      }),
      client.getFitnessSummary(athleteId).catch((e) => {
        console.warn("Could not load fitness summary:", e);
        return null;
      }),
    ]);

    return NextResponse.json({
      athlete: athlete
        ? {
            id: athlete.id,
            name: athlete.name,
            firstname: athlete.firstname,
            lastname: athlete.lastname,
            city: athlete.city,
            country: athlete.country,
            weight: athlete.weight,
          }
        : null,
      fitness,
    });
  } catch (error) {
    console.error("[GET /api/metrics] Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
