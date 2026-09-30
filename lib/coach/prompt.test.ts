import { describe, expect, it } from "vitest";
import { createDefaultPreferences } from "@/lib/types/preferences";
import { buildCoachSystemPrompt } from "./prompt";

const now = new Date(2026, 9, 10, 12);
const preferences = createDefaultPreferences("i1");

describe("buildCoachSystemPrompt memory", () => {
  it("leaves the section out when memory isn't passed", () => {
    expect(buildCoachSystemPrompt(preferences, now)).not.toContain("What You Know About the Athlete");
  });

  it("lists current facts with their ids and hides expired ones", () => {
    const prompt = buildCoachSystemPrompt(preferences, now, undefined, {
      memory: {
        facts: [
          { id: "a1", text: "Left knee sore", category: "health", createdAt: "2026-10-01T08:00:00.000Z" },
          {
            id: "b2",
            text: "Away in Lisbon",
            category: "availability",
            createdAt: "2026-10-02T08:00:00.000Z",
            expiresOn: "2026-10-18",
          },
          {
            id: "c3",
            text: "Busy week",
            category: "life",
            createdAt: "2026-09-20T08:00:00.000Z",
            expiresOn: "2026-10-09",
          },
        ],
        plan: null,
      },
    });
    expect(prompt).toContain("- [a1] (health, saved 2026-10-01) Left knee sore");
    expect(prompt).toContain("- [b2] (availability, saved 2026-10-02, until 2026-10-18) Away in Lisbon");
    expect(prompt).not.toContain("Busy week");
    expect(prompt).toContain("No plan note yet");
  });

  it("includes the plan note", () => {
    const prompt = buildCoachSystemPrompt(preferences, now, undefined, {
      memory: {
        facts: [],
        plan: { phase: "Build 2", focus: "VO2", text: "5x4 Thu", updatedAt: "2026-10-08T09:00:00.000Z" },
      },
    });
    expect(prompt).toContain("Nothing saved yet.");
    expect(prompt).toContain("Updated 2026-10-08. Phase: Build 2. Focus: VO2.\n5x4 Thu");
  });
});
