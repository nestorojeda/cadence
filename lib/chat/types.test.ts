import { describe, expect, it } from "vitest";
import { addUsage, formatChatDate, formatTokens } from "./types";

describe("formatTokens", () => {
  it("abbreviates thousands", () => {
    expect(formatTokens({ inputTokens: 400, outputTokens: 99 })).toBe("499");
    expect(formatTokens({ inputTokens: 12_000, outputTokens: 400 })).toBe("12k");
    expect(formatTokens({ inputTokens: 1200, outputTokens: 0 })).toBe("1.2k");
  });
});

describe("addUsage", () => {
  it("sums usage and ignores missing values", () => {
    const a = { inputTokens: 1, outputTokens: 2 };
    expect(addUsage(a, { inputTokens: 10, outputTokens: 20 })).toEqual({ inputTokens: 11, outputTokens: 22 });
    expect(addUsage(a, undefined)).toBe(a);
  });
});

describe("formatChatDate", () => {
  const now = new Date(2026, 8, 26, 10); // Sat 26 Sep 2026

  it("uses relative words for recent days", () => {
    expect(formatChatDate(new Date(2026, 8, 26, 1).toISOString(), now)).toBe("today");
    expect(formatChatDate(new Date(2026, 8, 25, 23).toISOString(), now)).toBe("yesterday");
    expect(formatChatDate(new Date(2026, 8, 22, 12).toISOString(), now)).toBe("Tue");
    expect(formatChatDate(new Date(2026, 7, 12, 12).toISOString(), now)).toBe("12 Aug");
  });
});
