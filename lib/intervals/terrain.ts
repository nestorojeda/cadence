import type { ActivitySummary } from "@/lib/intervals/client";

export type Terrain = "flat" | "rolling" | "hilly" | "mountainous";

/** Terrain types in picker order, with the long-ride guidance the coach follows for each. */
export const TERRAINS: Array<{ id: Terrain; label: string; sub: string; guidance: string }> = [
  {
    id: "flat",
    label: "Flat",
    sub: "under 5 m/km",
    guidance:
      "Flat roads: steady Z2 with no natural recoveries; wind and holding position are the load. Build long rides by duration and TSS rather than elevation, add tempo or sweet-spot blocks, and use low-cadence torque work (or indoor climbs) when the athlete needs climbing specificity.",
  },
  {
    id: "rolling",
    label: "Rolling",
    sub: "5–10 m/km",
    guidance:
      "Rolling roads: short rises invite surges. Cap power on the rollers, keep the ride average in Z2, and use the rollers for natural over-unders when intensity is wanted.",
  },
  {
    id: "hilly",
    label: "Hilly",
    sub: "10–15 m/km",
    guidance:
      "Hilly roads: repeated 3–10 min climbs. Pace climbs at upper Z2/tempo with an explicit power cap, and expect TSS to run higher than the duration suggests.",
  },
  {
    id: "mountainous",
    label: "Mountainous",
    sub: "15+ m/km",
    guidance:
      "Mountain roads: long climbs dominate the load. Plan long rides by elevation gain and time, not distance; cap climbing power on endurance days, raise fueling (g carbs/hr) for the extra work, and allow for descents (no work, cold).",
  },
];

export function terrainInfo(terrain: Terrain) {
  return TERRAINS.find((t) => t.id === terrain) ?? TERRAINS[1];
}

export function classifyTerrain(metersPerKm: number): Terrain {
  if (metersPerKm < 5) return "flat";
  if (metersPerKm < 10) return "rolling";
  if (metersPerKm < 15) return "hilly";
  return "mountainous";
}

export interface TerrainSummary {
  terrain: Terrain;
  metersPerKm: number;
  rides: number;
  /** Median of the longest quarter of rides — what a typical long ride looks like. */
  longRide: { distanceKm: number; elevationM: number } | null;
}

const OUTDOOR_RIDE_TYPES = new Set(["Ride", "GravelRide", "MountainBikeRide"]);
const MIN_RIDE_METERS = 20_000;
const MIN_RIDES = 3;

/** Classifies the athlete's local terrain from their outdoor rides; null when there are too few to judge. */
export function summarizeTerrain(activities: ActivitySummary[]): TerrainSummary | null {
  const rides = activities.filter(
    (a) =>
      OUTDOOR_RIDE_TYPES.has(a.type) &&
      (a.distance ?? 0) >= MIN_RIDE_METERS &&
      a.total_elevation_gain != null
  );
  if (rides.length < MIN_RIDES) return null;

  const totalKm = rides.reduce((sum, r) => sum + r.distance! / 1000, 0);
  const totalClimb = rides.reduce((sum, r) => sum + r.total_elevation_gain!, 0);
  const metersPerKm = totalClimb / totalKm;

  const longest = [...rides]
    .sort((a, b) => b.distance! - a.distance!)
    .slice(0, Math.max(1, Math.ceil(rides.length / 4)));
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  return {
    terrain: classifyTerrain(metersPerKm),
    metersPerKm: Math.round(metersPerKm * 10) / 10,
    rides: rides.length,
    longRide: {
      distanceKm: Math.round(median(longest.map((r) => r.distance! / 1000))),
      elevationM: Math.round(median(longest.map((r) => r.total_elevation_gain!)) / 50) * 50,
    },
  };
}
