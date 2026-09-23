"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Zap, ChevronDown, ChevronRight, CheckCircle2, Loader2, Wrench, XCircle } from "lucide-react";
import { getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";

interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [toolsExpanded, setToolsExpanded] = useState(false);

  const toolParts = message.parts.filter(isToolUIPart);
  const text = message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("\n\n");

  return (
    <div
      className={`py-4 px-4 md:px-6 rounded-2xl flex gap-3.5 transition ${
        isUser
          ? "bg-slate-900/60 border border-slate-800/80 ml-8 md:ml-16"
          : "bg-slate-900/30 border border-slate-800/40 mr-4 md:mr-12"
      }`}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20">
            <Zap className="w-4 h-4 fill-current" />
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Name and Timestamp */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">
            {isUser ? "You" : "Coach"}
          </span>
        </div>

        {/* Tool Invocations Accordion */}
        {toolParts.length > 0 && (
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl overflow-hidden text-xs">
            <button
              onClick={() => setToolsExpanded(!toolsExpanded)}
              className="w-full px-3 py-2 flex items-center justify-between text-slate-400 hover:text-slate-200 transition bg-slate-950/40"
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-slate-300">
                  {toolParts.length} Intervals.icu Tool Call
                  {toolParts.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>{toolsExpanded ? "Hide" : "Show"} Details</span>
                {toolsExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {toolsExpanded && (
              <div className="p-3 border-t border-slate-800/80 space-y-2 bg-slate-950/80 font-mono text-[11px]">
                {toolParts.map((part) => {
                  const isDone = part.state === "output-available";
                  const isFailed = part.state === "output-error";
                  return (
                    <div
                      key={part.toolCallId}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-bold">
                          {getToolName(part)}
                        </span>
                        <div className="flex items-center gap-1">
                          {isFailed ? (
                            <span className="flex items-center gap-1 text-red-400 text-[10px]">
                              <XCircle className="w-3 h-3" /> Failed
                            </span>
                          ) : isDone ? (
                            <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> Done
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-cyan-400 text-[10px]">
                              <Loader2 className="w-3 h-3 animate-spin" /> Querying...
                            </span>
                          )}
                        </div>
                      </div>

                      {part.input != null && (
                        <div className="text-slate-400 text-[10px]">
                          Args: {JSON.stringify(part.input)}
                        </div>
                      )}

                      {isDone && part.output != null && (
                        <div className="text-slate-400 text-[10px] max-h-32 overflow-y-auto mt-1 p-1.5 rounded bg-black/40">
                          Result: {JSON.stringify(part.output, null, 2)}
                        </div>
                      )}

                      {isFailed && (
                        <div className="text-red-300 text-[10px] mt-1">Error: {part.errorText}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Text Body */}
        {text && (
          <div className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {text}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
