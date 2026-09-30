import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clearPlan, getMemory, removeFact } from "@/lib/storage/memory-store";
import { missingAthlete, resolveAthleteId } from "@/lib/api/athlete";

export async function GET(req: NextRequest) {
  const athleteId = resolveAthleteId(req.nextUrl.searchParams.get("athleteId"));
  if (!athleteId) return missingAthlete();
  try {
    return NextResponse.json(await getMemory(athleteId));
  } catch (error) {
    console.error("[GET /api/memory] Error:", error);
    return NextResponse.json({ error: "Failed to load the coach's memory" }, { status: 500 });
  }
}

const deleteSchema = z.union([
  z.object({ athleteId: z.string().optional(), factId: z.string().min(1).max(64) }),
  z.object({ athleteId: z.string().optional(), plan: z.literal(true) }),
]);

export async function DELETE(req: NextRequest) {
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected a `factId`, or `plan: true`." }, { status: 400 });
  }
  const athleteId = resolveAthleteId(parsed.data.athleteId);
  if (!athleteId) return missingAthlete();
  try {
    if ("factId" in parsed.data) {
      await removeFact(athleteId, parsed.data.factId);
    } else {
      await clearPlan(athleteId);
    }
    return NextResponse.json(await getMemory(athleteId));
  } catch (error) {
    console.error("[DELETE /api/memory] Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
