/**
 * LLM provider identifiers and default model IDs, shared by the chat route and the settings UI.
 */

export type ModelProvider = "google" | "openai" | "anthropic" | "ollama";

export const DEFAULT_PROVIDER: ModelProvider = "google";

export const DEFAULT_MODELS: Record<ModelProvider, string> = {
  google: "gemini-3.8-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-5",
  ollama: "qwen3:1.7b",
};

/** Gemini 3+ reasoning depth. Higher levels think longer, and thinking tokens are billed as output. */
export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export const THINKING_LEVELS: ThinkingLevel[] = ["minimal", "low", "medium", "high"];

export const DEFAULT_THINKING_LEVEL: ThinkingLevel = "medium";

export interface ModelOption {
  id: string;
  label: string;
  note: string;
  /** Thinking levels the model accepts (per ai.google.dev/gemini-api/docs/thinking). */
  thinkingLevels: ThinkingLevel[];
}

/** Models offered in the settings dropdown. Any other ID can still be entered as a custom model. */
export const GOOGLE_MODELS: ModelOption[] = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "Balanced", thinkingLevels: ["low", "medium", "high"] },
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", note: "Fast", thinkingLevels: ["low", "medium", "high"] },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", note: "Previous Flash", thinkingLevels: THINKING_LEVELS },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", note: "Older, pricier", thinkingLevels: THINKING_LEVELS },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", note: "Cheapest", thinkingLevels: THINKING_LEVELS },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (preview)",
    note: "Smartest, ~3× Flash cost",
    thinkingLevels: ["low", "medium", "high"],
  },
];

/** Whether a Gemini model takes `thinkingLevel` (3 and later; 2.5 uses a token budget instead). */
export function supportsThinkingLevel(modelId: string) {
  return /^gemini-([3-9]|\d{2})/.test(modelId);
}

/**
 * The level to send for a model: the requested one if the model accepts it, else the closest level it does.
 * Unlisted models get the requested level as-is.
 */
export function resolveThinkingLevel(modelId: string, requested: ThinkingLevel = DEFAULT_THINKING_LEVEL) {
  const supported = GOOGLE_MODELS.find((m) => m.id === modelId)?.thinkingLevels;
  if (!supported || supported.includes(requested)) return requested;
  const rank = THINKING_LEVELS.indexOf(requested);
  return supported.reduce((best, level) =>
    Math.abs(THINKING_LEVELS.indexOf(level) - rank) < Math.abs(THINKING_LEVELS.indexOf(best) - rank) ? level : best
  );
}

/** Ollama's OpenAI-compatible endpoint; override server-side with OLLAMA_BASE_URL. */
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
