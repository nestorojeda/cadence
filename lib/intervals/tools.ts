import { tool } from "ai";
import { z } from "zod";
import { IntervalsClient } from "./client";
import { HevyClient } from "@/lib/hevy/client";
import { routineTitle, toHevyRoutine } from "@/lib/hevy/routine";
import { formatGymDescription, type GymSessionInput, type GymSessionResult } from "@/lib/coach/gym";
import { editBlockReason } from "./events";
import {
  MAX_EVENT_DAYS,
  MAX_WELLNESS_DAYS,
  compactActivities,
  compactActivityDetails,
  compactEvents,
  compactWellness,
  eventsRange,
  wellnessRange,
} from "./compact";
import { daysFromToday } from "./timezone";

// No athlete ID in tool inputs: the client is bound to the athlete the route resolved.
type Row = Record<string, unknown>;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const EVENT_DESCRIPTION_HINT =
  "For workouts: the steps in Intervals.icu workout syntax, one step per line starting with '- ' " +
  "(duration like 10m / 30s / 1m30s, target like 75% or 50-65% of FTP, 'ramp 50-75%', or Z2). " +
  "Repeats: a header line ending in 'Nx' (e.g. 'Main set 5x') followed by its steps, closed by a blank line. " +
  "Separate sections with blank lines. For notes: free text.";

const gymExerciseSchema = z.object({
  name: z
    .string()
    .describe(
      "Exercise name. With Hevy connected, its exact Hevy title from hevy_search_exercises (e.g. 'Squat (Barbell)')",
    ),
  hevy_exercise_id: z.string().optional().describe("Hevy exercise template id from hevy_search_exercises, when known"),
  sets: z.number().int().min(1).max(10).describe("Working sets"),
  warmup_sets: z.number().int().min(0).max(5).optional().describe("Ramp-up sets before the working sets"),
  reps: z.number().int().min(1).max(50).optional().describe("Reps per working set (fixed target)"),
  rep_min: z.number().int().min(1).max(50).optional().describe("Bottom of a rep range, with rep_max (instead of reps)"),
  rep_max: z.number().int().min(1).max(50).optional().describe("Top of a rep range"),
  duration_seconds: z
    .number()
    .int()
    .min(5)
    .max(600)
    .optional()
    .describe("Seconds per set for holds/carries (planks, carries)"),
  weight_kg: z.number().min(0).optional().describe("Working load in kg, from the athlete's recent lifts when known"),
  rpe: z.number().min(5).max(10).optional().describe("Target RPE for the working sets (e.g. 7, 8, 8.5)"),
  rest_seconds: z.number().int().min(0).max(600).optional().describe("Rest between sets"),
  notes: z.string().optional().describe("Short cue (tempo, form, side-to-side)"),
});

export function getIntervalsTools(client: IntervalsClient, hevy: HevyClient | null = null, timeZone?: string) {
  return {
    icu_get_fitness_summary: tool({
      description:
        "Get current fitness, fatigue, and form snapshot (CTL, ATL, TSB, ramp rate, form status) from Intervals.icu.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          return await client.getFitnessSummary();
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
        oldest: date.optional().describe("Oldest date in YYYY-MM-DD format (defaults to 14 days ago)"),
        newest: date.optional().describe("Newest date in YYYY-MM-DD format (defaults to today)"),
      }),
      execute: async ({ oldest, newest }) => {
        try {
          const range = wellnessRange(oldest, newest, timeZone);
          const records = await client.getWellness(range.oldest, range.newest);
          return compactWellness(records as unknown as Row[]);
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    icu_get_recent_activities: tool({
      description: "List recent training activities, rides, distances, normalized power, TSS, and elevation gain.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(30)
          .optional()
          .default(10)
          .describe("Max activities to return (default 10, max 30)"),
        oldest: date.optional().describe("Oldest date in YYYY-MM-DD format (defaults to 30 days ago)"),
        newest: date.optional().describe("Newest date in YYYY-MM-DD format"),
      }),
      execute: async ({ limit, oldest, newest }) => {
        try {
          const activities = await client.getActivities(limit, oldest, newest);
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
        "time off are already listed in your instructions. One call covers at most " +
        `${MAX_EVENT_DAYS} days from \`oldest\` (a longer range is cut short); for later dates, call again with a later \`oldest\`.`,
      inputSchema: z.object({
        oldest: date.optional().describe("Oldest date in YYYY-MM-DD format (defaults to 7 days ago)"),
        newest: date.optional().describe("Newest date in YYYY-MM-DD format (defaults to 14 days ahead)"),
      }),
      execute: async ({ oldest, newest }) => {
        try {
          const range = eventsRange(oldest, newest, timeZone);
          const events = await client.getEvents(range.oldest, range.newest);
          return compactEvents(events as unknown as Row[]);
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    icu_create_calendar_event: tool({
      description: "Create a scheduled workout or note event directly on the Intervals.icu calendar.",
      inputSchema: z.object({
        name: z.string().describe("Short workout name (e.g. 'VO2', 'OU', 'Endurance')"),
        start_date_local: z.string().describe("Date/time in ISO-8601 format (e.g. '2026-09-25T09:00:00')"),
        type: z.string().default("Ride").describe("Activity type (Ride, VirtualRide, Workout, Note)"),
        category: z.enum(["WORKOUT", "NOTE"]).default("WORKOUT").describe("Event category"),
        description: z.string().optional().describe(EVENT_DESCRIPTION_HINT),
        moving_time: z.number().optional().describe("Target duration in seconds"),
        icu_training_load: z.number().optional().describe("Target TSS"),
      }),
      execute: async ({ name, start_date_local, type, category, description, moving_time, icu_training_load }) => {
        try {
          // Fields are listed rather than passed through: approved calls run with the input stored in the chat, which
          // in older chats may carry extra keys (e.g. an `athlete_id` from before tools were bound to the athlete).
          return await client.createEvent({
            name,
            start_date_local,
            type,
            category,
            description,
            moving_time,
            icu_training_load,
          });
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    icu_update_calendar_event: tool({
      description:
        "Change a planned workout or note on the Intervals.icu calendar: move it to another day or time, rename it, " +
        "or replace its steps, duration or load. Pass only the fields that change. Take `event_id` from " +
        "icu_get_calendar_events. Races, time off, and past or completed sessions can't be changed.",
      inputSchema: z.object({
        event_id: z.string().describe("Intervals.icu event ID, from icu_get_calendar_events"),
        name: z.string().optional().describe("New short name"),
        start_date_local: z
          .string()
          .optional()
          .describe("New date/time in ISO-8601 format (e.g. '2026-09-25T09:00:00')"),
        type: z.string().optional().describe("New activity type (Ride, VirtualRide, Workout, Note)"),
        description: z.string().optional().describe(EVENT_DESCRIPTION_HINT),
        moving_time: z.number().optional().describe("New target duration in seconds"),
        icu_training_load: z.number().optional().describe("New target TSS"),
      }),
      execute: async ({ event_id, name, start_date_local, type, description, moving_time, icu_training_load }) => {
        try {
          // Named fields only, as in icu_create_calendar_event: approved calls run with the input stored in the chat.
          const changes = { name, start_date_local, type, description, moving_time, icu_training_load };
          const today = daysFromToday(0, timeZone);
          const blocked = editBlockReason(await client.getEvent(event_id), today);
          if (blocked) return { error: blocked };
          if (changes.start_date_local && changes.start_date_local.slice(0, 10) < today) {
            return { error: "Sessions can't be moved into the past." };
          }
          const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
          if (Object.keys(defined).length === 0) return { error: "Nothing to change: pass at least one field." };
          const updated = await client.updateEvent(event_id, defined);
          return compactEvents([updated as unknown as Row])[0];
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    icu_delete_calendar_event: tool({
      description:
        "Remove a planned workout or note from the Intervals.icu calendar. Take `event_id` from " +
        "icu_get_calendar_events. Races, time off, and past or completed sessions can't be removed.",
      inputSchema: z.object({
        event_id: z.string().describe("Intervals.icu event ID, from icu_get_calendar_events"),
      }),
      execute: async ({ event_id }) => {
        try {
          const event = await client.getEvent(event_id);
          const blocked = editBlockReason(event, daysFromToday(0, timeZone));
          if (blocked) return { error: blocked };
          await client.deleteEvent(event_id);
          const { id, name, start_date_local, category } = event;
          return { deleted: { id, name, start_date_local, category } };
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
                  "Only create the Hevy routine, for a session already on the Intervals.icu calendar (e.g. retrying a failed Hevy sync). Never set it for new sessions.",
                ),
            }
          : {}),
      }),
      execute: async (session): Promise<GymSessionResult> => {
        const input = session as GymSessionInput;
        const [intervals, hevyResult] = await Promise.all([
          input.hevy_only && hevy
            ? Promise.resolve("skipped" as const)
            : client
                .createEvent({
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
