// Shared by the server and the UI, so it must not import server-only code.

export const MEMORY_CATEGORIES = ["health", "availability", "preference", "goal", "feedback", "life"] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  health: "Health",
  availability: "Availability",
  preference: "Preferences",
  goal: "Goals",
  feedback: "Session feedback",
  life: "Life",
};

export const MAX_FACTS = 40;
export const MAX_FACT_CHARS = 280;
export const MAX_PLAN_CHARS = 1500;

export interface MemoryFact {
  id: string;
  text: string;
  category: MemoryCategory;
  createdAt: string;
  /** Last day the fact holds (YYYY-MM-DD, inclusive). */
  expiresOn?: string;
  chatId?: string;
}

export interface PlanNote {
  phase: string;
  focus: string;
  text: string;
  updatedAt: string;
  chatId?: string;
}

export interface AthleteMemory {
  facts: MemoryFact[];
  plan: PlanNote | null;
}

export const EMPTY_MEMORY: AthleteMemory = { facts: [], plan: null };

/** YYYY-MM-DD in the server's local time zone (the athlete's, when self-hosted). */
export function localDate(now: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isExpired(fact: MemoryFact, now: Date): boolean {
  return !!fact.expiresOn && fact.expiresOn < localDate(now);
}
