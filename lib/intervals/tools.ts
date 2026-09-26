import { tool } from "ai";
import { z } from "zod";
import { IntervalsClient } from "./client";
import { HevyClient } from "@/lib/hevy/client";
import { routineTitle, toHevyRoutine } from "@/lib/hevy/routine";
import { formatGymDescription, type GymSessionInput, type GymSessionResult } from "@/lib/coach/gym";
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

const gymExerciseSchema = z.object({
  name: z
    .string()
    .describe("Exercise name. With Hevy connected, its exact Hevy title from hevy_search_exercises (e.g. 'Squat (Barbell)')"),
  hevy_exercise_id: z.string().optional().describe("Hevy exercise template id from hevy_search_exercises, when known"),
  sets: z.number().int().min(1).max(10).describe("Working sets"),
  warmup_sets: z.number().int().min(0).max(5).optional().describe("Ramp-up sets before the working sets"),
  reps: z.number().int().min(1).max(50).optional().describe("Reps per working set (fixed target)"),
  rep_min: z.number().int().min(1).max(50).optional().describe("Bottom of a rep range, with rep_max (instead of reps)"),
  rep_max: z.number().int().min(1).max(50).optional().describe("Top of a rep range"),
  duration_seconds: z.number().int().min(5).max(600).optional().describe("Seconds per set for holds/carries (planks, carries)"),
  weight_kg: z.number().min(0).optional().describe("Working load in kg, from the athlete's recent lifts when known"),
  rpe: z.number().min(5).max(10).optional().describe("Target RPE for the working sets (e.g. 7, 8, 8.5)"),
  rest_seconds: z.number().int().min(0).max(600).optional().describe("Rest between sets"),
  notes: z.string().optional().describe("Short cue (tempo, form, side-to-side)"),
});

/**
 * Creates Vercel AI SDK tools bound to an IntervalsClient instance. With a Hevy client, gym sessions are also created
 * as Hevy routines.
 */
export function getIntervalsTools(client: IntervalsClient, hevy: HevyClient | null = null) {
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

    create_gym_session: tool({
      description:
        "Schedule a strength (gym) session with its exercises, sets, reps, load and RPE: creates a WeightTraining " +
        "workout on the Intervals.icu calendar" +
        (hevy ? " and a matching routine in the athlete's Hevy app." : ".") +
        " Use this for every gym session instead of icu_create_calendar_event.",
      inputSchema: z.object({
        athlete_id: z.string().describe("Athlete ID"),
        name: z.string().describe("Short session name (e.g. 'Gym', 'Gym · Legs', 'Strength A')"),
        start_date_local: z.string().describe("Date/time in ISO-8601 format (e.g. '2026-09-29T18:00:00')"),
        moving_time: z.number().optional().describe("Planned duration in seconds, warm-up included"),
        icu_training_load: z.number().optional().describe("Estimated load (TSS-equivalent), typically 20–50"),
        notes: z.string().optional().describe("Session intent and warm-up/mobility, 1–3 short lines"),
        exercises: z.array(gymExerciseSchema).min(1).max(12),
        ...(hevy
          ? {
              hevy_only: z
                .boolean()
                .optional()
                .describe(
                  "Only create the Hevy routine, for a session already on the Intervals.icu calendar (e.g. retrying a failed Hevy sync). Never set it for new sessions."
                ),
            }
          : {}),
      }),
      execute: async ({ athlete_id, ...session }): Promise<GymSessionResult> => {
        const input = session as GymSessionInput;
        const [intervals, hevyResult] = await Promise.all([
          input.hevy_only && hevy
            ? Promise.resolve("skipped" as const)
            : client
                .createEvent(athlete_id, {
                  name: input.name,
                  start_date_local: input.start_date_local,
                  type: "WeightTraining",
                  category: "WORKOUT",
                  description: formatGymDescription(input),
                  moving_time: input.moving_time,
                  icu_training_load: input.icu_training_load,
                })
                .then((event) => ({ id: event.id }))
                .catch((error: Error) => ({ error: error.message })),
          hevy
            ? createHevyRoutine(hevy, input).catch((error: Error) => ({ error: error.message }))
            : Promise.resolve("not_connected" as const),
        ]);
        return { intervals, hevy: hevyResult };
      },
    }),
  };
}

async function createHevyRoutine(hevy: HevyClient, input: GymSessionInput) {
  // The folder is a nicety: if it can't be found or made, the routine goes in Hevy's default "My Routines".
  const [templates, folderId] = await Promise.all([
    hevy.getExerciseTemplates(),
    hevy.getOrCreateFolder().catch((error: Error) => {
      console.warn("[create_gym_session] Hevy folder unavailable, using My Routines:", error.message);
      return null;
    }),
  ]);
  const title = routineTitle(input);
  const { routine, unmatched } = toHevyRoutine(input, templates, folderId, title);
  if (routine.exercises.length === 0) {
    return { error: `None of the exercises match the Hevy library: ${unmatched.join(", ")}` };
  }
  const created = await hevy.createRoutine(routine);
  return { routine_id: created.id, title, ...(unmatched.length ? { unmatched } : {}) };
}
