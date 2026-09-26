import { NextRequest, NextResponse } from "next/server";
import { getPreferences, savePreferences } from "@/lib/storage/preferences-store";
import { CoachPreferences } from "@/lib/types/preferences";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const athleteId = searchParams.get("athleteId") || process.env.INTERVALS_ICU_ATHLETE_ID || "i435091";

    const preferences = await getPreferences(athleteId);
    return NextResponse.json(preferences);
  } catch (error) {
    console.error("[GET /api/preferences] Error:", error);
    return NextResponse.json({ error: "Failed to retrieve preferences" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CoachPreferences>;
    const athleteId = body.athleteId || process.env.INTERVALS_ICU_ATHLETE_ID || "i435091";

    const current = await getPreferences(athleteId);
    const updated: CoachPreferences = {
      ...current,
      ...body,
      gym: { ...current.gym, ...body.gym },
      athleteId,
      updatedAt: new Date().toISOString(),
    };

    await savePreferences(updated);
    return NextResponse.json({ success: true, preferences: updated });
  } catch (error) {
    console.error("[POST /api/preferences] Error:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
