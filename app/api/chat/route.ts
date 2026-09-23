import { NextRequest } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type UIMessage,
} from "ai";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { IntervalsClient } from "@/lib/intervals/client";
import { getIntervalsTools } from "@/lib/intervals/tools";
import { getPreferences } from "@/lib/storage/preferences-store";
import { buildCoachSystemPrompt } from "@/lib/coach/prompt";
import { DEFAULT_MODELS, DEFAULT_OLLAMA_BASE_URL, DEFAULT_PROVIDER } from "@/lib/llm/models";

export const maxDuration = 60;

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      athleteId = process.env.INTERVALS_ICU_ATHLETE_ID || "i435091",
      modelProvider = DEFAULT_PROVIDER,
      modelName,
      apiKey: clientApiKey,
      intervalsApiKey: clientIntervalsKey,
    }: {
      messages: UIMessage[];
      athleteId?: string;
      modelProvider?: string;
      modelName?: string;
      apiKey?: string;
      intervalsApiKey?: string;
    } = await req.json();

    // Load persistent preferences for this athlete
    const preferences = await getPreferences(athleteId);
    const systemPrompt = buildCoachSystemPrompt(preferences);

    // Initialize Intervals.icu client and AI tools
    const intervalsApiKey =
      clientIntervalsKey || process.env.INTERVALS_ICU_API_KEY || "";
    const intervalsClient = new IntervalsClient(intervalsApiKey, athleteId);
    const tools = getIntervalsTools(intervalsClient);

    // Resolve Language Model Provider
    let model: LanguageModel;
    // Turns a stream error into the message shown in the chat; providers can override it with a friendlier hint.
    let describeError = errorMessage;
    if (modelProvider === "google") {
      const key = clientApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!key) {
        return jsonError(
          "Google Gemini API key not found. Please add GEMINI_API_KEY in .env.local or enter it in the app Settings.",
          400
        );
      }
      const google = createGoogle({ apiKey: key });
      model = google(modelName || DEFAULT_MODELS.google);
    } else if (modelProvider === "openai") {
      const key = clientApiKey || process.env.OPENAI_API_KEY;
      if (!key) {
        return jsonError(
          "OpenAI API key not found. Please add OPENAI_API_KEY in .env.local or enter it in the app Settings.",
          400
        );
      }
      const openai = createOpenAI({ apiKey: key });
      model = openai(modelName || DEFAULT_MODELS.openai);
    } else if (modelProvider === "anthropic") {
      const key = clientApiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) {
        return jsonError(
          "Anthropic API key not found. Please add ANTHROPIC_API_KEY in .env.local or enter it in the app Settings.",
          400
        );
      }
      const anthropic = createAnthropic({ apiKey: key });
      model = anthropic(modelName || DEFAULT_MODELS.anthropic);
    } else if (modelProvider === "ollama") {
      // Base URL is server config only: accepting it from the request would let clients point the server anywhere.
      const baseURL = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
      const ollamaModel = modelName || DEFAULT_MODELS.ollama;
      const ollama = createOpenAICompatible({
        name: "ollama",
        baseURL,
        // Optional: only needed behind an authenticating proxy or for ollama.com.
        apiKey: clientApiKey || process.env.OLLAMA_API_KEY,
      });
      model = ollama(ollamaModel);
      describeError = (error) => {
        const message = errorMessage(error);
        const detail = `${message} ${error instanceof Error && error.cause ? String(error.cause) : ""}`;
        if (/ECONNREFUSED|Cannot connect|fetch failed/i.test(detail)) {
          return `Ollama isn't reachable at ${baseURL}. Is \`ollama serve\` running? (${message})`;
        }
        if (/not found/i.test(message) && message.includes(ollamaModel)) {
          return `Ollama model "${ollamaModel}" isn't installed. Run \`ollama pull ${ollamaModel}\`. (${message})`;
        }
        return message;
      };
    } else {
      return jsonError(`Unknown model provider: ${modelProvider}`, 400);
    }

    // convertToModelMessages keeps each part's provider metadata (e.g. Gemini's
    // thoughtSignature on function calls), which thinking models require on follow-up turns.
    const result = streamText({
      model,
      instructions: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: isStepCount(6), // Allows multi-turn tool calling (e.g. check wellness -> check activities -> answer)
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        originalMessages: messages,
        onError: (error) => {
          console.error("[POST /api/chat] Stream error:", error);
          return describeError(error);
        },
      }),
    });
  } catch (error) {
    console.error("[POST /api/chat] Error:", error);
    return jsonError((error as Error).message, 500);
  }
}
