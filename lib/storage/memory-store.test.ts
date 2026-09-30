import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FACTS } from "@/lib/coach/memory";

let root: string;
let store: typeof import("./memory-store");
const file = (athleteId: string) => path.join(root, "data", "athletes", `${athleteId}.memory.json`);

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cadence-memory-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.resetModules();
  store = await import("./memory-store");
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

describe("memory store", () => {
  it("starts empty without writing a file", async () => {
    expect(await store.getMemory("i1")).toEqual({ facts: [], plan: null });
    await expect(fs.access(file("i1"))).rejects.toThrow();
  });

  it("adds, persists and removes facts", async () => {
    const { fact } = await store.addFact("i1", { text: "Left knee sore", category: "health", chatId: "c1" });
    expect(fact).toMatchObject({ text: "Left knee sore", category: "health", chatId: "c1" });

    vi.resetModules();
    const fresh = await import("./memory-store");
    expect((await fresh.getMemory("i1")).facts.map((f) => f.id)).toEqual([fact.id]);

    expect(await fresh.removeFact("i1", fact.id)).toMatchObject({ text: "Left knee sore" });
    expect(await fresh.removeFact("i1", fact.id)).toBeNull();
    expect((await fresh.getMemory("i1")).facts).toEqual([]);
  });

  it("returns the existing fact for a duplicate", async () => {
    const first = await store.addFact("i1", { text: "Hates the turbo", category: "preference" });
    const again = await store.addFact("i1", { text: "  hates the   TURBO ", category: "preference" });
    expect(again).toEqual({ fact: first.fact, duplicate: true });
    expect((await store.getMemory("i1")).facts).toHaveLength(1);
  });

  it("hides expired facts and prunes them on the next write", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10, 12));
    await store.addFact("i1", { text: "Away in Lisbon", category: "availability", expiresOn: "2026-10-18" });
    expect((await store.getMemory("i1")).facts).toHaveLength(1);

    vi.setSystemTime(new Date(2026, 9, 18, 23));
    expect((await store.getMemory("i1")).facts).toHaveLength(1);
    vi.setSystemTime(new Date(2026, 9, 19, 8));
    expect((await store.getMemory("i1")).facts).toEqual([]);

    await store.addFact("i1", { text: "Back home", category: "availability" });
    const saved = JSON.parse(await fs.readFile(file("i1"), "utf-8")) as { facts: Array<{ text: string }> };
    expect(saved.facts.map((f) => f.text)).toEqual(["Back home"]);
  });

  it("refuses to add past the limit", async () => {
    for (let i = 0; i < MAX_FACTS; i++) await store.addFact("i1", { text: `fact ${i}`, category: "life" });
    await expect(store.addFact("i1", { text: "one more", category: "life" })).rejects.toThrow(/full/);
  });

  it("sets and clears the plan note", async () => {
    const plan = await store.setPlan("i1", { phase: "Build", focus: "Threshold", text: "2x20 Tue", chatId: "c1" });
    expect((await store.getMemory("i1")).plan).toEqual(plan);
    await store.clearPlan("i1");
    expect((await store.getMemory("i1")).plan).toBeNull();
  });

  it("reads a corrupt file as empty and refuses to overwrite it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await fs.mkdir(path.dirname(file("i1")), { recursive: true });
    await fs.writeFile(file("i1"), "{ not json");
    expect(await store.getMemory("i1")).toEqual({ facts: [], plan: null });
    await expect(store.addFact("i1", { text: "x", category: "life" })).rejects.toThrow(/can't be read/);
    expect(await fs.readFile(file("i1"), "utf-8")).toBe("{ not json");
  });
});
