import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultGymPreferences } from "@/lib/coach/gym";
import { getDb, resetDb, setDbForTests } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/testing";
import * as store from "./preferences-store";

beforeEach(async () => {
  setDbForTests(await createTestDb());
});

afterEach(async () => {
  await resetDb();
});

async function storedRow(athleteId: string) {
  const { rows } = await (
    await getDb()
  ).query<{ data: Record<string, unknown> }>("SELECT data FROM athlete_preferences WHERE athlete_id = $1", [athleteId]);
  return rows[0]?.data;
}

describe("preferences store", () => {
  it("saves defaults for a new athlete", async () => {
    const prefs = await store.getPreferences("i1");
    expect(prefs).toMatchObject({ athleteId: "i1", terrain: "rolling", gym: createDefaultGymPreferences() });
    expect(await storedRow("i1")).toMatchObject({ athleteId: "i1" });
  });

  it("round-trips saved preferences", async () => {
    const result = await store.updatePreferences("i1", { customNotes: "No rides before 7am" });
    expect(result).toMatchObject({ before: { customNotes: "" }, after: { customNotes: "No rides before 7am" } });
    expect((await store.getPreferences(" i1 ")).customNotes).toBe("No rides before 7am");
  });

  it("drops legacy fields and fills in new ones from defaults", async () => {
    const stored = {
      athleteId: "i1",
      sundayRoutine: "long",
      terrainNotes: "hills",
      weeklyVolumeMaxHours: 20,
      gym: { sessionMinutes: 30 },
    };
    await (
      await getDb()
    ).query("INSERT INTO athlete_preferences (athlete_id, data) VALUES ('i1', $1::jsonb)", [JSON.stringify(stored)]);
    const prefs = await store.getPreferences("i1");
    expect(prefs).not.toHaveProperty("sundayRoutine");
    expect(prefs).not.toHaveProperty("terrainNotes");
    expect(prefs).toMatchObject({ weeklyVolumeMaxHours: 20, terrain: "rolling" });
    expect(prefs.gym).toEqual({ ...createDefaultGymPreferences(), sessionMinutes: 30 });

    await store.updatePreferences("i1", { terrain: "hilly" });
    expect(await storedRow("i1")).not.toHaveProperty("sundayRoutine");
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
    expect(await store.getPreferences("i1")).toMatchObject({
      terrain: "hilly",
      customNotes: "Early riser",
      restDays: ["Monday"],
    });
  });

  it("keeps athletes apart and rejects unsafe IDs", async () => {
    await store.updatePreferences("i1", { terrain: "hilly" });
    expect((await store.getPreferences("i2")).terrain).toBe("rolling");
    await expect(store.getPreferences("../i1")).rejects.toThrow("Invalid athlete ID");
  });

  it("throws when the update can't be written", async () => {
    await store.getPreferences("i1");
    await (
      await getDb()
    ).exec("ALTER TABLE athlete_preferences ADD CONSTRAINT frozen CHECK (data->>'terrain' <> 'hilly')");
    await expect(store.updatePreferences("i1", { terrain: "hilly" })).rejects.toThrow();
    expect((await store.getPreferences("i1")).terrain).toBe("rolling");
  });
});
