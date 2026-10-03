import crypto from "crypto";
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
import { getDb, toJsonParam, type Queryable } from "@/lib/db/client";
import { dateInZone } from "@/lib/intervals/timezone";

// The coach's memory lives in Postgres, one jsonb document per athlete (`athlete_memory`). No in-process cache: prod
// and the dev container share the database.

function cleanAthleteId(athleteId: string): string {
  const id = athleteId.trim();
  if (!id || /[^a-zA-Z0-9_-]/.test(id)) throw new Error("Invalid athlete ID");
  return id;
}

export function normalizeMemory(stored: unknown): AthleteMemory {
  const memory = (stored ?? {}) as Partial<AthleteMemory>;
  return { facts: Array.isArray(memory.facts) ? memory.facts : [], plan: memory.plan ?? null };
}

/** Inserts the document unless the athlete already has one. Also used by the JSON import. */
export async function insertMemory(db: Queryable, athleteId: string, memory: AthleteMemory): Promise<boolean> {
  const { rows } = await db.query(
    `INSERT INTO athlete_memory (athlete_id, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (athlete_id) DO NOTHING RETURNING athlete_id`,
    [athleteId, toJsonParam(memory)],
  );
  return rows.length > 0;
}

/** `today` is the athlete's date (YYYY-MM-DD); without it, the server's. */
export async function getMemory(athleteId: string, today = dateInZone(new Date())): Promise<AthleteMemory> {
  const db = await getDb();
  const { rows } = await db.query<{ data: unknown }>("SELECT data FROM athlete_memory WHERE athlete_id = $1", [
    cleanAthleteId(athleteId),
  ]);
  const memory = rows[0] ? normalizeMemory(rows[0].data) : EMPTY_MEMORY;
  return { ...memory, facts: memory.facts.filter((f) => !isExpired(f, today)) };
}

/** Expired facts are dropped only when the athlete's `today` is known: the server's date can be a day ahead. */
async function update<T>(
  athleteId: string,
  fn: (memory: AthleteMemory, now: Date) => { memory: AthleteMemory; result: T },
  today?: string,
): Promise<T> {
  const id = cleanAthleteId(athleteId);
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Locks the athlete's row, so concurrent writes (from any process) apply one after the other.
    await insertMemory(tx, id, EMPTY_MEMORY);
    const { rows } = await tx.query<{ data: unknown }>(
      "SELECT data FROM athlete_memory WHERE athlete_id = $1 FOR UPDATE",
      [id],
    );
    const current = normalizeMemory(rows[0].data);
    const facts = today ? current.facts.filter((f) => !isExpired(f, today)) : current.facts;
    const { memory, result } = fn({ ...current, facts }, new Date());
    await tx.query("UPDATE athlete_memory SET data = $2::jsonb, updated_at = now() WHERE athlete_id = $1", [
      id,
      toJsonParam(memory),
    ]);
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
