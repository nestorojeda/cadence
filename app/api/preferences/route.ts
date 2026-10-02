import { NextRequest, NextResponse } from "next/server";
import { getPreferences, updatePreferences } from "@/lib/storage/preferences-store";
import { preferencesUpdateSchema } from "@/lib/coach/rules";
import { missingAthlete, resolveAthleteId } from "@/lib/api/athlete";

export async function GET(req: NextRequest) {
  const athleteId = resolveAthleteId(req.nextUrl.searchParams.get("athleteId"));
  if (!athleteId) return missingAthlete();
  try {
    const preferences = await getPreferences(athleteId);
    return NextResponse.json(preferences);
  } catch (error) {
    console.error("[GET /api/preferences] Error:", error);
    return NextResponse.json({ error: "Failed to retrieve preferences" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const parsed = preferencesUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: `Invalid preferences: ${parsed.error.issues[0]?.message}` }, { status: 400 });
  }
  const { athleteId: requested, ...update } = parsed.data;
  const athleteId = resolveAthleteId(requested);
  if (!athleteId) return missingAthlete();

  try {
    const result = await updatePreferences(athleteId, update);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, preferences: result.after });
  } catch (error) {
    console.error("[POST /api/preferences] Error:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
