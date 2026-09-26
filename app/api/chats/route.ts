import { NextRequest, NextResponse } from "next/server";
import { listChats } from "@/lib/storage/chat-store";
import { missingAthlete, resolveAthleteId } from "@/lib/api/athlete";

/** History list for an athlete: index metadata only, never transcripts. */
export async function GET(req: NextRequest) {
  const athleteId = resolveAthleteId(req.nextUrl.searchParams.get("athleteId"));
  if (!athleteId) return missingAthlete();
  try {
    return NextResponse.json(await listChats(athleteId));
  } catch (error) {
    console.error("[GET /api/chats] Error:", error);
    return NextResponse.json({ error: "Failed to list chats" }, { status: 500 });
  }
}
