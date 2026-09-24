"use client";

import React, { useState, useEffect } from "react";
import { DEFAULT_MODELS, DEFAULT_PROVIDER, type ModelProvider } from "@/lib/llm/models";
import { GhostButton, Modal, ModalSection, PrimaryButton, SavedNote, inputClass } from "@/components/ui/Modal";
import { ThemeToggle } from "@/components/ThemeToggle";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged?: () => void;
}

const PROVIDERS: Array<{ id: ModelProvider; label: string; sub: string; envVar?: string }> = [
  { id: "google", label: "Google", sub: "Gemini", envVar: "GEMINI_API_KEY" },
  { id: "openai", label: "OpenAI", sub: "GPT", envVar: "OPENAI_API_KEY" },
  { id: "anthropic", label: "Anthropic", sub: "Claude", envVar: "ANTHROPIC_API_KEY" },
  { id: "ollama", label: "Ollama", sub: "Local" },
];

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
      const storedProvider = (localStorage.getItem("apex_model_provider") as ModelProvider) || DEFAULT_PROVIDER;
      setProvider(storedProvider);
      setModelName(localStorage.getItem("apex_model_name") || DEFAULT_MODELS[storedProvider]);
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

  const keyField: Partial<Record<ModelProvider, { value: string; set: (v: string) => void }>> = {
    google: { value: geminiKey, set: setGeminiKey },
    openai: { value: openAiKey, set: setOpenAiKey },
    anthropic: { value: anthropicKey, set: setAnthropicKey },
  };
  const activeProvider = PROVIDERS.find((p) => p.id === provider)!;
  const activeKey = keyField[provider];

  return (
    <Modal
      title="Settings"
      description="Stored in this browser only and sent with each chat request."
      onClose={onClose}
      footer={
        <>
          <SavedNote show={savedSuccess}>Saved</SavedNote>
          <div className="flex items-center gap-3">
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton onClick={handleSave}>Save changes</PrimaryButton>
          </div>
        </>
      }
    >
      <ModalSection label="Model provider">
        <div role="radiogroup" aria-label="Model provider" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PROVIDERS.map((p) => {
            const selected = provider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setProvider(p.id);
                  setModelName(DEFAULT_MODELS[p.id]);
                }}
                className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-[10px] border text-left transition ${
                  selected ? "border-fg-muted bg-ink-raised" : "border-ink-line hover:border-ink-edge hover:bg-ink-surface"
                }`}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  {selected && <span className="w-1.5 h-1.5 rounded-full bg-signal" />}
                  {p.label}
                </span>
                <span className="text-[11px] text-fg-muted">{p.sub}</span>
              </button>
            );
          })}
        </div>
      </ModalSection>

      <ModalSection label="Model" htmlFor="model-name">
        <input
          id="model-name"
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder={`e.g. ${DEFAULT_MODELS[provider]}`}
          className={`${inputClass} font-mono`}
        />
      </ModalSection>

      {activeKey && (
        <ModalSection
          label={`${activeProvider.label} API key`}
          htmlFor="provider-key"
          hint={
            <>
              Leave blank to use <code className="font-mono text-fg-subtle">{activeProvider.envVar}</code> from
              .env.local.
            </>
          }
        >
          <input
            id="provider-key"
            type="password"
            autoComplete="off"
            value={activeKey.value}
            onChange={(e) => activeKey.set(e.target.value)}
            placeholder="Not set"
            className={`${inputClass} font-mono`}
          />
        </ModalSection>
      )}

      {provider === "ollama" && (
        <p className="text-xs leading-relaxed text-fg-subtle border border-ink-line rounded-[10px] px-3.5 py-3">
          Runs against your local Ollama server (<code className="font-mono text-fg">OLLAMA_BASE_URL</code> in
          .env.local, default <code className="font-mono text-fg">http://localhost:11434/v1</code>). No API key needed.
          Pull the model first with{" "}
          <code className="font-mono text-fg">ollama pull {modelName || DEFAULT_MODELS.ollama}</code>; the coach needs
          a tool-capable model such as qwen3.
        </p>
      )}

      <div className="border-t border-ink-hair" />

      <ModalSection label="Intervals.icu athlete ID" htmlFor="athlete-id">
        <input
          id="athlete-id"
          type="text"
          value={athleteId}
          onChange={(e) => setAthleteId(e.target.value)}
          placeholder="e.g. i435091"
          className={`${inputClass} font-mono`}
        />
      </ModalSection>

      <ModalSection
        label="Intervals.icu API key"
        htmlFor="intervals-key"
        hint={
          <>
            Find it in Intervals.icu under Settings → Developer Settings. Leave blank to use{" "}
            <code className="font-mono text-fg-subtle">INTERVALS_ICU_API_KEY</code> from .env.local.
          </>
        }
      >
        <input
          id="intervals-key"
          type="password"
          autoComplete="off"
          value={intervalsApiKey}
          onChange={(e) => setIntervalsApiKey(e.target.value)}
          placeholder="Not set"
          className={`${inputClass} font-mono`}
        />
      </ModalSection>

      <div className="border-t border-ink-hair" />

      <ModalSection label="Appearance" hint="Applies immediately. System follows your device.">
        <ThemeToggle size="md" />
      </ModalSection>
    </Modal>
  );
}
