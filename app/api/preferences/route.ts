import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPreferences, savePreferences } from "@/lib/storage/preferences-store";
import { CoachPreferences } from "@/lib/types/preferences";
import type { GymPreferences } from "@/lib/coach/gym";
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

type PreferencesUpdate = Partial<Omit<CoachPreferences, "updatedAt" | "gym">> & { gym?: Partial<GymPreferences> };

const day = z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
const days = z.array(day).max(7);
const hours = z.number().min(0).max(168);

/** A partial update: every field optional, unknown fields dropped, so a request can't write arbitrary JSON to disk. */
const updateSchema = z.object({
  athleteId: z.string().optional(),
  weeklyVolumeMinHours: hours.optional(),
  weeklyVolumeMaxHours: hours.optional(),
  longRideDays: days.optional(),
  intervalDays: days.optional(),
  restDays: days.optional(),
  gymDays: days.optional(),
  gym: z
    .object({
      goals: z
        .array(z.enum(["cycling_performance", "injury_prevention", "muscle", "bone_health", "mobility"]))
        .max(5)
        .optional(),
      experience: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      equipment: z.enum(["full_gym", "home", "bodyweight"]).optional(),
      sessionMinutes: z.number().min(0).max(600).optional(),
      notes: z.string().max(4000).optional(),
    })
    .optional(),
  backToBackIntervals: z.boolean().optional(),
  shortNamingConvention: z.boolean().optional(),
  terrain: z.enum(["flat", "rolling", "hilly", "mountainous"]).optional(),
  customNotes: z.string().max(8000).optional(),
}) satisfies z.ZodType<PreferencesUpdate>;

export async function POST(req: NextRequest) {
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: `Invalid preferences: ${parsed.error.issues[0]?.message}` }, { status: 400 });
  }
  const { athleteId: requested, gym, ...rest } = parsed.data;
  const athleteId = resolveAthleteId(requested);
  if (!athleteId) return missingAthlete();

  try {
    const current = await getPreferences(athleteId);
    const updated: CoachPreferences = {
      ...current,
      ...rest,
      gym: { ...current.gym, ...gym },
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
