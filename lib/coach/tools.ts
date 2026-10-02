import { tool } from "ai";
import { z } from "zod";
import { addFact, removeFact, setPlan } from "@/lib/storage/memory-store";
import { updatePreferences } from "@/lib/storage/preferences-store";
import { FORGET_TOOL, PROPOSE_RULES_TOOL, REMEMBER_TOOL, UPDATE_PLAN_TOOL } from "@/lib/intervals/tool-names";
import { daysFromToday } from "@/lib/intervals/timezone";
import { MAX_FACT_CHARS, MAX_PLAN_CHARS, MEMORY_CATEGORIES } from "./memory";
import { ruleChanges, rulesPatchSchema, type ProposeRulesResult } from "./rules";

export interface RememberResult {
  id: string;
  text: string;
  category: string;
  expires_on?: string;
  already_saved?: boolean;
}

const errorOf = (error: unknown) => ({ error: (error as Error).message });

export function getCoachTools(athleteId: string, chatId?: string, timeZone?: string) {
  const today = () => daysFromToday(0, timeZone);
  return {
    [REMEMBER_TOOL]: tool({
      description:
        "Save one durable fact the athlete told you about themselves, so every future conversation knows it. " +
        "One fact per call, written as a short third-person statement. The athlete sees it and can forget it.",
      inputSchema: z.object({
        text: z.string().max(MAX_FACT_CHARS).describe("e.g. 'Left knee sore after rides over 3 h (since Sep 2026)'"),
        category: z.enum(MEMORY_CATEGORIES),
        expires_on: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
          .optional()
          .describe("Last day the fact holds, for temporary facts (travel, illness, a busy week)"),
      }),
      execute: async ({ text, category, expires_on }): Promise<RememberResult | { error: string }> => {
        if (expires_on && expires_on < today()) {
          return { error: "expires_on is in the past; there's nothing to remember." };
        }
        try {
          const { fact, duplicate } = await addFact(
            athleteId,
            { text, category, expiresOn: expires_on, chatId },
            today(),
          );
          return {
            id: fact.id,
            text: fact.text,
            category: fact.category,
            ...(fact.expiresOn ? { expires_on: fact.expiresOn } : {}),
            ...(duplicate ? { already_saved: true } : {}),
          };
        } catch (error) {
          return errorOf(error);
        }
      },
    }),

    [FORGET_TOOL]: tool({
      description: "Forget a saved fact that no longer holds, by its id from 'What you know about the athlete'.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        try {
          const removed = await removeFact(athleteId, id, today());
          return removed ? { removed: removed.text } : { error: `No saved fact has the id "${id}".` };
        } catch (error) {
          return errorOf(error);
        }
      },
    }),

    [UPDATE_PLAN_TOOL]: tool({
      description:
        "Replace your plan note: the current training block, its phase and this week's intent, so later " +
        "conversations follow the same plan. Write the whole note each time.",
      inputSchema: z.object({
        phase: z.string().max(80).describe("e.g. 'Build 2, week 2 of 3' or 'Base'"),
        focus: z.string().max(160).describe("This week's focus in one line"),
        text: z
          .string()
          .max(MAX_PLAN_CHARS)
          .describe(
            "Terse notes: key sessions and why, progression for the coming weeks, what to watch (fatigue, niggles), and when to review",
          ),
      }),
      execute: async (plan) => {
        try {
          return await setPlan(athleteId, { ...plan, chatId }, today());
        } catch (error) {
          return errorOf(error);
        }
      },
    }),

    [PROPOSE_RULES_TOOL]: tool({
      description:
        "Propose a change to the athlete's standing coach rules (weekly volume, preferred session days, terrain, " +
        "gym setup). Pass only the fields that change; day lists are the full new list. The athlete sees a " +
        "before/after card and nothing changes until they approve. Not for one-off exceptions: remember those.",
      inputSchema: rulesPatchSchema.extend({
        reason: z.string().max(200).describe("One line on why, shown to the athlete"),
      }),
      execute: async ({ reason: _reason, ...patch }): Promise<ProposeRulesResult | { error: string }> => {
        try {
          const result = await updatePreferences(athleteId, patch);
          if ("error" in result) return result;
          return { changes: ruleChanges(result.before, result.after) };
        } catch (error) {
          return errorOf(error);
        }
      },
    }),
  };
}
