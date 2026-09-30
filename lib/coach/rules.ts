// Shared by the server and the UI, so it must not import server-only code.
import { z } from "zod";
import { terrainInfo } from "@/lib/intervals/terrain";
import type { CoachPreferences } from "@/lib/types/preferences";
import { GYM_EQUIPMENT, GYM_EXPERIENCE, GYM_GOALS, type GymPreferences } from "./gym";

const day = z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
const days = z.array(day).max(7);
const hours = z.number().min(0).max(168);

const gymRulesSchema = z.object({
  goals: z
    .array(z.enum(["cycling_performance", "injury_prevention", "muscle", "bone_health", "mobility"]))
    .max(5)
    .optional()
    .describe("Gym goals in priority order"),
  experience: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  equipment: z.enum(["full_gym", "home", "bodyweight"]).optional(),
  sessionMinutes: z.number().min(0).max(600).optional().describe("Gym session length in minutes"),
});

/** The structured rules: what the coach may propose changing. Free-text notes stay the athlete's. */
export const rulesPatchSchema = z.object({
  weeklyVolumeMinHours: hours.optional(),
  weeklyVolumeMaxHours: hours.optional(),
  longRideDays: days.optional().describe("The full new list, not just the added days"),
  intervalDays: days.optional().describe("The full new list, not just the added days"),
  restDays: days.optional().describe("The full new list, not just the added days"),
  gymDays: days.optional().describe("The full new list, not just the added days"),
  gym: gymRulesSchema.optional(),
  backToBackIntervals: z.boolean().optional().describe("Allow hard interval sessions on consecutive days"),
  shortNamingConvention: z.boolean().optional().describe("Short session names like 'VO2' or 'Sweet Spot'"),
  terrain: z.enum(["flat", "rolling", "hilly", "mountainous"]).optional().describe("The athlete's local roads"),
});

export type RulesPatch = z.infer<typeof rulesPatchSchema>;

/** A partial update from the Coach rules dialog: every field optional, unknown fields dropped. */
export const preferencesUpdateSchema = rulesPatchSchema.extend({
  athleteId: z.string().optional(),
  gym: gymRulesSchema.extend({ notes: z.string().max(4000).optional() }).optional(),
  customNotes: z.string().max(8000).optional(),
}) satisfies z.ZodType<PreferencesUpdate>;

export type PreferencesUpdate = Partial<Omit<CoachPreferences, "updatedAt" | "gym">> & {
  gym?: Partial<GymPreferences>;
};

export function mergePreferences(
  current: CoachPreferences,
  { gym, ...rest }: Omit<PreferencesUpdate, "athleteId">,
): CoachPreferences {
  const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  const definedGym = Object.fromEntries(Object.entries(gym ?? {}).filter(([, v]) => v !== undefined));
  return { ...current, ...defined, gym: { ...current.gym, ...definedGym } };
}

export interface RuleChange {
  label: string;
  before: string;
  after: string;
}

export interface ProposeRulesResult {
  changes: RuleChange[];
}

const shortDays = (list: string[]) => (list.length ? list.map((d) => d.slice(0, 3)).join(", ") : "none");
const labelOf = <T extends string>(options: Array<{ id: T; label: string }>, id: T) =>
  options.find((o) => o.id === id)?.label ?? id;

const RULE_FIELDS: Array<{ label: string; format: (p: CoachPreferences) => string }> = [
  { label: "Min weekly hours", format: (p) => `${p.weeklyVolumeMinHours} h` },
  { label: "Max weekly hours", format: (p) => `${p.weeklyVolumeMaxHours} h` },
  { label: "Interval days", format: (p) => shortDays(p.intervalDays) },
  { label: "Long ride days", format: (p) => shortDays(p.longRideDays) },
  { label: "Gym days", format: (p) => shortDays(p.gymDays) },
  { label: "Rest days", format: (p) => shortDays(p.restDays) },
  { label: "Back-to-back intervals", format: (p) => (p.backToBackIntervals ? "allowed" : "not allowed") },
  { label: "Session names", format: (p) => (p.shortNamingConvention ? "short" : "descriptive") },
  { label: "Terrain", format: (p) => terrainInfo(p.terrain).label },
  {
    label: "Gym goals",
    format: (p) => p.gym.goals.map((g) => labelOf(GYM_GOALS, g)).join(", ") || "none",
  },
  { label: "Gym experience", format: (p) => labelOf(GYM_EXPERIENCE, p.gym.experience) },
  { label: "Gym equipment", format: (p) => labelOf(GYM_EQUIPMENT, p.gym.equipment) },
  { label: "Gym session", format: (p) => `${p.gym.sessionMinutes} min` },
];

export function ruleChanges(before: CoachPreferences, after: CoachPreferences): RuleChange[] {
  return RULE_FIELDS.map(({ label, format }) => ({ label, before: format(before), after: format(after) })).filter(
    (c) => c.before !== c.after,
  );
}
