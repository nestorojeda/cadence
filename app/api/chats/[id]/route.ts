import { NextRequest, NextResponse } from "next/server";
import { deleteChat, isValidChatId, loadChat, renameChat } from "@/lib/storage/chat-store";

type Params = { params: Promise<{ id: string }> };

function athleteIdOf(req: NextRequest) {
  return req.nextUrl.searchParams.get("athleteId") || process.env.INTERVALS_ICU_ATHLETE_ID || "i435091";
}

const invalidId = () => NextResponse.json({ error: "Invalid chat ID" }, { status: 400 });
const notFound = () => NextResponse.json({ error: "Chat not found" }, { status: 404 });

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidChatId(id)) return invalidId();
  try {
    const chat = await loadChat(athleteIdOf(req), id);
    return chat ? NextResponse.json(chat) : notFound();
  } catch (error) {
    console.error("[GET /api/chats/:id] Error:", error);
    return NextResponse.json({ error: "Failed to load chat" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidChatId(id)) return invalidId();
  try {
    const { title } = (await req.json()) as { title?: unknown };
    const clean = typeof title === "string" ? title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    if (!clean) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    const meta = await renameChat(athleteIdOf(req), id, clean);
    return meta ? NextResponse.json(meta) : notFound();
  } catch (error) {
    console.error("[PATCH /api/chats/:id] Error:", error);
    return NextResponse.json({ error: "Failed to rename chat" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidChatId(id)) return invalidId();
  try {
    await deleteChat(athleteIdOf(req), id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/chats/:id] Error:", error);
    return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
  }
}
