import type { Terrain } from "@/lib/intervals/terrain";

export interface CoachPreferences {
  athleteId: string;
  weeklyVolumeMinHours: number; // e.g. 8
  weeklyVolumeMaxHours: number; // e.g. 14
  longRideDays: string[];       // e.g. ["Saturday"]
  intervalDays: string[];       // e.g. ["Tuesday", "Thursday"]
  restDays: string[];           // e.g. ["Monday", "Friday"]
  gymDays: string[];            // e.g. ["Tuesday", "Thursday"]
  shortNamingConvention: boolean; // short names like VO2, OU, etc.
  terrain: Terrain;             // what the athlete's local roads are like; shapes long-ride planning
  customNotes: string;          // freeform user notes
  updatedAt: string;
}

export const createDefaultPreferences = (athleteId: string): CoachPreferences => ({
  athleteId,
  weeklyVolumeMinHours: 8,
  weeklyVolumeMaxHours: 14,
  longRideDays: ["Saturday"],
  intervalDays: ["Tuesday", "Thursday"],
  restDays: ["Monday", "Friday"],
  gymDays: ["Tuesday", "Thursday"],
  shortNamingConvention: true,
  terrain: "rolling",
  customNotes: "",
  updatedAt: new Date().toISOString(),
});
