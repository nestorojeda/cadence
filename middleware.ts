import { NextResponse, type NextRequest } from "next/server";
import { rejectCrossSite } from "@/lib/api/csrf";

/** Refuses cross-site writes to the API (see lib/api/csrf.ts). */
export function middleware(req: NextRequest) {
  const reason = rejectCrossSite(req.method, req.headers);
  return reason ? NextResponse.json({ error: reason }, { status: 403 }) : NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
