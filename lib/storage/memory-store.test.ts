import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FACTS } from "@/lib/coach/memory";
import { getDb, resetDb, setDbForTests } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/testing";
import * as store from "./memory-store";

beforeEach(async () => {
  setDbForTests(await createTestDb());
});

afterEach(async () => {
  vi.useRealTimers();
  await resetDb();
});

async function storedFacts(athleteId: string): Promise<string[] | undefined> {
  const { rows } = await (
    await getDb()
  ).query<{ data: { facts: Array<{ text: string }> } }>("SELECT data FROM athlete_memory WHERE athlete_id = $1", [
    athleteId,
  ]);
  return rows[0]?.data.facts.map((f) => f.text);
}

describe("memory store", () => {
  it("starts empty without saving anything", async () => {
    expect(await store.getMemory("i1")).toEqual({ facts: [], plan: null });
    expect(await storedFacts("i1")).toBeUndefined();
  });

  it("adds, persists and removes facts", async () => {
    const { fact } = await store.addFact("i1", { text: "Left knee sore", category: "health", chatId: "c1" });
    expect(fact).toMatchObject({ text: "Left knee sore", category: "health", chatId: "c1" });
    expect((await store.getMemory("i1")).facts.map((f) => f.id)).toEqual([fact.id]);

    expect(await store.removeFact("i1", fact.id)).toMatchObject({ text: "Left knee sore" });
    expect(await store.removeFact("i1", fact.id)).toBeNull();
    expect((await store.getMemory("i1")).facts).toEqual([]);
  });

  it("returns the existing fact for a duplicate", async () => {
    const first = await store.addFact("i1", { text: "Hates the turbo", category: "preference" });
    const again = await store.addFact("i1", { text: "  hates the   TURBO ", category: "preference" });
    expect(again).toEqual({ fact: first.fact, duplicate: true });
    expect((await store.getMemory("i1")).facts).toHaveLength(1);
  });

  it("hides expired facts and prunes them on the next write", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 10, 12));
    await store.addFact("i1", { text: "Away in Lisbon", category: "availability", expiresOn: "2026-10-18" });
    expect((await store.getMemory("i1")).facts).toHaveLength(1);

    vi.setSystemTime(new Date(2026, 9, 18, 23));
    expect((await store.getMemory("i1")).facts).toHaveLength(1);
    vi.setSystemTime(new Date(2026, 9, 19, 8));
    expect((await store.getMemory("i1")).facts).toEqual([]);

    await store.addFact("i1", { text: "Back home", category: "availability" }, "2026-10-19");
    expect(await storedFacts("i1")).toEqual(["Back home"]);
  });

  it("uses the athlete's date, and keeps expired facts on writes that don't know it", async () => {
    await store.addFact("i1", { text: "Away in Lisbon", category: "availability", expiresOn: "2026-10-18" });
    expect((await store.getMemory("i1", "2026-10-18")).facts).toHaveLength(1);
    expect((await store.getMemory("i1", "2026-10-19")).facts).toEqual([]);

    await store.setPlan("i1", { phase: "Build", focus: "Threshold", text: "2x20 Tue" });
    expect(await storedFacts("i1")).toEqual(["Away in Lisbon"]);
  });

  it("refuses to add past the limit without changing anything", async () => {
    for (let i = 0; i < MAX_FACTS; i++) await store.addFact("i1", { text: `fact ${i}`, category: "life" });
    await expect(store.addFact("i1", { text: "one more", category: "life" })).rejects.toThrow(/full/);
    expect(await storedFacts("i1")).toHaveLength(MAX_FACTS);
  });

  it("applies concurrent writes one after the other", async () => {
    await Promise.all(
      Array.from({ length: 5 }, (_, i) => store.addFact("i1", { text: `fact ${i}`, category: "life" })),
    );
    expect((await storedFacts("i1"))?.sort()).toEqual(["fact 0", "fact 1", "fact 2", "fact 3", "fact 4"]);
  });

  it("sets and clears the plan note", async () => {
    const plan = await store.setPlan("i1", { phase: "Build", focus: "Threshold", text: "2x20 Tue", chatId: "c1" });
    expect((await store.getMemory("i1")).plan).toEqual(plan);
    await store.clearPlan("i1");
    expect((await store.getMemory("i1")).plan).toBeNull();
  });

  it("keeps athletes apart", async () => {
    await store.addFact("i1", { text: "Left knee sore", category: "health" });
    expect((await store.getMemory("i2")).facts).toEqual([]);
  });
});
