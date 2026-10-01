import { NextRequest } from "next/server";
import { z } from "zod";
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
import { IntervalsClient } from "@/lib/intervals/client";
import { getIntervalsTools } from "@/lib/intervals/tools";
import { HevyClient } from "@/lib/hevy/client";
import { getHevyTools } from "@/lib/hevy/tools";
import { getKeyEvents } from "@/lib/intervals/events";
import { getPreferences } from "@/lib/storage/preferences-store";
import { getMemory } from "@/lib/storage/memory-store";
import { getCoachTools } from "@/lib/coach/tools";
import { buildCoachSystemPrompt } from "@/lib/coach/prompt";
import { DEFAULT_PROVIDER, THINKING_LEVELS, type ThinkingLevel } from "@/lib/llm/models";
import { errorMessage, resolveModel } from "@/lib/llm/provider";
import { isValidChatId, loadChat, updateChat } from "@/lib/storage/chat-store";
import { buildModelMessages, foldSummary, historyInstructions, messagesAfterSummary } from "@/lib/chat/context";
import { applyApprovalResponses, expirePendingApprovals } from "@/lib/chat/approvals";
import type { CoachMessageMetadata, StoredChat } from "@/lib/chat/types";
import { MEMORY_TOOL_NAMES, WRITE_TOOL_NAMES } from "@/lib/intervals/tool-names";
import { resolveAthleteId } from "@/lib/api/athlete";

export const maxDuration = 60;

// The last steps are reserved: reads are switched off for the final two and the final step answers without tools,
// so a turn never ends on a tool result with no reply.
const MAX_STEPS = 12;

const optionalString = z.string().max(4096).optional();

const requestSchema = z.object({
  id: z.string().refine(isValidChatId),
  message: z
    .object({ id: z.string().min(1), role: z.enum(["user", "assistant"]), parts: z.array(z.unknown()) })
    .passthrough(),
  athleteId: optionalString,
  modelProvider: optionalString,
  modelName: optionalString,
  // A stale stored level shouldn't fail the request: unknown values fall back to the model's default.
  thinkingLevel: optionalString.transform((v) =>
    THINKING_LEVELS.includes(v as ThinkingLevel) ? (v as ThinkingLevel) : undefined,
  ),
  apiKey: optionalString,
  intervalsApiKey: optionalString,
  hevyApiKey: optionalString,
});

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = requestSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) {
      return jsonError("Expected a chat `id` and a user or assistant `message`.", 400);
    }
    const {
      id: chatId,
      modelProvider = DEFAULT_PROVIDER,
      modelName,
      thinkingLevel,
      apiKey: clientApiKey,
      intervalsApiKey: clientIntervalsKey,
      hevyApiKey: clientHevyKey,
    } = body.data;
    // Only the envelope is checked here; parts pass through untouched (they carry provider metadata).
    const message = body.data.message as unknown as UIMessage;
    const athleteId = resolveAthleteId(body.data.athleteId);
    if (!athleteId) {
      return jsonError(
        "No valid Intervals.icu athlete ID. Set it in Settings or INTERVALS_ICU_ATHLETE_ID in .env.local.",
        400,
      );
    }

    const intervalsApiKey = clientIntervalsKey || process.env.INTERVALS_ICU_API_KEY || "";
    const intervalsClient = new IntervalsClient(intervalsApiKey, athleteId);
    const hevyKey = clientHevyKey || process.env.HEVY_API_KEY;
    const hevyClient = hevyKey ? new HevyClient(hevyKey) : null;
    const tools = {
      ...getIntervalsTools(intervalsClient, hevyClient),
      ...(hevyClient ? getHevyTools(hevyClient) : {}),
      ...getCoachTools(athleteId, chatId),
    };

    const [preferences, memory, keyEvents] = await Promise.all([
      getPreferences(athleteId),
      getMemory(athleteId),
      getKeyEvents(intervalsClient, athleteId).catch((error) => {
        console.warn("[POST /api/chat] Could not load races:", errorMessage(error));
        return null;
      }),
    ]);
    const systemPrompt = buildCoachSystemPrompt(preferences, new Date(), keyEvents, {
      hevyConnected: !!hevyClient,
      memory,
    });

    const resolved = resolveModel({ provider: modelProvider, modelName, apiKey: clientApiKey, thinkingLevel });
    if ("error" in resolved) return jsonError(resolved.error, 400);
    const { model, providerOptions, describeError } = resolved;

    const stored = await loadChat(athleteId, chatId);
    const history = stored?.messages ?? [];
    let messages: UIMessage[];
    if (message.role === "assistant") {
      const last = history[history.length - 1];
      const answered = last?.id === message.id ? applyApprovalResponses(last, message) : null;
      if (!answered) {
        return jsonError("Nothing to confirm: this message has no pending calendar changes.", 400);
      }
      messages = [...history.slice(0, -1), answered];
    } else {
      // Replace rather than append on a resend (e.g. a retry). Unanswered approvals are declined.
      messages = [...history.filter((m) => m.id !== message.id), message].map((m) =>
        m.role === "assistant" ? expirePendingApprovals(m) : m,
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
      tools,
    );
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[POST /api/chat] chat ${chatId}: ${messages.length} stored, ${modelMessages.length} sent to model ` +
          `(~${JSON.stringify(modelMessages).length} chars)${stored?.summary ? ", with summary" : ""}`,
      );
    }

    const result = streamText({
      model,
      instructions: systemPrompt + historyInstructions(stored),
      messages: modelMessages,
      tools,
      providerOptions,
      toolApproval: Object.fromEntries(WRITE_TOOL_NAMES.map((name) => [name, "user-approval" as const])),
      stopWhen: isStepCount(MAX_STEPS),
      prepareStep: ({ stepNumber }) => {
        if (stepNumber >= MAX_STEPS - 1) return { toolChoice: "none" as const };
        if (stepNumber >= MAX_STEPS - 3) {
          return {
            activeTools: [...WRITE_TOOL_NAMES, ...MEMORY_TOOL_NAMES].filter((name) => name in tools) as Array<
              keyof typeof tools
            >,
          };
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
    await updateChat(
      athleteId,
      chat.meta.id,
      (current) => ({ messages: current?.messages ?? chat.messages, summary }),
      {
        touch: false,
      },
    );
  } catch (error) {
    console.error(`[POST /api/chat] Could not summarize chat ${chat.meta.id}:`, errorMessage(error));
  } finally {
    summarizing.delete(key);
  }
}
