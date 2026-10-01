import { DEFAULT_MODELS, DEFAULT_PROVIDER, type ModelProvider } from "@/lib/llm/models";

const API_KEY_STORAGE: Partial<Record<ModelProvider, string>> = {
  google: "apex_gemini_key",
  openai: "apex_openai_key",
  anthropic: "apex_anthropic_key",
};

/** The model and keys chosen in Settings, sent with each request. Browser only. */
export function getModelSettings() {
  const modelProvider = (localStorage.getItem("apex_model_provider") as ModelProvider) || DEFAULT_PROVIDER;
  return {
    modelProvider,
    modelName: localStorage.getItem("apex_model_name") || DEFAULT_MODELS[modelProvider],
    thinkingLevel: localStorage.getItem("apex_thinking_level") || undefined,
    apiKey: (API_KEY_STORAGE[modelProvider] && localStorage.getItem(API_KEY_STORAGE[modelProvider])) || undefined,
    intervalsApiKey: localStorage.getItem("apex_intervals_key") || undefined,
    hevyApiKey: localStorage.getItem("apex_hevy_key") || undefined,
  };
}
