export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("@/lib/db/client");
    const { importLegacyJson } = await import("@/lib/storage/import-json");
    const { startReportPoller } = await import("@/lib/reports/poller");
    try {
      await getDb();
      await importLegacyJson();
    } catch (error) {
      // The app still starts; chats and reports fail with this error until the database is reachable.
      console.error("[db] Database setup failed:", (error as Error).message);
    }
    startReportPoller();
  }
}
