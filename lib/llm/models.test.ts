import { describe, expect, it } from "vitest";
import { DEFAULT_MODELS, DEFAULT_PROVIDER, GOOGLE_MODELS, resolveThinkingLevel, supportsThinkingLevel } from "./models";

describe("resolveThinkingLevel", () => {
  it("keeps a level the model supports", () => {
    expect(resolveThinkingLevel("gemini-3.8-flash", "high")).toBe("high");
    expect(resolveThinkingLevel("gemini-3.6-flash", "minimal")).toBe("minimal");
  });

  it("falls back to the closest supported level", () => {
    expect(resolveThinkingLevel("gemini-3.8-flash", "minimal")).toBe("low");
    expect(resolveThinkingLevel("gemini-3.1-pro-preview", "minimal")).toBe("low");
  });

  it("passes the level through for unlisted models", () => {
    expect(resolveThinkingLevel("gemini-9-ultra", "minimal")).toBe("minimal");
  });

  it("defaults to medium", () => {
    expect(resolveThinkingLevel("gemini-3.8-flash")).toBe("medium");
  });
});

describe("supportsThinkingLevel", () => {
  it("is true for Gemini 3 and later only", () => {
    expect(supportsThinkingLevel("gemini-3.5-flash")).toBe(true);
    expect(supportsThinkingLevel("gemini-10-pro")).toBe(true);
    expect(supportsThinkingLevel("gemini-2.5-flash")).toBe(false);
    expect(supportsThinkingLevel("gpt-4o")).toBe(false);
  });
});

describe("defaults", () => {
  it("has a default model for the default provider", () => {
    expect(DEFAULT_MODELS[DEFAULT_PROVIDER]).toBeTruthy();
  });

  it("offers the default Google model in the dropdown", () => {
    expect(GOOGLE_MODELS.map((m) => m.id)).toContain(DEFAULT_MODELS.google);
  });
});
