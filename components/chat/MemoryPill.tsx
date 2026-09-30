"use client";

import React, { useState } from "react";
import { AlertTriangle, BookmarkMinus, BookmarkPlus, NotebookPen } from "lucide-react";
import { FORGET_TOOL, REMEMBER_TOOL } from "@/lib/intervals/tool-names";

interface MemoryPillProps {
  toolName: string;
  input?: { text?: string; category?: string; phase?: string; focus?: string };
  output?: unknown;
  errorText?: string;
  athleteId: string;
}

function field(output: unknown, key: string): string | undefined {
  const value = output && typeof output === "object" ? (output as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value : undefined;
}

export function MemoryPill({ toolName, input, output, errorText, athleteId }: MemoryPillProps) {
  const [forgotten, setForgotten] = useState(false);
  const [busy, setBusy] = useState(false);
  const error = errorText ?? field(output, "error");
  const factId = toolName === REMEMBER_TOOL ? field(output, "id") : undefined;

  let Icon = NotebookPen;
  let label = "Plan updated";
  let detail = [input?.phase, input?.focus].filter(Boolean).join(" · ");
  if (toolName === REMEMBER_TOOL) {
    Icon = BookmarkPlus;
    label = forgotten ? "Forgotten" : "Noted";
    detail = [input?.category, field(output, "text") ?? input?.text].filter(Boolean).join(" · ");
  } else if (toolName === FORGET_TOOL) {
    Icon = BookmarkMinus;
    label = "Forgot";
    detail = field(output, "removed") ?? "";
  }

  const forget = async () => {
    if (!factId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, factId }),
      });
      if (res.ok) setForgotten(true);
    } catch (e) {
      console.warn("Could not forget:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      className={`flex min-h-8 max-w-full items-center gap-2 self-start rounded-full border border-ink-line py-1 pl-2.5 pr-1 font-mono text-[11px] text-fg-subtle sm:min-h-7 ${
        forgotten ? "opacity-50" : ""
      }`}
    >
      {error ? (
        <AlertTriangle className="h-3 w-3 shrink-0 text-signal-warn" />
      ) : (
        <Icon className="h-3 w-3 shrink-0 text-signal" />
      )}
      <span className="min-w-0 truncate pr-1.5">
        {error ? `Couldn’t save to memory: ${error}` : [label, detail].filter(Boolean).join(" · ")}
      </span>
      {factId && !error && !forgotten && (
        <button
          type="button"
          onClick={forget}
          disabled={busy}
          className="h-8 shrink-0 rounded-full px-2.5 text-fg-muted transition hover:bg-ink-raised hover:text-fg disabled:opacity-40 sm:h-6"
        >
          Forget
        </button>
      )}
    </div>
  );
}
