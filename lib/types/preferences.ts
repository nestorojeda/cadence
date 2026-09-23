export interface CoachPreferences {
  athleteId: string;
  weeklyVolumeMinHours: number; // e.g. 8
  weeklyVolumeMaxHours: number; // e.g. 14
  longRideDays: string[];       // e.g. ["Saturday"]
  intervalDays: string[];       // e.g. ["Tuesday", "Thursday"]
  restDays: string[];           // e.g. ["Monday", "Friday"]
  gymDays: string[];            // e.g. ["Tuesday", "Thursday"]
  sundayRoutine: "rest" | "coffee_ride" | "flexible";
  shortNamingConvention: boolean; // short names like VO2, OU, etc.
  mountainTerrainNotes: string; // e.g. "+2,000m climbing, Gran Canaria mountain terrain"
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
  sundayRoutine: "coffee_ride",
  shortNamingConvention: true,
  mountainTerrainNotes: "Long Saturday rides with high elevation gain (+2,000m, +100km, Gran Canaria altitude)",
  customNotes: "",
  updatedAt: new Date().toISOString(),
});
