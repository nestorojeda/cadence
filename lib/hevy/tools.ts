import { tool } from "ai";
import { z } from "zod";
import { HevyClient } from "./client";
import { compactExerciseHistory, compactWorkouts, searchExerciseTemplates } from "./routine";
import { daysFromToday } from "@/lib/intervals/compact";

/** Read tools over the athlete's Hevy account; only offered when a Hevy API key is set. */
export function getHevyTools(hevy: HevyClient) {
  return {
    hevy_search_exercises: tool({
      description:
        "Search the athlete's Hevy exercise library (built-in and custom) for the exact titles and ids to use in " +
        "create_gym_session. Built-in titles are in English whatever language the athlete's app uses (e.g. " +
        "'Bench Press (Barbell)', not 'Press de Banca'); custom exercises keep the athlete's own names. Exercises " +
        "from hevy_get_recent_workouts already have ids: reuse those instead of searching. Put every search term " +
        "you need in one call.",
      inputSchema: z.object({
        queries: z
          .array(z.string())
          .min(1)
          .max(10)
          .describe("One search per entry, a word or two each, in English ('squat', 'split squat', 'hip thrust')"),
        muscle: z
          .string()
          .optional()
          .describe("Muscle group, e.g. quadriceps, hamstrings, glutes, abdominals, lower_back, upper_back, chest, shoulders"),
        equipment: z
          .enum(["none", "barbell", "dumbbell", "kettlebell", "machine", "plate", "resistance_band", "suspension", "other"])
          .optional(),
      }),
      execute: async ({ queries, muscle, equipment }) => {
        try {
          const templates = await hevy.getExerciseTemplates();
          // An empty list is an answer, not a failure: the model should try other words.
          return Object.fromEntries(
            queries.map((query) => [query, searchExerciseTemplates(templates, { query, muscle, equipment }, 8)])
          );
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    hevy_get_recent_workouts: tool({
      description:
        "The athlete's most recent Hevy gym workouts: each exercise with its id, its library title (English) when " +
        "the athlete's app shows another name, and working sets as weight×reps@RPE. Check before prescribing loads; " +
        "pass these ids as hevy_exercise_id in create_gym_session.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(10).optional().default(5).describe("Workouts to return (max 10)"),
      }),
      execute: async ({ limit }) => {
        try {
          const [workouts, templates] = await Promise.all([hevy.getWorkouts(limit), hevy.getExerciseTemplates()]);
          return compactWorkouts(workouts, templates);
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    hevy_get_exercise_history: tool({
      description:
        "Working sets the athlete logged for one exercise (by Hevy template id), newest first, grouped per workout.",
      inputSchema: z.object({
        exercise_id: z.string().describe("Hevy exercise template id"),
        oldest: z.string().optional().describe("Oldest date in YYYY-MM-DD format (defaults to 120 days ago)"),
      }),
      execute: async ({ exercise_id, oldest }) => {
        try {
          return compactExerciseHistory(await hevy.getExerciseHistory(exercise_id, oldest || daysFromToday(-120)));
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),
  };
}
