import { describe, expect, it } from "vitest";
import type { ActivitySummary } from "./client";
import { classifyTerrain, summarizeTerrain, terrainInfo } from "./terrain";

const ride = (km: number, climb: number | undefined, type = "Ride"): ActivitySummary => ({
  id: `${km}-${climb}`,
  name: "Ride",
  type,
  start_date_local: "2026-09-01T08:00:00",
  distance: km * 1000,
  total_elevation_gain: climb,
});

describe("classifyTerrain", () => {
  it("uses 5/10/15 m/km thresholds", () => {
    expect(classifyTerrain(4.9)).toBe("flat");
    expect(classifyTerrain(5)).toBe("rolling");
    expect(classifyTerrain(10)).toBe("hilly");
    expect(classifyTerrain(15)).toBe("mountainous");
  });

  it("falls back to rolling for unknown terrain", () => {
    expect(terrainInfo("nope" as never).id).toBe("rolling");
  });
});

describe("summarizeTerrain", () => {
  it("needs at least three qualifying outdoor rides", () => {
    expect(
      summarizeTerrain([
        ride(50, 500),
        ride(60, 600),
        ride(50, 500, "VirtualRide"),
        ride(10, 100),
        ride(80, undefined),
      ]),
    ).toBeNull();
  });

  it("classifies by total climbing per km and describes a long ride", () => {
    const summary = summarizeTerrain([
      ride(40, 480),
      ride(60, 720),
      ride(100, 1200, "GravelRide"),
      ride(120, 1440),
      ride(30, 60, "VirtualRide"),
    ]);
    // 3840 m over 320 km = 12 m/km; longest quarter (1 ride) = 120 km / 1440 m → 1450 m.
    expect(summary).toEqual({
      terrain: "hilly",
      metersPerKm: 12,
      rides: 4,
      longRide: { distanceKm: 120, elevationM: 1450 },
    });
  });
});
