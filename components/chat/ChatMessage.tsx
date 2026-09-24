"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { WorkoutCard, type WorkoutCardStatus, type WorkoutEventInput } from "./WorkoutCard";
import { CadenceMark } from "@/components/CadenceMark";
import { CREATE_EVENT_TOOL } from "@/lib/intervals/tool-names";

interface ChatMessageProps {
  message: UIMessage;
  /** True while this (last, assistant) message is still being streamed. */
  isStreaming?: boolean;
  /** Answers a pending calendar change; only given while the athlete can still decide (last message, idle). */
  onApproval?: (response: { id: string; approved: boolean; reason?: string }) => void;
}

type ToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;

const TOOL_LABELS: Record<string, string> = {
  icu_get_fitness_summary: "fitness",
  icu_get_wellness_data: "wellness",
  icu_get_recent_activities: "recent rides",
  icu_get_activity_details: "ride details",
  icu_get_calendar_events: "calendar",
};

function toolLabel(name: string) {
  return TOOL_LABELS[name] ?? name.replace(/^icu_(get_)?/, "").replace(/_/g, " ");
}

function isRunning(part: ToolPart) {
  return part.state === "input-streaming" || part.state === "input-available";
}

function hasFailed(part: ToolPart) {
  // Our tools report failures as `{ error }` outputs so the model can recover.
  return toolErrorText(part) !== undefined;
}

/** Error reported by a finished tool call, either thrown or returned as `{ error }`. */
function toolErrorText(part: ToolPart) {
  if (part.state === "output-error") return part.errorText;
  const output = part.state === "output-available" ? part.output : undefined;
  return output && typeof output === "object" && "error" in output ? String((output as { error: unknown }).error) : undefined;
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
    <div className="flex items-center gap-2.5 flex-wrap min-h-7">
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

export function ChatMessage({ message, isStreaming = false, onApproval }: ChatMessageProps) {
  if (message.role === "user") {
    const text = message.parts
      .filter(isTextUIPart)
      .map((part) => part.text)
      .join("\n\n");
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] lg:max-w-[520px] px-4 py-3 bg-ink-raised rounded-[14px] rounded-br-[4px] text-[15px] leading-normal whitespace-pre-wrap break-words">
          {text}
        </div>
      </div>
    );
  }

  const toolParts = message.parts.filter(isToolUIPart) as ToolPart[];
  const readParts = toolParts.filter((p) => getToolName(p) !== CREATE_EVENT_TOOL);
  const running = toolParts.find(isRunning);
  const pending = toolParts.filter((p) => p.state === "approval-requested");
  const lastPendingId = pending[pending.length - 1]?.toolCallId;
  const answerAll = (approved: boolean) => {
    for (const part of pending) if (part.approval) onApproval?.({ id: part.approval.id, approved });
  };
  const hasText = message.parts.some((p) => isTextUIPart(p) && p.text.trim());

  let liveText: string | null = null;
  if (isStreaming && running) {
    const name = getToolName(running);
    liveText = name === CREATE_EVENT_TOOL ? "adding to your calendar…" : `reading ${toolLabel(name)}…`;
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
        if (isToolUIPart(part) && getToolName(part) === CREATE_EVENT_TOOL) {
          const toolPart = part as ToolPart;
          const approvalId = toolPart.state === "approval-requested" ? toolPart.approval.id : undefined;
          return (
            <React.Fragment key={toolPart.toolCallId}>
              <WorkoutCard
                input={(toolPart.input ?? {}) as Partial<WorkoutEventInput>}
                status={workoutStatus(toolPart)}
                errorText={toolErrorText(toolPart)}
                onDecide={
                  approvalId && onApproval ? (approved) => onApproval({ id: approvalId, approved }) : undefined
                }
              />
              {pending.length > 1 && toolPart.toolCallId === lastPendingId && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <span className="font-mono text-xs text-fg-muted">{pending.length} sessions to review</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!onApproval}
                      onClick={() => answerAll(false)}
                      className="h-8 px-3 rounded-lg border border-ink-edge text-xs text-fg hover:bg-ink-raised transition disabled:opacity-40"
                    >
                      Skip all
                    </button>
                    <button
                      type="button"
                      disabled={!onApproval}
                      onClick={() => answerAll(true)}
                      className="h-8 px-3 rounded-lg bg-signal text-on-signal text-xs font-semibold hover:brightness-95 transition disabled:opacity-40"
                    >
                      Add all {pending.length}
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        }
        return null;
      })}
    </div>
  );
}

/** One-line summary of the data the coach read, expandable into the individual calls. */
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
        className="flex items-center gap-2 h-7 px-2.5 border border-ink-line rounded-full font-mono text-[11px] text-fg-subtle hover:text-fg hover:border-ink-edge transition max-w-full"
      >
        {failed.length > 0 ? (
          <AlertTriangle className="w-3 h-3 shrink-0 text-signal-warn" />
        ) : (
          <Check className="w-3 h-3 shrink-0 text-signal" strokeWidth={2.5} />
        )}
        <span className="truncate">
          {labels.length > 0 && `read ${labels.join(" · ")}`}
          {labels.length > 0 && failed.length > 0 && " · "}
          {failed.length > 0 && `${failed.length} failed`}
        </span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="basis-full border border-ink-line rounded-[10px] overflow-hidden font-mono text-xs">
          {parts.map((part, i) => (
            <details key={part.toolCallId} className={`group ${i > 0 ? "border-t border-ink-hair" : ""}`}>
              <summary className="grid grid-cols-[minmax(0,200px)_minmax(0,1fr)_56px] gap-3 items-center px-3.5 py-2 cursor-pointer list-none hover:bg-ink-rail">
                <span className="truncate text-fg">{getToolName(part)}</span>
                <span className="truncate text-fg-muted">{part.input != null ? JSON.stringify(part.input) : ""}</span>
                <span className={`text-right ${hasFailed(part) ? "text-signal-warn" : "text-fg-muted"}`}>
                  {isRunning(part) ? "…" : hasFailed(part) ? "failed" : "ok"}
                </span>
              </summary>
              <pre className="px-3.5 pb-3 pt-1 max-h-48 overflow-auto text-[11px] leading-relaxed text-fg-muted whitespace-pre-wrap break-all">
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
