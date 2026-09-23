"use client";

import React, { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, Square, Loader2, Sparkles } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { QuickPrompts } from "./QuickPrompts";
import { DEFAULT_MODELS, DEFAULT_PROVIDER, type ModelProvider } from "@/lib/llm/models";

interface ChatInterfaceProps {
  athleteId: string;
}

const API_KEY_STORAGE: Record<ModelProvider, string> = {
  google: "apex_gemini_key",
  openai: "apex_openai_key",
  anthropic: "apex_anthropic_key",
};

/** Reads the model/API settings saved by SettingsModal, at request time so changes apply immediately. */
function getModelSettings() {
  const modelProvider = (localStorage.getItem("apex_model_provider") as ModelProvider) || DEFAULT_PROVIDER;
  return {
    modelProvider,
    modelName: localStorage.getItem("apex_model_name") || DEFAULT_MODELS[modelProvider],
    apiKey: localStorage.getItem(API_KEY_STORAGE[modelProvider]) || undefined,
    intervalsApiKey: localStorage.getItem("apex_intervals_key") || undefined,
  };
}

export function ChatInterface({ athleteId }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // The transport's body callback runs per request; keep athleteId in a ref so it's always current.
  const athleteIdRef = useRef(athleteId);
  athleteIdRef.current = athleteId;

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ athleteId: athleteIdRef.current, ...getModelSettings() }),
      })
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    transport,
    onError: (err) => {
      console.error("Chat stream error:", err);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  const submitInput = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput("");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleQuickPrompt = (promptText: string) => {
    sendMessage({ text: promptText });
  };

  return (
    <div className="flex flex-col flex-1 max-w-4xl w-full mx-auto px-4 py-4 min-h-[calc(100vh-68px)]">
      {/* Messages Scroll Area */}
      <div className="flex-1 space-y-4 pb-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="my-auto py-12 flex flex-col items-center justify-center text-center max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
              Ready to ride, Néstor.
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-2 leading-relaxed">
              I have live access to your Intervals.icu fitness metrics, power data, and training calendar. Ask me to assess your readiness or plan your week.
            </p>

            {/* Quick action chips */}
            <div className="w-full mt-6">
              <QuickPrompts onSelectPrompt={handleQuickPrompt} disabled={isLoading} />
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}

        {/* Loading / Typing Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-cyan-400 px-4 py-2 bg-cyan-950/20 border border-cyan-800/30 rounded-xl w-fit">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Analyzing Intervals.icu data & formulating training advice...</span>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300">
            <span className="font-bold">Error:</span> {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="sticky bottom-4 z-20 pt-2 bg-gradient-to-t from-[#0b0f17] via-[#0b0f17]/95 to-transparent">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitInput();
          }}
          className="relative flex items-center bg-slate-900 border border-slate-700/80 rounded-2xl p-1.5 shadow-2xl focus-within:border-emerald-500 transition"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitInput();
              }
            }}
            placeholder="Ask your cycling coach (e.g., 'Plan my workouts this week', 'How is my form?')..."
            rows={1}
            disabled={isLoading}
            className="w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none max-h-32"
          />

          <div className="flex items-center gap-1.5 shrink-0 pr-1">
            {isLoading ? (
              <button
                type="button"
                onClick={() => stop()}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Stop response"
              >
                <Square className="w-4 h-4 fill-current text-red-400" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 font-bold transition shadow-md shadow-emerald-500/20 disabled:opacity-30 disabled:pointer-events-none hover:opacity-90"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
