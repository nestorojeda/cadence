import fs from "fs/promises";
import path from "path";
import { ACTIVITY_ID_PATTERN, type ReportMeta, type StoredReport } from "@/lib/reports/types";
import { writeJsonAtomic } from "./json-file";
import { withLock } from "./lock";

function athleteDir(athleteId: string): string {
  const sanitized = athleteId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized) throw new Error("Invalid athlete ID");
  return path.join(process.cwd(), "data", "reports", sanitized);
}

export function isValidActivityId(id: unknown): id is string {
  return typeof id === "string" && ACTIVITY_ID_PATTERN.test(id);
}

function reportFile(athleteId: string, activityId: string): string {
  if (!isValidActivityId(activityId)) throw new Error("Invalid activity ID");
  return path.join(athleteDir(athleteId), `${activityId}.json`);
}

const indexFile = (athleteId: string) => path.join(athleteDir(athleteId), "index.json");
const stateFile = (athleteId: string) => path.join(athleteDir(athleteId), "state.json");

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

const lockAthlete = <T>(athleteId: string, fn: () => Promise<T>) => withLock(athleteDir(athleteId), fn);

async function writeIndex(athleteId: string, update: (index: ReportMeta[]) => ReportMeta[]) {
  const index = (await readJson<ReportMeta[]>(indexFile(athleteId))) ?? [];
  const next = update(index).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  await writeJsonAtomic(indexFile(athleteId), next);
}

export async function listReports(athleteId: string): Promise<ReportMeta[]> {
  return (await readJson<ReportMeta[]>(indexFile(athleteId))) ?? [];
}

export async function loadReport(athleteId: string, activityId: string): Promise<StoredReport | null> {
  return readJson<StoredReport>(reportFile(athleteId, activityId));
}

export async function saveReport(athleteId: string, report: StoredReport): Promise<void> {
  await lockAthlete(athleteId, async () => {
    await writeJsonAtomic(reportFile(athleteId, report.meta.activityId), report);
    await writeIndex(athleteId, (index) => [
      ...index.filter((m) => m.activityId !== report.meta.activityId),
      report.meta,
    ]);
  });
}

export async function markRead(athleteId: string, activityId: string): Promise<ReportMeta | null> {
  return lockAthlete(athleteId, async () => {
    const report = await readJson<StoredReport>(reportFile(athleteId, activityId));
    if (!report) return null;
    if (report.meta.readAt) return report.meta;
    report.meta = { ...report.meta, readAt: new Date().toISOString() };
    await writeJsonAtomic(reportFile(athleteId, activityId), report);
    await writeIndex(athleteId, (index) => index.map((m) => (m.activityId === activityId ? report.meta : m)));
    return report.meta;
  });
}

export async function deleteReport(athleteId: string, activityId: string): Promise<void> {
  await lockAthlete(athleteId, async () => {
    await fs.rm(reportFile(athleteId, activityId), { force: true });
    await writeIndex(athleteId, (index) => index.filter((m) => m.activityId !== activityId));
  });
}

/** When automatic reports started: only activities uploaded after it are generated without asking. */
export async function getBaseline(athleteId: string, now = new Date()): Promise<string> {
  return lockAthlete(athleteId, async () => {
    const state = await readJson<{ baseline?: string }>(stateFile(athleteId));
    if (state?.baseline) return state.baseline;
    const baseline = now.toISOString();
    await writeJsonAtomic(stateFile(athleteId), { baseline });
    return baseline;
  });
}
