import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root: string;
let tools: ReturnType<typeof import("./tools").getCoachTools>;
let memory: typeof import("@/lib/storage/memory-store");
let preferences: typeof import("@/lib/storage/preferences-store");

function run<T>(t: { execute?: (input: T, options: never) => unknown }, input: T) {
  return t.execute!(input, { toolCallId: "t1", messages: [] } as never);
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cadence-coach-tools-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.resetModules();
  tools = (await import("./tools")).getCoachTools("i1", "c1");
  memory = await import("@/lib/storage/memory-store");
  preferences = await import("@/lib/storage/preferences-store");
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

describe("coach_remember / coach_forget", () => {
  it("saves a fact tagged with the chat and forgets it by id", async () => {
    const saved = (await run(tools.coach_remember, { text: "Left knee sore", category: "health" })) as { id: string };
    expect(saved).toMatchObject({ text: "Left knee sore", category: "health" });
    expect((await memory.getMemory("i1")).facts[0]).toMatchObject({ id: saved.id, chatId: "c1" });

    expect(await run(tools.coach_forget, { id: saved.id })).toEqual({ removed: "Left knee sore" });
    expect(await run(tools.coach_forget, { id: saved.id })).toHaveProperty("error");
  });

  it("flags a duplicate and rejects an expiry in the past", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 10, 12));
    await run(tools.coach_remember, { text: "Away", category: "availability", expires_on: "2026-10-18" });
    expect(await run(tools.coach_remember, { text: "away", category: "availability" })).toMatchObject({
      already_saved: true,
      expires_on: "2026-10-18",
    });
    expect(
      await run(tools.coach_remember, { text: "Ill", category: "health", expires_on: "2026-10-09" }),
    ).toHaveProperty("error");
  });
});

describe("coach_update_plan", () => {
  it("replaces the plan note", async () => {
    await run(tools.coach_update_plan, { phase: "Base", focus: "Volume", text: "Z2" });
    await run(tools.coach_update_plan, { phase: "Build 1", focus: "Threshold", text: "2x20 Tue" });
    expect((await memory.getMemory("i1")).plan).toMatchObject({ phase: "Build 1", focus: "Threshold", chatId: "c1" });
  });
});

describe("coach_propose_rules", () => {
  it("saves the change and returns only what changed", async () => {
    const result = await run(tools.coach_propose_rules, {
      intervalDays: ["Wednesday", "Thursday"],
      terrain: "rolling",
      reason: "No longer free on Tuesdays",
    });
    expect(result).toEqual({ changes: [{ label: "Interval days", before: "Tue, Thu", after: "Wed, Thu" }] });
    const saved = await preferences.getPreferences("i1");
    expect(saved.intervalDays).toEqual(["Wednesday", "Thursday"]);
  });

  it("merges gym fields and leaves free-text notes alone", async () => {
    await preferences.updatePreferences("i1", { customNotes: "Mine", gym: { notes: "Bad back" } });
    await run(tools.coach_propose_rules, { gym: { sessionMinutes: 30 }, reason: "Shorter sessions" });
    const saved = await preferences.getPreferences("i1");
    expect(saved).toMatchObject({ customNotes: "Mine", gym: { sessionMinutes: 30, notes: "Bad back" } });
  });

  it("refuses a minimum above the maximum", async () => {
    expect(await run(tools.coach_propose_rules, { weeklyVolumeMinHours: 20, reason: "More" })).toHaveProperty("error");
    expect((await preferences.getPreferences("i1")).weeklyVolumeMinHours).toBe(8);
  });

  it("has no free-text fields in its input schema", () => {
    const schema = tools.coach_propose_rules.inputSchema as unknown as {
      safeParse: (v: unknown) => { success: boolean; data?: Record<string, unknown> };
    };
    const parsed = schema.safeParse({ customNotes: "x", gym: { notes: "y" }, reason: "r" });
    expect(parsed.data).not.toHaveProperty("customNotes");
    expect(parsed.data?.gym).not.toHaveProperty("notes");
  });
});
