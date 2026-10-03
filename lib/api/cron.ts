import crypto from "crypto";

/**
 * Scheduled callers (a Vercel Cron Job, or `curl` from a system timer) send `Authorization: Bearer <CRON_SECRET>`.
 * Without CRON_SECRET nothing is authorized: the poll route spends LLM credits, so it is never open.
 */
export function isAuthorizedCron(authorization: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
