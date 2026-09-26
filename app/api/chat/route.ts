import { NextRequest } from "next/server";
import {
  createUIMessageStreamResponse,
  generateId,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type UIMessage,
} from "ai";
import { createGoogle, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { IntervalsClient } from "@/lib/intervals/client";
import { getIntervalsTools } from "@/lib/intervals/tools";
import { HevyClient } from "@/lib/hevy/client";
import { getHevyTools } from "@/lib/hevy/tools";
import { getKeyEvents } from "@/lib/intervals/events";
import { getPreferences } from "@/lib/storage/preferences-store";
import { buildCoachSystemPrompt } from "@/lib/coach/prompt";
import {
  DEFAULT_MODELS,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_PROVIDER,
  THINKING_LEVELS,
  resolveThinkingLevel,
  supportsThinkingLevel,
  type ThinkingLevel,
} from "@/lib/llm/models";
import { isValidChatId, loadChat, updateChat } from "@/lib/storage/chat-store";
import { buildModelMessages, foldSummary, historyInstructions, messagesAfterSummary } from "@/lib/chat/context";
import { applyApprovalResponses, expirePendingApprovals } from "@/lib/chat/approvals";
import type { CoachMessageMetadata, StoredChat } from "@/lib/chat/types";
import { WRITE_TOOL_NAMES } from "@/lib/intervals/tool-names";

export const maxDuration = 60;

/**
 * Model steps per turn. Planning with Hevy lookups can take many read rounds, so the last steps are reserved: reads
 * are switched off for the final two (the coach can still schedule), and the final step answers without tools, so a
 * turn never ends on a tool result with no reply.
 */
const MAX_STEPS = 12;

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
    // The client sends only the new message (or, to answer tool approvals, the paused assistant message); history is
    // loaded from disk so it isn't re-uploaded every turn.
    const {
      id: chatId,
      message,
      athleteId = process.env.INTERVALS_ICU_ATHLETE_ID || "i435091",
      modelProvider = DEFAULT_PROVIDER,
      modelName,
      thinkingLevel,
      apiKey: clientApiKey,
      intervalsApiKey: clientIntervalsKey,
      hevyApiKey: clientHevyKey,
    }: {
      id: string;
      message: UIMessage;
      athleteId?: string;
      modelProvider?: string;
      modelName?: string;
      thinkingLevel?: ThinkingLevel;
      apiKey?: string;
      intervalsApiKey?: string;
      hevyApiKey?: string;
    } = await req.json();

    if (!isValidChatId(chatId) || !message || (message.role !== "user" && message.role !== "assistant")) {
      return jsonError("Expected a chat `id` and a user or assistant `message`.", 400);
    }

    // Initialize Intervals.icu client and AI tools
    const intervalsApiKey =
      clientIntervalsKey || process.env.INTERVALS_ICU_API_KEY || "";
    const intervalsClient = new IntervalsClient(intervalsApiKey, athleteId);
    // Hevy is optional: with a key, gym sessions also become Hevy routines and the coach can read past lifts.
    const hevyKey = clientHevyKey || process.env.HEVY_API_KEY;
    const hevyClient = hevyKey ? new HevyClient(hevyKey) : null;
    const tools = {
      ...getIntervalsTools(intervalsClient, hevyClient),
      ...(hevyClient ? getHevyTools(hevyClient) : {}),
    };

    // Persistent preferences plus upcoming races and time off, which are usually beyond the calendar tool's window.
    const [preferences, keyEvents] = await Promise.all([
      getPreferences(athleteId),
      getKeyEvents(intervalsClient, athleteId).catch((error) => {
        console.warn("[POST /api/chat] Could not load races:", errorMessage(error));
        return null;
      }),
    ]);
    const systemPrompt = buildCoachSystemPrompt(preferences, new Date(), keyEvents, { hevyConnected: !!hevyClient });

    // Resolve Language Model Provider
    let model: LanguageModel;
    let providerOptions: Parameters<typeof streamText>[0]["providerOptions"];
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
      const googleModel = modelName || DEFAULT_MODELS.google;
      model = google(googleModel);
      // Effort is the athlete's choice in Settings (they pay for the thinking tokens). Older models (2.5) take a
      // thinkingBudget instead, so they keep their default.
      if (supportsThinkingLevel(googleModel)) {
        const requested = thinkingLevel && THINKING_LEVELS.includes(thinkingLevel) ? thinkingLevel : undefined;
        providerOptions = {
          google: {
            thinkingConfig: { thinkingLevel: resolveThinkingLevel(googleModel, requested) },
          } satisfies GoogleLanguageModelOptions,
        };
      }
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
        // OpenAI-compatible streams omit token counts unless asked; the chat history shows usage per chat.
        includeUsage: true,
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

    const stored = await loadChat(athleteId, chatId);
    const history = stored?.messages ?? [];
    let messages: UIMessage[];
    if (message.role === "assistant") {
      // Approval continuation: merge the athlete's decisions into the stored message and resume that turn.
      const last = history[history.length - 1];
      const answered = last?.id === message.id ? applyApprovalResponses(last, message) : null;
      if (!answered) {
        return jsonError("Nothing to confirm: this message has no pending calendar changes.", 400);
      }
      messages = [...history.slice(0, -1), answered];
    } else {
      // Replace rather than append when the client resends a message it already sent (e.g. a retry). Approvals left
      // unanswered are declined: the athlete moved on without adding those sessions.
      messages = [...history.filter((m) => m.id !== message.id), message].map((m) =>
        m.role === "assistant" ? expirePendingApprovals(m) : m
      );
    }

    // Saved history may predate a tool schema change; if it no longer validates, answer from the new message alone
    // (the full history is still persisted below).
    const pending = messagesAfterSummary(messages, stored?.summary);
    const validated = await safeValidateUIMessages({ messages: pending, tools });
    if (!validated.success) {
      console.warn(`[POST /api/chat] Stored history for chat ${chatId} failed validation:`, validated.error.message);
    }
    const modelMessages = await buildModelMessages(
      validated.success ? validated.data : messages.slice(message.role === "user" ? -1 : -2),
      tools
    );
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[POST /api/chat] chat ${chatId}: ${messages.length} stored, ${modelMessages.length} sent to model ` +
          `(~${JSON.stringify(modelMessages).length} chars)${stored?.summary ? ", with summary" : ""}`
      );
    }

    const result = streamText({
      model,
      instructions: systemPrompt + historyInstructions(stored),
      messages: modelMessages,
      tools,
      providerOptions,
      // Calendar writes wait for the athlete: the stream ends with a preview card to approve or skip.
      toolApproval: Object.fromEntries(WRITE_TOOL_NAMES.map((name) => [name, "user-approval" as const])),
      stopWhen: isStepCount(MAX_STEPS),
      prepareStep: ({ stepNumber }) => {
        if (stepNumber >= MAX_STEPS - 1) return { toolChoice: "none" as const };
        if (stepNumber >= MAX_STEPS - 3) {
          return { activeTools: WRITE_TOOL_NAMES.filter((name) => name in tools) as Array<keyof typeof tools> };
        }
        return undefined;
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        originalMessages: messages,
        // Stored messages need stable IDs: the summary cutoff and client-side retries refer to them.
        generateMessageId: generateId,
        messageMetadata: ({ part }): CoachMessageMetadata | undefined =>
          part.type === "finish"
            ? {
                usage: {
                  inputTokens: part.totalUsage.inputTokens ?? 0,
                  outputTokens: part.totalUsage.outputTokens ?? 0,
                },
              }
            : undefined,
        onEnd: async ({ messages: finished }) => {
          try {
            const chat = await updateChat(athleteId, chatId, (current) => ({
              messages: finished,
              summary: current?.summary,
            }));
            // Fold older turns into the summary in the background so the reply isn't held open.
            void summarize(athleteId, model, chat);
          } catch (error) {
            console.error(`[POST /api/chat] Could not save chat ${chatId}:`, error);
          }
        },
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

// One summary at a time per chat; a later turn retries if this one is skipped or fails.
const summarizing = new Set<string>();

async function summarize(athleteId: string, model: LanguageModel, chat: StoredChat) {
  const key = `${athleteId}/${chat.meta.id}`;
  if (summarizing.has(key)) return;
  summarizing.add(key);
  try {
    const summary = await foldSummary(model, chat);
    if (!summary) return;
    await updateChat(athleteId, chat.meta.id, (current) => ({ messages: current?.messages ?? chat.messages, summary }), {
      touch: false,
    });
  } catch (error) {
    console.error(`[POST /api/chat] Could not summarize chat ${chat.meta.id}:`, errorMessage(error));
  } finally {
    summarizing.delete(key);
  }
}
