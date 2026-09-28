"use client";

import React, { useRef, useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isTextUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { ArrowUp, Square } from "lucide-react";
import { ChatMessage, CoachLabel, LiveStatus } from "./ChatMessage";
import { COMPOSER_CHIPS, QuickPrompts } from "./QuickPrompts";
import { DEFAULT_MODELS, DEFAULT_PROVIDER, type ModelProvider } from "@/lib/llm/models";
import {
  FORM_LABELS,
  formatCountdown,
  formatDuration,
  formatSigned,
  toLocalDate,
  type MetricsResponse,
} from "@/lib/intervals/metrics";
import { EMPTY_USAGE, addUsage, formatTokens, messageUsage } from "@/lib/chat/types";
import { eventsBeforeWrites, wroteToCalendar } from "@/lib/chat/known-events";

interface ChatInterfaceProps {
  athleteId: string;
  metrics: MetricsResponse | null;
  /** Stable ID of this conversation; the parent remounts the component (via `key`) to switch chats. */
  chatId: string;
  initialMessages: UIMessage[];
  title?: string;
  onNewChat: () => void;
  onTurnEnd: (changedCalendar: boolean) => void;
}

const API_KEY_STORAGE: Partial<Record<ModelProvider, string>> = {
  google: "apex_gemini_key",
  openai: "apex_openai_key",
  anthropic: "apex_anthropic_key",
};

function getModelSettings() {
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

export function ChatInterface({ athleteId, metrics, chatId, initialMessages, title, onNewChat, onTurnEnd }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // The transport's body callback runs per request; keep athleteId in a ref so it's always current.
  const athleteIdRef = useRef(athleteId);
  athleteIdRef.current = athleteId;

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // History lives on the server: send only the last message.
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { id, message: messages[messages.length - 1], athleteId: athleteIdRef.current, ...getModelSettings() },
        }),
      })
  );

  const onTurnEndRef = useRef(onTurnEnd);
  onTurnEndRef.current = onTurnEnd;

  const { messages, sendMessage, status, stop, error, addToolApprovalResponse } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: ({ message }) => onTurnEndRef.current(wroteToCalendar(message)),
    onError: (err) => {
      console.error("Chat stream error:", err);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const awaitingReply = isLoading && lastMessage?.role === "user";

  const submitText = (value: string) => {
    const text = value.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput("");
  };

  const startNewChat = () => {
    if (isLoading) stop();
    onNewChat();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  const eventsBefore = useMemo(() => eventsBeforeWrites(messages), [messages]);

  const usage = messages.reduce((sum, m) => addUsage(sum, messageUsage(m)), EMPTY_USAGE);

  const firstUserText = messages
    .find((m) => m.role === "user")
    ?.parts.filter(isTextUIPart)
    .map((p) => p.text)
    .join(" ");

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSubmit={() => submitText(input)}
      onStop={stop}
      isLoading={isLoading}
      large={messages.length === 0}
      chips={messages.length > 0 ? COMPOSER_CHIPS : undefined}
      onChip={submitText}
    />
  );

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex justify-center items-center px-4 py-10 lg:py-16">
        <div className="w-full max-w-[680px] flex flex-col gap-8">
          <Briefing metrics={metrics} />
          {composer}
          <QuickPrompts onSelectPrompt={submitText} disabled={isLoading} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="hidden lg:flex sticky top-0 z-20 h-14 shrink-0 items-center justify-between gap-4 px-8 border-b border-ink-hair bg-ink/95 backdrop-blur">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-sm font-medium truncate">{title || firstUserText || "Conversation"}</span>
          {usage.inputTokens + usage.outputTokens > 0 && (
            <span
              className="font-mono text-[11px] text-fg-muted shrink-0"
              title={`${usage.inputTokens.toLocaleString()} input · ${usage.outputTokens.toLocaleString()} output tokens`}
            >
              {formatTokens(usage)} tok
            </span>
          )}
        </div>
        <button
          onClick={startNewChat}
          className="h-8 px-3 shrink-0 border border-ink-line rounded-lg text-xs hover:bg-ink-raised transition"
        >
          New chat
        </button>
      </div>

      <div className="flex-1 flex justify-center px-4 lg:px-8 pt-5 lg:pt-8">
        <div className="w-full max-w-[720px] flex flex-col gap-7 pb-6">
          {messages.map((message, idx) => (
            <ChatMessage
              key={message.id}
              message={message}
              isStreaming={isLoading && idx === messages.length - 1 && message.role === "assistant"}
              onApproval={!isLoading && idx === messages.length - 1 ? addToolApprovalResponse : undefined}
              eventsBefore={eventsBefore}
            />
          ))}

          {awaitingReply && (
            <div className="flex flex-col gap-3">
              <CoachLabel />
              <LiveStatus text="thinking…" />
            </div>
          )}

          {error && (
            <div role="alert" className="flex flex-col gap-1 px-4 py-3 border border-signal-warn/40 rounded-xl text-sm">
              <span className="font-medium text-signal-warn">The coach couldn’t answer</span>
              <span className="text-fg-subtle break-words">{error.message}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="sticky bottom-0 z-20 flex justify-center px-3 lg:px-8 pt-3 pb-4 lg:pb-6 bg-ink">
        <div className="w-full max-w-[720px] flex flex-col gap-2">
          {composer}
          <span className="hidden lg:block text-[11px] text-fg-muted text-center">
            Enter to send · Shift + Enter for a new line · the coach reads your Intervals.icu data live
          </span>
          <button onClick={startNewChat} className="lg:hidden self-center text-xs text-fg-muted underline underline-offset-4">
            New chat
          </button>
        </div>
      </div>
    </div>
  );
}

function greeting(hour: number) {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function Briefing({ metrics }: { metrics: MetricsResponse | null }) {
  // Time-dependent copy is computed after mount so server and client render the same markup.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const fitness = metrics?.fitness;
  const firstname = metrics?.athlete?.firstname;
  const today = now ? toLocalDate(now) : null;
  const todays = metrics?.week.filter((e) => e.date === today) ?? [];
  const warn = fitness?.form_status === "fatigued" || fitness?.form_status === "very_fatigued";
  const races = metrics?.keyEvents?.filter((e) => e.kind === "race") ?? [];
  const race = races.find((e) => e.priority === "A") ?? races[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <span className="font-mono text-xs text-fg-muted uppercase min-h-4">
          {now?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </span>
        <h1 className="text-3xl lg:text-[40px] font-medium tracking-tight leading-tight">
          {now ? greeting(now.getHours()) : "Hello"}
          {firstname ? `, ${firstname}` : ""}.
        </h1>
        {fitness?.tsb != null && (
          <p className="text-base leading-relaxed text-fg-subtle">
            Form is <span className="font-mono text-fg">{formatSigned(fitness.tsb)}</span>,{" "}
            <span className={warn ? "text-signal-warn" : "text-signal"}>{FORM_LABELS[fitness.form_status].toLowerCase()}</span>.{" "}
            {today &&
              (todays.length > 0
                ? `Today’s plan: ${todays.map((e) => e.name).join(" + ")}${
                    todays[0].movingTime ? ` (${formatDuration(todays.reduce((s, e) => s + (e.movingTime ?? 0), 0))})` : ""
                  }.`
                : "Nothing planned today.")}
          </p>
        )}
        {race && (
          <p className="text-base leading-relaxed text-fg-subtle">
            {race.priority === "A" ? "Goal race" : `Next race (${race.priority})`}: <span className="text-fg">{race.name}</span>,{" "}
            {race.daysOut <= 1 ? (
              formatCountdown(race.daysOut)
            ) : (
              <>
                <span className="font-mono text-fg">
                  {race.daysOut < 21 ? race.daysOut : Math.round(race.daysOut / 7)}
                </span>{" "}
                {race.daysOut < 21 ? "days" : "weeks"} out
              </>
            )}
            .
          </p>
        )}
      </div>

      {fitness && (
        <div className="grid grid-cols-3 gap-px bg-ink-line border border-ink-line rounded-xl overflow-hidden">
          <BriefStat label="Fitness · CTL" value={fitness.ctl != null ? Math.round(fitness.ctl).toString() : "—"} />
          <BriefStat label="Fatigue · ATL" value={fitness.atl != null ? Math.round(fitness.atl).toString() : "—"} />
          <BriefStat
            label="Form · TSB"
            value={fitness.tsb != null ? formatSigned(fitness.tsb) : "—"}
            className={warn ? "text-signal-warn" : "text-signal"}
          />
        </div>
      )}
    </div>
  );
}

function BriefStat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-ink-rail px-4 py-3.5 flex flex-col gap-1">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span className={`font-display font-semibold text-[32px] leading-none ${className}`}>{value}</span>
    </div>
  );
}

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isLoading: boolean;
  large: boolean;
  chips?: Array<{ label: string; prompt: string }>;
  onChip: (prompt: string) => void;
}

function Composer({ value, onChange, onSubmit, onStop, isLoading, large, chips, onChip }: ComposerProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-2.5 border border-ink-edge rounded-2xl bg-ink-surface p-3 pl-4 focus-within:border-fg-muted transition"
    >
      <label htmlFor="coach-message" className="sr-only">
        Message your coach
      </label>
      <div className="flex items-end gap-3">
        <textarea
          id="coach-message"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Ask about your form, a ride, or next week…"
          rows={large ? 3 : 2}
          className="flex-1 resize-none bg-transparent text-base lg:text-[15px] leading-normal text-fg placeholder:text-fg-muted focus:outline-none max-h-40 py-1"
        />
        {!chips && <SendButton isLoading={isLoading} canSend={!!value.trim()} onStop={onStop} />}
      </div>
      {chips && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto">
            {chips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={isLoading}
                onClick={() => onChip(chip.prompt)}
                className="h-[30px] px-2.5 shrink-0 border border-ink-line rounded-full text-xs text-fg-subtle hover:text-fg hover:border-ink-edge transition disabled:opacity-40"
              >
                {chip.label}
              </button>
            ))}
          </div>
          <SendButton isLoading={isLoading} canSend={!!value.trim()} onStop={onStop} />
        </div>
      )}
    </form>
  );
}

function SendButton({ isLoading, canSend, onStop }: { isLoading: boolean; canSend: boolean; onStop: () => void }) {
  if (isLoading) {
    return (
      <button
        type="button"
        onClick={onStop}
        aria-label="Stop answering"
        title="Stop answering"
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-ink-edge bg-ink-raised text-fg hover:bg-ink-line transition"
      >
        <Square className="w-3.5 h-3.5 fill-current" />
      </button>
    );
  }
  return (
    <button
      type="submit"
      disabled={!canSend}
      aria-label="Send"
      title="Send"
      className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-signal text-on-signal transition hover:brightness-95 disabled:opacity-30"
    >
      <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2.5} />
    </button>
  );
}
