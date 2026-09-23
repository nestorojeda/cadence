"use client";

import React, { useState, useEffect } from "react";
import { X, Key, Cpu, ShieldCheck } from "lucide-react";
import { DEFAULT_MODELS, DEFAULT_PROVIDER, type ModelProvider } from "@/lib/llm/models";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged?: () => void;
}

export function SettingsModal({ isOpen, onClose, onSettingsChanged }: SettingsModalProps) {
  const [provider, setProvider] = useState<ModelProvider>(DEFAULT_PROVIDER);
  const [modelName, setModelName] = useState(DEFAULT_MODELS[DEFAULT_PROVIDER]);
  const [geminiKey, setGeminiKey] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [athleteId, setAthleteId] = useState("i435091");
  const [intervalsApiKey, setIntervalsApiKey] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setProvider((localStorage.getItem("apex_model_provider") as any) || "google");
      setModelName(localStorage.getItem("apex_model_name") || DEFAULT_MODELS[DEFAULT_PROVIDER]);
      setGeminiKey(localStorage.getItem("apex_gemini_key") || "");
      setOpenAiKey(localStorage.getItem("apex_openai_key") || "");
      setAnthropicKey(localStorage.getItem("apex_anthropic_key") || "");
      setAthleteId(localStorage.getItem("apex_athlete_id") || "i435091");
      setIntervalsApiKey(localStorage.getItem("apex_intervals_key") || "");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem("apex_model_provider", provider);
    localStorage.setItem("apex_model_name", modelName);
    localStorage.setItem("apex_gemini_key", geminiKey);
    localStorage.setItem("apex_openai_key", openAiKey);
    localStorage.setItem("apex_anthropic_key", anthropicKey);
    localStorage.setItem("apex_athlete_id", athleteId);
    localStorage.setItem("apex_intervals_key", intervalsApiKey);

    setSavedSuccess(true);
    if (onSettingsChanged) onSettingsChanged();
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            AI & Intervals.icu Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="px-6 py-5 space-y-5 text-sm text-slate-300">
          {/* AI Provider */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              AI Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "google", label: "Google Gemini" },
                { id: "openai", label: "OpenAI" },
                { id: "anthropic", label: "Anthropic" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProvider(p.id as any);
                    setModelName(DEFAULT_MODELS[p.id as ModelProvider]);
                  }}
                  className={`p-2.5 rounded-xl border text-xs text-center font-medium transition ${
                    provider === p.id
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-300 font-bold"
                      : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Model Name
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={`e.g. ${DEFAULT_MODELS[provider]}`}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* API Key */}
          {provider === "google" && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Google Gemini API Key
                </label>
              </div>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Leave blank to use GEMINI_API_KEY from .env.local"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {provider === "openai" && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  OpenAI API Key
                </label>
              </div>
              <input
                type="password"
                value={openAiKey}
                onChange={(e) => setOpenAiKey(e.target.value)}
                placeholder="Leave blank to use OPENAI_API_KEY from .env.local"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {provider === "anthropic" && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Anthropic API Key
                </label>
              </div>
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="Leave blank to use ANTHROPIC_API_KEY from .env.local"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {/* Intervals.icu Settings */}
          <div className="border-t border-slate-800 pt-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Intervals.icu Athlete ID
            </label>
            <input
              type="text"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              placeholder="e.g. i435091"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          {savedSuccess ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              Settings saved!
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-lg shadow-cyan-500/20"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
