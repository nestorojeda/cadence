"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { RemovedEventCard, WorkoutCard, type WorkoutCardStatus, type WorkoutEventInput } from "./WorkoutCard";
import { GymCard } from "./GymCard";
import { MemoryPill } from "./MemoryPill";
import { RulesCard } from "./RulesCard";
import type { ProposeRulesResult } from "@/lib/coach/rules";
import type { GymSessionResult } from "@/lib/coach/gym";
import { CadenceMark } from "@/components/CadenceMark";
import type { KnownEvent } from "@/lib/chat/known-events";
import {
  CREATE_EVENT_TOOL,
  CREATE_GYM_TOOL,
  DELETE_EVENT_TOOL,
  MEMORY_TOOL_NAMES,
  PROPOSE_RULES_TOOL,
  UPDATE_EVENT_TOOL,
} from "@/lib/intervals/tool-names";

interface ChatMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
  onApproval?: (response: { id: string; approved: boolean; reason?: string }) => void;
  eventsBefore?: Map<string, KnownEvent>;
  athleteId: string;
}

type ToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;

const TOOL_LABELS: Record<string, string> = {
  icu_get_fitness_summary: "fitness",
  icu_get_wellness_data: "wellness",
  icu_get_recent_activities: "recent rides",
  icu_get_activity_details: "ride details",
  icu_get_calendar_events: "calendar",
  hevy_search_exercises: "exercises",
  hevy_get_recent_workouts: "gym workouts",
  hevy_get_exercise_history: "lift history",
};

const CARD_TOOLS = new Set([
  CREATE_EVENT_TOOL,
  CREATE_GYM_TOOL,
  UPDATE_EVENT_TOOL,
  DELETE_EVENT_TOOL,
  PROPOSE_RULES_TOOL,
]);
const MEMORY_TOOLS = new Set(MEMORY_TOOL_NAMES);

function toolLabel(name: string) {
  return TOOL_LABELS[name] ?? name.replace(/^icu_(get_)?/, "").replace(/_/g, " ");
}

function isRunning(part: ToolPart) {
  return part.state === "input-streaming" || part.state === "input-available";
}

function hasFailed(part: ToolPart) {
  return toolErrorText(part) !== undefined;
}

function toolErrorText(part: ToolPart) {
  if (part.state === "output-error") return part.errorText;
  const output = part.state === "output-available" ? part.output : undefined;
  return output && typeof output === "object" && "error" in output ? String(output.error) : undefined;
}

function workoutStatus(part: ToolPart): WorkoutCardStatus {
  if (toolErrorText(part) !== undefined) return "failed";
  switch (part.state) {
    case "approval-requested":
      return "pending";
    case "approval-responded":
      return part.approval.approved ? "adding" : "declined";
    case "output-denied":
      return "declined";
    case "output-available":
      return "added";
    default:
      return "adding";
  }
}

export function CoachLabel({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-2.5">
      <span className="text-[13px] font-semibold text-fg">Coach</span>
      {children}
    </div>
  );
}

export function LiveStatus({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-fg" role="status">
      <CadenceMark size={14} spinning />
      <span>{text}</span>
    </div>
  );
}

export function ChatMessage({ message, isStreaming = false, onApproval, eventsBefore, athleteId }: ChatMessageProps) {
  if (message.role === "user") {
    const text = message.parts
      .filter(isTextUIPart)
      .map((part) => part.text)
      .join("\n\n");
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[14px] rounded-br-[4px] bg-ink-raised px-4 py-3 text-[15px] leading-normal lg:max-w-[520px]">
          {text}
        </div>
      </div>
    );
  }

  const toolParts = message.parts.filter(isToolUIPart) as ToolPart[];
  const readParts = toolParts.filter((p) => !CARD_TOOLS.has(getToolName(p)) && !MEMORY_TOOLS.has(getToolName(p)));
  const running = toolParts.find(isRunning);
  const pending = toolParts.filter((p) => p.state === "approval-requested");
  const lastPendingId = pending[pending.length - 1]?.toolCallId;
  const onlyAdds = pending.every((p) => getToolName(p) === CREATE_EVENT_TOOL || getToolName(p) === CREATE_GYM_TOOL);
  const answerAll = (approved: boolean) => {
    for (const part of pending) if (part.approval) onApproval?.({ id: part.approval.id, approved });
  };
  const hasText = message.parts.some((p) => isTextUIPart(p) && p.text.trim());
  const endedSilently = !isStreaming && !hasText && !toolParts.some((p) => CARD_TOOLS.has(getToolName(p)));

  let liveText: string | null = null;
  if (isStreaming && running) {
    const name = getToolName(running);
    liveText = MEMORY_TOOLS.has(name)
      ? "taking notes…"
      : name === PROPOSE_RULES_TOOL
        ? "drafting a rules change…"
        : CARD_TOOLS.has(name)
          ? "updating your calendar…"
          : `reading ${toolLabel(name)}…`;
  } else if (isStreaming && !hasText) {
    liveText = "thinking…";
  }

  return (
    <div className="flex flex-col gap-4">
      <CoachLabel>{readParts.some((p) => !isRunning(p)) && <ToolTrace parts={readParts} />}</CoachLabel>

      {liveText && <LiveStatus text={liveText} />}

      {message.parts.map((part, idx) => {
        if (isTextUIPart(part)) {
          if (!part.text.trim()) return null;
          return (
            <div key={idx} className="coach-md break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
            </div>
          );
        }
        if (isToolUIPart(part) && MEMORY_TOOLS.has(getToolName(part))) {
          if (part.state !== "output-available" && part.state !== "output-error") return null;
          return (
            <MemoryPill
              key={part.toolCallId}
              toolName={getToolName(part)}
              input={part.input as React.ComponentProps<typeof MemoryPill>["input"]}
              output={part.state === "output-available" ? part.output : undefined}
              errorText={part.state === "output-error" ? part.errorText : undefined}
              athleteId={athleteId}
            />
          );
        }
        if (isToolUIPart(part) && CARD_TOOLS.has(getToolName(part))) {
          const toolPart = part;
          const approvalId = toolPart.state === "approval-requested" ? toolPart.approval.id : undefined;
          const onDecide =
            approvalId && onApproval ? (approved: boolean) => onApproval({ id: approvalId, approved }) : undefined;
          const toolName = getToolName(toolPart);
          const eventId = (toolPart.input as { event_id?: string } | undefined)?.event_id;
          const before = eventsBefore?.get(toolPart.toolCallId) as Partial<WorkoutEventInput> | undefined;
          return (
            <React.Fragment key={toolPart.toolCallId}>
              {toolName === PROPOSE_RULES_TOOL ? (
                <RulesCard
                  input={toolPart.input ?? {}}
                  status={workoutStatus(toolPart)}
                  output={toolPart.state === "output-available" ? (toolPart.output as ProposeRulesResult) : undefined}
                  errorText={toolErrorText(toolPart)}
                  onDecide={onDecide}
                  athleteId={athleteId}
                />
              ) : toolName === DELETE_EVENT_TOOL ? (
                <RemovedEventCard
                  event={before}
                  eventId={eventId}
                  status={workoutStatus(toolPart)}
                  errorText={toolErrorText(toolPart)}
                  onDecide={onDecide}
                />
              ) : toolName === CREATE_GYM_TOOL ? (
                <GymCard
                  input={toolPart.input ?? {}}
                  status={workoutStatus(toolPart)}
                  output={toolPart.state === "output-available" ? (toolPart.output as GymSessionResult) : undefined}
                  errorText={toolErrorText(toolPart)}
                  onDecide={onDecide}
                />
              ) : (
                <WorkoutCard
                  input={toolPart.input ?? {}}
                  previous={toolName === UPDATE_EVENT_TOOL ? before : undefined}
                  eventId={toolName === UPDATE_EVENT_TOOL ? eventId : undefined}
                  kind={toolName === UPDATE_EVENT_TOOL ? "update" : "create"}
                  status={workoutStatus(toolPart)}
                  errorText={toolErrorText(toolPart)}
                  onDecide={onDecide}
                />
              )}
              {pending.length > 1 && toolPart.toolCallId === lastPendingId && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <span className="font-mono text-xs text-fg-muted">
                    {pending.length} {onlyAdds ? "sessions" : "changes"} to review
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!onApproval}
                      onClick={() => answerAll(false)}
                      className="h-10 rounded-lg border border-ink-edge px-4 text-xs text-fg transition hover:bg-ink-raised disabled:opacity-40 sm:h-8 sm:px-3"
                    >
                      Skip all
                    </button>
                    <button
                      type="button"
                      disabled={!onApproval}
                      onClick={() => answerAll(true)}
                      className="h-10 rounded-lg bg-signal px-4 text-xs font-semibold text-on-signal transition hover:brightness-95 disabled:opacity-40 sm:h-8 sm:px-3"
                    >
                      {onlyAdds ? "Add" : "Approve"} all {pending.length}
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        }
        return null;
      })}

      {endedSilently && (
        <div className="flex items-start gap-2 text-xs text-fg-subtle" role="status">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-signal-warn" />
          <span>The coach stopped before replying. Ask it to continue, or rephrase the request.</span>
        </div>
      )}
    </div>
  );
}

function ToolTrace({ parts }: { parts: ToolPart[] }) {
  const [open, setOpen] = useState(false);
  const finished = parts.filter((p) => !isRunning(p));
  const failed = finished.filter(hasFailed);
  const labels = Array.from(new Set(finished.filter((p) => !hasFailed(p)).map((p) => toolLabel(getToolName(p)))));

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-8 max-w-full items-center gap-2 rounded-full border border-ink-line px-2.5 font-mono text-[11px] text-fg-subtle transition hover:border-ink-edge hover:text-fg sm:h-7"
      >
        {failed.length > 0 ? (
          <AlertTriangle className="h-3 w-3 shrink-0 text-signal-warn" />
        ) : (
          <Check className="h-3 w-3 shrink-0 text-signal" strokeWidth={2.5} />
        )}
        <span className="truncate">
          {labels.length > 0 && `read ${labels.join(" · ")}`}
          {labels.length > 0 && failed.length > 0 && " · "}
          {failed.length > 0 && `${failed.length} failed`}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="basis-full overflow-hidden rounded-[10px] border border-ink-line font-mono text-xs">
          {parts.map((part, i) => (
            <details key={part.toolCallId} className={`group ${i > 0 ? "border-t border-ink-hair" : ""}`}>
              <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_56px] items-center gap-x-3 gap-y-0.5 px-3.5 py-2 hover:bg-ink-rail sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_56px]">
                <span className="truncate text-fg">{getToolName(part)}</span>
                <span className="col-span-2 row-start-2 truncate text-fg-muted sm:col-span-1 sm:row-start-auto">
                  {part.input != null ? JSON.stringify(part.input) : ""}
                </span>
                <span
                  className={`col-start-2 row-start-1 text-right sm:col-start-auto sm:row-start-auto ${hasFailed(part) ? "text-signal-warn" : "text-fg-muted"}`}
                >
                  {isRunning(part) ? "…" : hasFailed(part) ? "failed" : "ok"}
                </span>
              </summary>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all px-3.5 pb-3 pt-1 text-[11px] leading-relaxed text-fg-muted">
                {part.state === "output-error"
                  ? part.errorText
                  : part.state === "output-available"
                    ? JSON.stringify(part.output, null, 2)
                    : "Waiting for result…"}
              </pre>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
