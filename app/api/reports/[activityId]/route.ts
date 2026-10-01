import { NextRequest, NextResponse } from "next/server";
import { missingAthlete, resolveAthleteId } from "@/lib/api/athlete";
import { deleteReport, isValidActivityId, loadReport, markRead } from "@/lib/storage/report-store";

type Params = { params: Promise<{ activityId: string }> };

const invalidId = () => NextResponse.json({ error: "Invalid activity ID" }, { status: 400 });
const notFound = () => NextResponse.json({ error: "Report not found" }, { status: 404 });

export async function GET(req: NextRequest, { params }: Params) {
  const { activityId } = await params;
  if (!isValidActivityId(activityId)) return invalidId();
  const athleteId = resolveAthleteId(req.nextUrl.searchParams.get("athleteId"));
  if (!athleteId) return missingAthlete();
  try {
    const report = await loadReport(athleteId, activityId);
    return report ? NextResponse.json(report) : notFound();
  } catch (error) {
    console.error("[GET /api/reports/:id] Error:", error);
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
  }
}

/** Marks the report read. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { activityId } = await params;
  if (!isValidActivityId(activityId)) return invalidId();
  const athleteId = resolveAthleteId(req.nextUrl.searchParams.get("athleteId"));
  if (!athleteId) return missingAthlete();
  try {
    const meta = await markRead(athleteId, activityId);
    return meta ? NextResponse.json(meta) : notFound();
  } catch (error) {
    console.error("[PATCH /api/reports/:id] Error:", error);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { activityId } = await params;
  if (!isValidActivityId(activityId)) return invalidId();
  const athleteId = resolveAthleteId(req.nextUrl.searchParams.get("athleteId"));
  if (!athleteId) return missingAthlete();
  try {
    await deleteReport(athleteId, activityId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/reports/:id] Error:", error);
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
  }
}
