import type { Terrain } from "@/lib/intervals/terrain";
import { createDefaultGymPreferences, type GymPreferences } from "@/lib/coach/gym";

export interface CoachPreferences {
  athleteId: string;
  weeklyVolumeMinHours: number; // e.g. 8
  weeklyVolumeMaxHours: number; // e.g. 14
  longRideDays: string[]; // e.g. ["Saturday"]
  intervalDays: string[]; // e.g. ["Tuesday", "Thursday"]
  restDays: string[]; // e.g. ["Monday", "Friday"]
  gymDays: string[]; // e.g. ["Tuesday", "Thursday"]
  gym: GymPreferences; // what the gym work is for and what the athlete has to work with
  backToBackIntervals: boolean; // allow hard interval days on consecutive days
  shortNamingConvention: boolean; // short names like VO2, OU, etc.
  terrain: Terrain; // what the athlete's local roads are like; shapes long-ride planning
  customNotes: string; // freeform user notes
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
  gym: createDefaultGymPreferences(),
  backToBackIntervals: false,
  shortNamingConvention: true,
  terrain: "rolling",
  customNotes: "",
  updatedAt: new Date().toISOString(),
});
