// Shared by the server and the UI, so it must not import server-only code.

export interface ReportMetrics {
  /** Seconds. */
  movingTime?: number;
  plannedTime?: number;
  load?: number;
  plannedLoad?: number;
  normalizedPower?: number;
  /** Fraction, e.g. 0.86. */
  intensity?: number;
  /** Actual vs planned load (else time), as a percentage. */
  compliance?: number;
  averageHeartrate?: number;
}

export interface ReportMeta {
  activityId: string;
  eventId: number;
  /** Local date of the session, YYYY-MM-DD. */
  date: string;
  name: string;
  type?: string;
  status: "ready" | "failed";
  attempts: number;
  error?: string;
  metrics: ReportMetrics;
  createdAt: string;
  readAt?: string;
  /** Provider · model that wrote it. */
  model?: string;
}

export interface StoredReport {
  meta: ReportMeta;
  /** Markdown. */
  body: string;
  /** The planned workout text, for the profile chart. */
  workout?: string;
}

/** A completed planned workout from the last week that has no report yet. */
export interface PendingSession {
  activityId: string;
  eventId: number;
  date: string;
  name: string;
  type?: string;
  metrics: ReportMetrics;
}

export interface ReportsResponse {
  reports: ReportMeta[];
  pending: PendingSession[];
  /** False when the pending list couldn't be loaded from Intervals.icu. */
  pendingLoaded: boolean;
}

export const ACTIVITY_ID_PATTERN = /^i?\d{1,20}$/;

export const PENDING_DAYS = 7;

export const MAX_ATTEMPTS = 3;

export function isOnPlan(compliance?: number): boolean {
  return compliance !== undefined && compliance >= 85 && compliance <= 115;
}
