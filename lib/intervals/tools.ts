import { tool } from "ai";
import { z } from "zod";
import { IntervalsClient } from "./client";

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
        "Get daily wellness records (HRV, resting heart rate, sleep quality, soreness, fatigue) for a date range.",
      inputSchema: z.object({
        athlete_id: z.string().optional().describe("Athlete ID"),
        oldest: z.string().optional().describe("Oldest date in YYYY-MM-DD format (defaults to 14 days ago)"),
        newest: z.string().optional().describe("Newest date in YYYY-MM-DD format (defaults to today)"),
      }),
      execute: async ({ athlete_id, oldest, newest }) => {
        try {
          return await client.getWellness(athlete_id, oldest, newest);
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
        limit: z.number().optional().default(10).describe("Max activities to return (default 10)"),
        oldest: z.string().optional().describe("Oldest date in YYYY-MM-DD format (defaults to 30 days ago)"),
        newest: z.string().optional().describe("Newest date in YYYY-MM-DD format"),
      }),
      execute: async ({ athlete_id, limit, oldest, newest }) => {
        try {
          return await client.getActivities(athlete_id, limit, oldest, newest);
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
          return await client.getActivity(activity_id);
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    icu_get_calendar_events: tool({
      description:
        "Get calendar events (planned workouts, notes, races) scheduled on Intervals.icu.",
      inputSchema: z.object({
        athlete_id: z.string().optional().describe("Athlete ID"),
        oldest: z.string().optional().describe("Oldest date in YYYY-MM-DD format (defaults to 7 days ago)"),
        newest: z.string().optional().describe("Newest date in YYYY-MM-DD format (defaults to 14 days ahead)"),
      }),
      execute: async ({ athlete_id, oldest, newest }) => {
        try {
          return await client.getEvents(athlete_id, oldest, newest);
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
        description: z.string().optional().describe("Workout interval instructions or notes"),
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
