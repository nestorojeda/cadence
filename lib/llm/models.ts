export type ModelProvider = "google" | "openai" | "anthropic" | "ollama";

export const DEFAULT_PROVIDER: ModelProvider = "google";

export const DEFAULT_MODELS: Record<ModelProvider, string> = {
  google: "gemini-3.8-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-5",
  ollama: "qwen3:1.7b",
};

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export const THINKING_LEVELS: ThinkingLevel[] = ["minimal", "low", "medium", "high"];

export const DEFAULT_THINKING_LEVEL: ThinkingLevel = "medium";

export interface ModelOption {
  id: string;
  label: string;
  note: string;
  thinkingLevels: ThinkingLevel[];
}

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

export function supportsThinkingLevel(modelId: string) {
  return /^gemini-([3-9]|\d{2})/.test(modelId);
}

export function resolveThinkingLevel(modelId: string, requested: ThinkingLevel = DEFAULT_THINKING_LEVEL) {
  const supported = GOOGLE_MODELS.find((m) => m.id === modelId)?.thinkingLevels;
  if (!supported || supported.includes(requested)) return requested;
  const rank = THINKING_LEVELS.indexOf(requested);
  return supported.reduce((best, level) =>
    Math.abs(THINKING_LEVELS.indexOf(level) - rank) < Math.abs(THINKING_LEVELS.indexOf(best) - rank) ? level : best,
  );
}

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
