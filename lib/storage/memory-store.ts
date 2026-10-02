import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  EMPTY_MEMORY,
  MAX_FACTS,
  MAX_FACT_CHARS,
  MAX_PLAN_CHARS,
  isExpired,
  type AthleteMemory,
  type MemoryCategory,
  type MemoryFact,
  type PlanNote,
} from "@/lib/coach/memory";
import { dateInZone } from "@/lib/intervals/timezone";
import { writeJsonAtomic } from "./json-file";
import { withLock } from "./lock";

const cache = new Map<string, AthleteMemory>();

function memoryFile(athleteId: string): string {
  const sanitized = athleteId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized) throw new Error("Invalid athlete ID");
  return path.join(process.cwd(), "data", "athletes", `${sanitized}.memory.json`);
}

/** null when the file exists but can't be read: it's left alone so nothing the coach saved is overwritten. */
async function load(file: string): Promise<AthleteMemory | null> {
  const cached = cache.get(file);
  if (cached) return cached;
  try {
    const stored = JSON.parse(await fs.readFile(file, "utf-8")) as Partial<AthleteMemory>;
    const memory: AthleteMemory = {
      facts: Array.isArray(stored.facts) ? stored.facts : [],
      plan: stored.plan ?? null,
    };
    cache.set(file, memory);
    return memory;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_MEMORY;
    console.warn(`[MemoryStore] Could not read ${file}:`, err);
    return null;
  }
}

/** `today` is the athlete's date (YYYY-MM-DD); without it, the server's. */
export async function getMemory(athleteId: string, today = dateInZone(new Date())): Promise<AthleteMemory> {
  const memory = (await load(memoryFile(athleteId))) ?? EMPTY_MEMORY;
  return { ...memory, facts: memory.facts.filter((f) => !isExpired(f, today)) };
}

/** Expired facts are dropped only when the athlete's `today` is known: the server's date can be a day ahead. */
function update<T>(
  athleteId: string,
  fn: (memory: AthleteMemory, now: Date) => { memory: AthleteMemory; result: T },
  today?: string,
) {
  const file = memoryFile(athleteId);
  return withLock(file, async () => {
    const current = await load(file);
    if (!current) throw new Error("The coach's memory file can't be read, so nothing was saved.");
    const now = new Date();
    const facts = today ? current.facts.filter((f) => !isExpired(f, today)) : current.facts;
    const { memory, result } = fn({ ...current, facts }, now);
    await writeJsonAtomic(file, memory, 2);
    cache.set(file, memory);
    return result;
  });
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

function newId(taken: MemoryFact[]): string {
  let id: string;
  do id = crypto.randomBytes(3).toString("hex");
  while (taken.some((f) => f.id === id));
  return id;
}

export function addFact(
  athleteId: string,
  fact: { text: string; category: MemoryCategory; expiresOn?: string; chatId?: string },
  today?: string,
): Promise<{ fact: MemoryFact; duplicate: boolean }> {
  const text = fact.text.trim();
  if (!text) return Promise.reject(new Error("Nothing to remember."));
  if (text.length > MAX_FACT_CHARS) {
    return Promise.reject(new Error(`Keep a fact under ${MAX_FACT_CHARS} characters.`));
  }
  return update<{ fact: MemoryFact; duplicate: boolean }>(
    athleteId,
    (memory, now) => {
      const existing = memory.facts.find((f) => normalize(f.text) === normalize(text));
      if (existing) return { memory, result: { fact: existing, duplicate: true } };
      if (memory.facts.length >= MAX_FACTS) {
        throw new Error(`Memory is full (${MAX_FACTS} facts). Forget one that no longer matters first.`);
      }
      const saved: MemoryFact = {
        id: newId(memory.facts),
        text,
        category: fact.category,
        createdAt: now.toISOString(),
        ...(fact.expiresOn ? { expiresOn: fact.expiresOn } : {}),
        ...(fact.chatId ? { chatId: fact.chatId } : {}),
      };
      return { memory: { ...memory, facts: [...memory.facts, saved] }, result: { fact: saved, duplicate: false } };
    },
    today,
  );
}

export function removeFact(athleteId: string, id: string, today?: string): Promise<MemoryFact | null> {
  return update(
    athleteId,
    (memory) => {
      const fact = memory.facts.find((f) => f.id === id) ?? null;
      return { memory: { ...memory, facts: memory.facts.filter((f) => f.id !== id) }, result: fact };
    },
    today,
  );
}

export function setPlan(
  athleteId: string,
  plan: { phase: string; focus: string; text: string; chatId?: string },
  today?: string,
): Promise<PlanNote> {
  if (plan.text.length > MAX_PLAN_CHARS) {
    return Promise.reject(new Error(`Keep the plan note under ${MAX_PLAN_CHARS} characters.`));
  }
  return update(
    athleteId,
    (memory, now) => {
      const note: PlanNote = {
        phase: plan.phase.trim(),
        focus: plan.focus.trim(),
        text: plan.text.trim(),
        updatedAt: now.toISOString(),
        ...(plan.chatId ? { chatId: plan.chatId } : {}),
      };
      return { memory: { ...memory, plan: note }, result: note };
    },
    today,
  );
}

export function clearPlan(athleteId: string): Promise<void> {
  return update(athleteId, (memory) => ({ memory: { ...memory, plan: null }, result: undefined }));
}
