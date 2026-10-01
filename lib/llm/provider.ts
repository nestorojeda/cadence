import type { LanguageModel, streamText } from "ai";
import { createGoogle, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  DEFAULT_MODELS,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_PROVIDER,
  resolveThinkingLevel,
  supportsThinkingLevel,
  type ThinkingLevel,
} from "@/lib/llm/models";

export interface ModelRequest {
  provider?: string;
  modelName?: string;
  /** Overrides the provider's env key. */
  apiKey?: string;
  thinkingLevel?: ThinkingLevel;
}

export interface ResolvedModel {
  model: LanguageModel;
  /** Provider and model ID, e.g. `google · gemini-3.8-flash`. */
  label: string;
  providerOptions: Parameters<typeof streamText>[0]["providerOptions"];
  describeError: (error: unknown) => string;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const missingKey = (name: string, envVar: string) =>
  `${name} API key not found. Please add ${envVar} in .env.local or enter it in the app Settings.`;

/** The only place that knows about individual providers. */
export function resolveModel({
  provider = DEFAULT_PROVIDER,
  modelName,
  apiKey,
  thinkingLevel,
}: ModelRequest): ResolvedModel | { error: string } {
  if (provider === "google") {
    const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) return { error: missingKey("Google Gemini", "GEMINI_API_KEY") };
    const id = modelName || DEFAULT_MODELS.google;
    // Effort is the athlete's choice in Settings (they pay for the thinking tokens). Older models (2.5) take a
    // thinkingBudget instead, so they keep their default.
    const providerOptions = supportsThinkingLevel(id)
      ? {
          google: {
            thinkingConfig: { thinkingLevel: resolveThinkingLevel(id, thinkingLevel) },
          } satisfies GoogleLanguageModelOptions,
        }
      : undefined;
    return {
      model: createGoogle({ apiKey: key })(id),
      label: `google · ${id}`,
      providerOptions,
      describeError: errorMessage,
    };
  }
  if (provider === "openai") {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) return { error: missingKey("OpenAI", "OPENAI_API_KEY") };
    const id = modelName || DEFAULT_MODELS.openai;
    return {
      model: createOpenAI({ apiKey: key })(id),
      label: `openai · ${id}`,
      providerOptions: undefined,
      describeError: errorMessage,
    };
  }
  if (provider === "anthropic") {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) return { error: missingKey("Anthropic", "ANTHROPIC_API_KEY") };
    const id = modelName || DEFAULT_MODELS.anthropic;
    return {
      model: createAnthropic({ apiKey: key })(id),
      label: `anthropic · ${id}`,
      providerOptions: undefined,
      describeError: errorMessage,
    };
  }
  if (provider === "ollama") {
    // Base URL is server config only: accepting it from the request would let clients point the server anywhere.
    const baseURL = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
    const id = modelName || DEFAULT_MODELS.ollama;
    const ollama = createOpenAICompatible({
      name: "ollama",
      baseURL,
      apiKey: apiKey || process.env.OLLAMA_API_KEY,
      // OpenAI-compatible streams omit token counts unless asked; the chat history shows usage per chat.
      includeUsage: true,
    });
    return {
      model: ollama(id),
      label: `ollama · ${id}`,
      providerOptions: undefined,
      describeError: (error) => {
        const message = errorMessage(error);
        const detail = `${message} ${error instanceof Error && error.cause ? errorMessage(error.cause) : ""}`;
        if (/ECONNREFUSED|Cannot connect|fetch failed/i.test(detail)) {
          return `Ollama isn't reachable at ${baseURL}. Is \`ollama serve\` running? (${message})`;
        }
        if (/not found/i.test(message) && message.includes(id)) {
          return `Ollama model "${id}" isn't installed. Run \`ollama pull ${id}\`. (${message})`;
        }
        return message;
      },
    };
  }
  return { error: `Unknown model provider: ${provider}` };
}
