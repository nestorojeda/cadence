import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/api/cron";
import { pollSource, runPoll } from "@/lib/reports/poller";

// Writing a few reports means a few LLM calls; give the poll room on hosts that cap request time.
export const maxDuration = 300;

/**
 * Checks Intervals.icu for completed planned workouts and writes their reports, like one tick of the in-process
 * poller. For schedulers outside the app: the Vercel Cron Job in vercel.json, or a system timer with curl.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const source = pollSource();
  if ("disabled" in source) return NextResponse.json({ status: "disabled", error: source.disabled }, { status: 503 });

  const result = await runPoll(source);
  if (result.status === "failed") console.error("[GET /api/reports/poll] Poll failed:", result.error);
  return NextResponse.json(
    result.status === "done"
      ? {
          status: "done",
          written: result.written.map((r) => ({
            activityId: r.activityId,
            name: r.name,
            date: r.date,
            status: r.status,
          })),
        }
      : result,
    { status: result.status === "failed" ? 500 : 200 },
  );
}
