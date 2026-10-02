import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultGymPreferences } from "@/lib/coach/gym";

// The store resolves data/ from process.cwd(); point it at a temp dir and reload the module to reset its cache.
let root: string;
let store: typeof import("./preferences-store");
const file = (athleteId: string) => path.join(root, "data", "athletes", `${athleteId}.json`);

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cadence-prefs-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.resetModules();
  store = await import("./preferences-store");
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

describe("preferences store", () => {
  it("writes defaults for a new athlete", async () => {
    const prefs = await store.getPreferences("i1");
    expect(prefs).toMatchObject({ athleteId: "i1", terrain: "rolling", gym: createDefaultGymPreferences() });
    expect(JSON.parse(await fs.readFile(file("i1"), "utf-8"))).toMatchObject({ athleteId: "i1" });
  });

  it("round-trips saved preferences", async () => {
    await store.updatePreferences("i1", { customNotes: "No rides before 7am" });
    vi.resetModules();
    const fresh = await import("./preferences-store");
    expect((await fresh.getPreferences("i1")).customNotes).toBe("No rides before 7am");
  });

  it("drops legacy fields and fills in new ones from defaults", async () => {
    await fs.mkdir(path.dirname(file("i1")), { recursive: true });
    await fs.writeFile(
      file("i1"),
      JSON.stringify({
        athleteId: "i1",
        sundayRoutine: "long",
        terrainNotes: "hills",
        weeklyVolumeMaxHours: 20,
        gym: { sessionMinutes: 30 },
      }),
    );
    const prefs = await store.getPreferences("i1");
    expect(prefs).not.toHaveProperty("sundayRoutine");
    expect(prefs).not.toHaveProperty("terrainNotes");
    expect(prefs).toMatchObject({ weeklyVolumeMaxHours: 20, terrain: "rolling" });
    expect(prefs.gym).toEqual({ ...createDefaultGymPreferences(), sessionMinutes: 30 });
  });

  it("uses defaults for a corrupt file without overwriting it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await fs.mkdir(path.dirname(file("i1")), { recursive: true });
    await fs.writeFile(file("i1"), "{ not json");
    const prefs = await store.getPreferences("i1");
    expect(prefs.athleteId).toBe("i1");
    expect(await fs.readFile(file("i1"), "utf-8")).toBe("{ not json");
  });

  it("refuses to update a corrupt file", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await fs.mkdir(path.dirname(file("i1")), { recursive: true });
    await fs.writeFile(file("i1"), "{ not json");
    await expect(store.updatePreferences("i1", { terrain: "hilly" })).rejects.toThrow(/can't be read/);
    expect(await fs.readFile(file("i1"), "utf-8")).toBe("{ not json");
  });

  it("rejects a weekly minimum above the maximum without saving", async () => {
    expect(await store.updatePreferences("i1", { weeklyVolumeMinHours: 20 })).toEqual({
      error: "The weekly minimum would be above the maximum.",
    });
    expect((await store.getPreferences("i1")).weeklyVolumeMinHours).toBe(8);
  });

  it("applies concurrent updates one after the other", async () => {
    await Promise.all([
      store.updatePreferences("i1", { terrain: "hilly" }),
      store.updatePreferences("i1", { customNotes: "Early riser" }),
      store.updatePreferences("i1", { restDays: ["Monday"] }),
    ]);
    vi.resetModules();
    const fresh = await import("./preferences-store");
    expect(await fresh.getPreferences("i1")).toMatchObject({
      terrain: "hilly",
      customNotes: "Early riser",
      restDays: ["Monday"],
    });
  });

  it("throws when the update can't be written", async () => {
    await store.getPreferences("i1");
    await fs.chmod(path.dirname(file("i1")), 0o500);
    try {
      await expect(store.updatePreferences("i1", { terrain: "hilly" })).rejects.toThrow();
      expect((await store.getPreferences("i1")).terrain).toBe("rolling");
    } finally {
      await fs.chmod(path.dirname(file("i1")), 0o700);
    }
  });
});
