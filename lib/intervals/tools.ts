import { tool } from "ai";
import { z } from "zod";
import { IntervalsClient } from "./client";
import {
  MAX_WELLNESS_DAYS,
  compactActivities,
  compactActivityDetails,
  compactEvents,
  compactWellness,
  daysFromToday,
  wellnessRange,
} from "./compact";

// Read tools return trimmed records (see ./compact) with bounded default date ranges: raw Intervals.icu responses are
// large and every result is re-sent to the model on each later step of the turn.
type Row = Record<string, unknown>;

/**
 * Creates Vercel AI SDK tools bound to an IntervalsClient instance.
 */
export function getIntervalsTools(client: IntervalsClient) {
  return {
    icu_get_fitness_summary: tool({
      description:
        "Get current fitness, fatigue, and form snapshot (CTL, ATL, TSB, ramp rate, form status) from Intervals.icu.",
      inputSchema: z.object({
        athlete_id: z.string().optional().describe("Athlete ID (optional, defaults to primary athlete)"),
      }),
      execute: async ({ athlete_id }) => {
        try {
          return await client.getFitnessSummary(athlete_id);
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    icu_get_wellness_data: tool({
      description:
        "Get daily wellness records (fitness/fatigue/form, HRV, resting HR, sleep, readiness, soreness, eFTP) for a date " +
        `range of at most ${MAX_WELLNESS_DAYS} days. For current form alone, prefer icu_get_fitness_summary.`,
      inputSchema: z.object({
        athlete_id: z.string().optional().describe("Athlete ID"),
        oldest: z.string().optional().describe("Oldest date in YYYY-MM-DD format (defaults to 14 days ago)"),
        newest: z.string().optional().describe("Newest date in YYYY-MM-DD format (defaults to today)"),
      }),
      execute: async ({ athlete_id, oldest, newest }) => {
        try {
          const range = wellnessRange(oldest, newest);
          const records = await client.getWellness(athlete_id, range.oldest, range.newest);
          return compactWellness(records as unknown as Row[]);
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    icu_get_recent_activities: tool({
      description:
        "List recent training activities, rides, distances, normalized power, TSS, and elevation gain.",
      inputSchema: z.object({
        athlete_id: z.string().optional().describe("Athlete ID"),
        limit: z.number().int().min(1).max(30).optional().default(10).describe("Max activities to return (default 10, max 30)"),
        oldest: z.string().optional().describe("Oldest date in YYYY-MM-DD format (defaults to 30 days ago)"),
        newest: z.string().optional().describe("Newest date in YYYY-MM-DD format"),
      }),
      execute: async ({ athlete_id, limit, oldest, newest }) => {
        try {
          const activities = await client.getActivities(athlete_id, limit, oldest, newest);
          return compactActivities(activities as unknown as Row[]);
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    icu_get_activity_details: tool({
      description:
        "Get full detailed breakdown, power metrics, heart rate zones, and interval splits for a specific activity.",
      inputSchema: z.object({
        activity_id: z.string().describe("Intervals.icu Activity ID"),
      }),
      execute: async ({ activity_id }) => {
        try {
          return compactActivityDetails(await client.getActivity(activity_id));
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    icu_get_calendar_events: tool({
      description:
        "Get calendar events on Intervals.icu. `category` is WORKOUT (planned session), NOTE, RACE_A / RACE_B / RACE_C " +
        "(race by priority), or HOLIDAY / SICK / INJURED (time off; `end_date_local` is exclusive). Upcoming races and " +
        "time off are already listed in your instructions; pass a later `newest` to look beyond the default window.",
      inputSchema: z.object({
        athlete_id: z.string().optional().describe("Athlete ID"),
        oldest: z.string().optional().describe("Oldest date in YYYY-MM-DD format (defaults to 7 days ago)"),
        newest: z.string().optional().describe("Newest date in YYYY-MM-DD format (defaults to 14 days ahead)"),
      }),
      execute: async ({ athlete_id, oldest, newest }) => {
        try {
          const events = await client.getEvents(athlete_id, oldest || daysFromToday(-7), newest || daysFromToday(14));
          return compactEvents(events as unknown as Row[]);
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    icu_create_calendar_event: tool({
      description:
        "Create a scheduled workout or note event directly on the Intervals.icu calendar.",
      inputSchema: z.object({
        athlete_id: z.string().describe("Athlete ID"),
        name: z.string().describe("Short workout name (e.g. 'VO2', 'OU', 'Endurance')"),
        start_date_local: z.string().describe("Date/time in ISO-8601 format (e.g. '2026-09-25T09:00:00')"),
        type: z.string().default("Ride").describe("Activity type (Ride, VirtualRide, Workout, Note)"),
        category: z.enum(["WORKOUT", "NOTE"]).default("WORKOUT").describe("Event category"),
        description: z
          .string()
          .optional()
          .describe(
            "For workouts: the steps in Intervals.icu workout syntax, one step per line starting with '- ' " +
              "(duration like 10m / 30s / 1m30s, target like 75% or 50-65% of FTP, 'ramp 50-75%', or Z2). " +
              "Repeats: a header line ending in 'Nx' (e.g. 'Main set 5x') followed by its steps, closed by a blank line. " +
              "Separate sections with blank lines. For notes: free text."
          ),
        moving_time: z.number().optional().describe("Target duration in seconds"),
        icu_training_load: z.number().optional().describe("Target TSS"),
      }),
      execute: async ({ athlete_id, ...eventData }) => {
        try {
          return await client.createEvent(athlete_id, eventData);
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),
  };
}
