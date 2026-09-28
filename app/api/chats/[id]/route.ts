import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteChat, isValidChatId, loadChat, renameChat } from "@/lib/storage/chat-store";
import { missingAthlete, resolveAthleteId } from "@/lib/api/athlete";

type Params = { params: Promise<{ id: string }> };

const renameSchema = z.object({
  title: z
    .string()
    .transform((t) => t.replace(/\s+/g, " ").trim().slice(0, 120))
    .pipe(z.string().min(1)),
});

const invalidId = () => NextResponse.json({ error: "Invalid chat ID" }, { status: 400 });
const notFound = () => NextResponse.json({ error: "Chat not found" }, { status: 404 });

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidChatId(id)) return invalidId();
  const athleteId = resolveAthleteId(req.nextUrl.searchParams.get("athleteId"));
  if (!athleteId) return missingAthlete();
  try {
    const chat = await loadChat(athleteId, id);
    return chat ? NextResponse.json(chat) : notFound();
  } catch (error) {
    console.error("[GET /api/chats/:id] Error:", error);
    return NextResponse.json({ error: "Failed to load chat" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidChatId(id)) return invalidId();
  const athleteId = resolveAthleteId(req.nextUrl.searchParams.get("athleteId"));
  if (!athleteId) return missingAthlete();
  try {
    const body = renameSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    const meta = await renameChat(athleteId, id, body.data.title);
    return meta ? NextResponse.json(meta) : notFound();
  } catch (error) {
    console.error("[PATCH /api/chats/:id] Error:", error);
    return NextResponse.json({ error: "Failed to rename chat" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidChatId(id)) return invalidId();
  const athleteId = resolveAthleteId(req.nextUrl.searchParams.get("athleteId"));
  if (!athleteId) return missingAthlete();
  try {
    await deleteChat(athleteId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/chats/:id] Error:", error);
    return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
  }
}
