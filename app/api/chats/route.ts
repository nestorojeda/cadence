import { NextRequest, NextResponse } from "next/server";
import { listChats } from "@/lib/storage/chat-store";

/** History list for an athlete: index metadata only, never transcripts. */
export async function GET(req: NextRequest) {
  try {
    const athleteId = req.nextUrl.searchParams.get("athleteId") || process.env.INTERVALS_ICU_ATHLETE_ID || "i435091";
    return NextResponse.json(await listChats(athleteId));
  } catch (error) {
    console.error("[GET /api/chats] Error:", error);
    return NextResponse.json({ error: "Failed to list chats" }, { status: 500 });
  }
}
