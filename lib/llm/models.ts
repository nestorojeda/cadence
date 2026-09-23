/**
 * LLM provider identifiers and default model IDs, shared by the chat route and the settings UI.
 */

export type ModelProvider = "google" | "openai" | "anthropic" | "ollama";

export const DEFAULT_PROVIDER: ModelProvider = "google";

export const DEFAULT_MODELS: Record<ModelProvider, string> = {
  google: "gemini-3.6-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-5",
  ollama: "qwen3:1.7b",
};

/** Ollama's OpenAI-compatible endpoint; override server-side with OLLAMA_BASE_URL. */
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
