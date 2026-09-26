import { NextResponse } from "next/server";

/** Intervals.icu athlete IDs look like `i12345`; the same charset keeps them safe as file names under `data/`. */
const ATHLETE_ID = /^[A-Za-z0-9_-]{1,32}$/;

/**
 * The athlete a request is for: the ID from Settings, else `INTERVALS_ICU_ATHLETE_ID`. Null when neither is set or
 * the ID is malformed — callers answer with `missingAthlete()`.
 */
export function resolveAthleteId(requested?: string | null): string | null {
  const id = requested?.trim() || process.env.INTERVALS_ICU_ATHLETE_ID?.trim() || "";
  return ATHLETE_ID.test(id) ? id : null;
}

export const missingAthlete = () =>
  NextResponse.json(
    { error: "No valid Intervals.icu athlete ID. Set it in Settings or INTERVALS_ICU_ATHLETE_ID in .env.local." },
    { status: 400 }
  );
