export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReportPoller } = await import("@/lib/reports/poller");
    startReportPoller();
  }
}
