import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODELS } from "./models";
import { resolveModel } from "./provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveModel", () => {
  it("needs a key for hosted providers", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(resolveModel({ provider: "openai" })).toEqual({ error: expect.stringContaining("OPENAI_API_KEY") });
    expect(resolveModel({ provider: "openai", apiKey: "sk-test" })).toMatchObject({
      label: `openai · ${DEFAULT_MODELS.openai}`,
    });
  });

  it("falls back to the env key and default model", () => {
    vi.stubEnv("GEMINI_API_KEY", "g-test");
    const resolved = resolveModel({ provider: "google", thinkingLevel: "minimal" });
    expect(resolved).toMatchObject({ label: `google · ${DEFAULT_MODELS.google}` });
    expect("error" in resolved ? null : resolved.providerOptions).toEqual({
      google: { thinkingConfig: { thinkingLevel: "low" } },
    });
  });

  it("runs Ollama without a key and explains connection errors", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://ollama.test/v1");
    const resolved = resolveModel({ provider: "ollama", modelName: "qwen3:1.7b" });
    if ("error" in resolved) throw new Error(resolved.error);
    expect(resolved.describeError(new Error("fetch failed"))).toContain("http://ollama.test/v1");
  });

  it("rejects unknown providers", () => {
    expect(resolveModel({ provider: "acme" })).toEqual({ error: "Unknown model provider: acme" });
  });
});
