"use client";

import React, { useRef, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isTextUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { ArrowDown, ArrowUp, Square } from "lucide-react";
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

const NEAR_BOTTOM_PX = 80;

function isNearBottom() {
  const doc = document.documentElement;
  return doc.scrollHeight - (window.scrollY + window.innerHeight) < NEAR_BOTTOM_PX;
}

function scrollToBottom(behavior: ScrollBehavior) {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
}

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

export function ChatInterface({
  athleteId,
  metrics,
  chatId,
  initialMessages,
  title,
  onNewChat,
  onTurnEnd,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const followRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

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
      }),
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
    followRef.current = true;
    void sendMessage({ text });
    setInput("");
  };

  const startNewChat = () => {
    if (isLoading) void stop();
    onNewChat();
  };

  useEffect(() => {
    const onScroll = () => {
      const near = isNearBottom();
      followRef.current = near;
      setAtBottom(near);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Smooth scrolling would fire scroll events mid-animation that read as "the athlete scrolled up".
  useEffect(() => {
    if (followRef.current) scrollToBottom("instant");
  }, [messages, isLoading]);

  const jumpToLatest = () => {
    followRef.current = true;
    scrollToBottom("smooth");
  };

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
      <div className="flex flex-1 justify-center px-4 pt-8 lg:items-center lg:py-16">
        <div className="flex w-full max-w-[680px] flex-col gap-8">
          <Briefing metrics={metrics} />
          <div className="sticky bottom-0 z-20 order-last -mx-4 mt-auto bg-ink px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:static lg:order-none lg:mx-0 lg:mt-0 lg:bg-transparent lg:p-0">
            {composer}
          </div>
          <QuickPrompts onSelectPrompt={submitText} disabled={isLoading} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-20 hidden h-14 shrink-0 items-center justify-between gap-4 border-b border-ink-hair bg-ink/95 px-8 backdrop-blur lg:flex">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="truncate text-sm font-medium">{title || firstUserText || "Conversation"}</span>
          {usage.inputTokens + usage.outputTokens > 0 && (
            <span
              className="shrink-0 font-mono text-[11px] text-fg-muted"
              title={`${usage.inputTokens.toLocaleString()} input · ${usage.outputTokens.toLocaleString()} output tokens`}
            >
              {formatTokens(usage)} tok
            </span>
          )}
        </div>
        <button
          onClick={startNewChat}
          className="h-8 shrink-0 rounded-lg border border-ink-line px-3 text-xs transition hover:bg-ink-raised"
        >
          New chat
        </button>
      </div>

      <div className="flex flex-1 justify-center px-4 pt-5 lg:px-8 lg:pt-8">
        <div className="flex w-full max-w-[720px] flex-col gap-7 pb-6">
          {messages.map((message, idx) => (
            <ChatMessage
              key={message.id}
              message={message}
              isStreaming={isLoading && idx === messages.length - 1 && message.role === "assistant"}
              onApproval={!isLoading && idx === messages.length - 1 ? addToolApprovalResponse : undefined}
              eventsBefore={eventsBefore}
              athleteId={athleteId}
            />
          ))}

          {awaitingReply && (
            <div className="flex flex-col gap-3">
              <CoachLabel />
              <LiveStatus text="thinking…" />
            </div>
          )}

          {error && (
            <div role="alert" className="flex flex-col gap-1 rounded-xl border border-signal-warn/40 px-4 py-3 text-sm">
              <span className="font-medium text-signal-warn">The coach couldn’t answer</span>
              <span className="break-words text-fg-subtle">{error.message}</span>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 flex justify-center bg-ink px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-6">
        {!atBottom && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute -top-11 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-ink-edge bg-ink-surface px-3.5 font-mono text-xs text-fg shadow-lg transition hover:bg-ink-raised"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            latest
          </button>
        )}
        <div className="flex w-full max-w-[720px] flex-col gap-2">
          {composer}
          <span className="hidden text-center text-[11px] text-fg-muted lg:block">
            Enter to send · Shift + Enter for a new line · the coach reads your Intervals.icu data live
          </span>
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
        <span className="min-h-4 font-mono text-xs uppercase text-fg-muted">
          {now?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </span>
        <h1 className="text-3xl font-medium leading-tight tracking-tight lg:text-[40px]">
          {now ? greeting(now.getHours()) : "Hello"}
          {firstname ? `, ${firstname}` : ""}.
        </h1>
        {fitness?.tsb != null && (
          <p className="text-base leading-relaxed text-fg-subtle">
            Form is <span className="font-mono text-fg">{formatSigned(fitness.tsb)}</span>,{" "}
            <span className={warn ? "text-signal-warn" : "text-signal"}>
              {FORM_LABELS[fitness.form_status].toLowerCase()}
            </span>
            .{" "}
            {today &&
              (todays.length > 0
                ? `Today’s plan: ${todays.map((e) => e.name).join(" + ")}${
                    todays[0].movingTime
                      ? ` (${formatDuration(todays.reduce((s, e) => s + (e.movingTime ?? 0), 0))})`
                      : ""
                  }.`
                : "Nothing planned today.")}
          </p>
        )}
        {race && (
          <p className="text-base leading-relaxed text-fg-subtle">
            {race.priority === "A" ? "Goal race" : `Next race (${race.priority})`}:{" "}
            <span className="text-fg">{race.name}</span>,{" "}
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
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-ink-line bg-ink-line">
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
    <div className="flex flex-col gap-1 bg-ink-rail px-4 py-3.5">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span className={`font-display text-[32px] font-semibold leading-none ${className}`}>{value}</span>
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-2.5 rounded-2xl border border-ink-edge bg-ink-surface p-3 pl-4 transition focus-within:border-fg-muted"
    >
      <label htmlFor="coach-message" className="sr-only">
        Message your coach
      </label>
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          id="coach-message"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // On touch keyboards Enter adds a line; the send button sends.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isTouch()) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Ask about your form, a ride, or next week…"
          rows={1}
          className={`${large ? "min-h-14 lg:min-h-[76px]" : "min-h-8 lg:min-h-[53px]"} max-h-[40dvh] flex-1 resize-none bg-transparent py-1 text-base leading-normal text-fg placeholder:text-fg-muted focus:outline-none lg:max-h-40 lg:text-[15px]`}
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
                className="h-9 shrink-0 rounded-full border border-ink-line px-2.5 text-xs text-fg-subtle transition hover:border-ink-edge hover:text-fg disabled:opacity-40 lg:h-[30px]"
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

function isTouch() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function SendButton({ isLoading, canSend, onStop }: { isLoading: boolean; canSend: boolean; onStop: () => void }) {
  if (isLoading) {
    return (
      <button
        type="button"
        onClick={onStop}
        aria-label="Stop answering"
        title="Stop answering"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink-edge bg-ink-raised text-fg transition hover:bg-ink-line"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>
    );
  }
  return (
    <button
      type="submit"
      disabled={!canSend}
      aria-label="Send"
      title="Send"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-signal text-on-signal transition hover:brightness-95 disabled:opacity-30"
    >
      <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
    </button>
  );
}
