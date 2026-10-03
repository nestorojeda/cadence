import { NextRequest, NextResponse } from "next/server";
import { listChats, searchChats } from "@/lib/storage/chat-store";
import { missingAthlete, resolveAthleteId } from "@/lib/api/athlete";

const MAX_QUERY_LENGTH = 200;

/** The chat list, or with `q` the chats whose title or messages match (`ChatSearchHit[]`). */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const athleteId = resolveAthleteId(params.get("athleteId"));
  if (!athleteId) return missingAthlete();
  const query = params.get("q")?.trim();
  if (query && query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Search text is too long" }, { status: 400 });
  }
  try {
    return NextResponse.json(query ? await searchChats(athleteId, query) : await listChats(athleteId));
  } catch (error) {
    console.error("[GET /api/chats] Error:", error);
    return NextResponse.json({ error: query ? "Failed to search chats" : "Failed to list chats" }, { status: 500 });
  }
}
