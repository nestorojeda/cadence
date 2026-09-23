/**
 * LLM provider identifiers and default model IDs, shared by the chat route and the settings UI.
 */

export type ModelProvider = "google" | "openai" | "anthropic";

export const DEFAULT_PROVIDER: ModelProvider = "google";

export const DEFAULT_MODELS: Record<ModelProvider, string> = {
  google: "gemini-3.6-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-5",
};
