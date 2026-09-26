"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import {
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  DEFAULT_THINKING_LEVEL,
  GOOGLE_MODELS,
  THINKING_LEVELS,
  resolveThinkingLevel,
  supportsThinkingLevel,
  type ModelProvider,
  type ThinkingLevel,
} from "@/lib/llm/models";
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

const CUSTOM_MODEL = "__custom__";

const THINKING_LABELS: Record<ThinkingLevel, { label: string; sub: string }> = {
  minimal: { label: "Minimal", sub: "Cheapest" },
  low: { label: "Low", sub: "Quick" },
  medium: { label: "Medium", sub: "Balanced" },
  high: { label: "High", sub: "Deepest" },
};

const isListedGoogleModel = (id: string) => GOOGLE_MODELS.some((m) => m.id === id);

export function SettingsModal({ isOpen, onClose, onSettingsChanged }: SettingsModalProps) {
  const [provider, setProvider] = useState<ModelProvider>(DEFAULT_PROVIDER);
  const [modelName, setModelName] = useState(DEFAULT_MODELS[DEFAULT_PROVIDER]);
  // Google models come from a dropdown; "custom" reveals a text field for IDs not in GOOGLE_MODELS.
  const [customModel, setCustomModel] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(DEFAULT_THINKING_LEVEL);
  const [geminiKey, setGeminiKey] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [intervalsApiKey, setIntervalsApiKey] = useState("");
  const [hevyApiKey, setHevyApiKey] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedProvider = (localStorage.getItem("apex_model_provider") as ModelProvider) || DEFAULT_PROVIDER;
      setProvider(storedProvider);
      const storedModel = localStorage.getItem("apex_model_name") || DEFAULT_MODELS[storedProvider];
      setModelName(storedModel);
      setCustomModel(storedProvider === "google" && !isListedGoogleModel(storedModel));
      const storedLevel = localStorage.getItem("apex_thinking_level") as ThinkingLevel | null;
      setThinkingLevel(
        resolveThinkingLevel(
          storedModel,
          storedLevel && THINKING_LEVELS.includes(storedLevel) ? storedLevel : DEFAULT_THINKING_LEVEL
        )
      );
      setGeminiKey(localStorage.getItem("apex_gemini_key") || "");
      setOpenAiKey(localStorage.getItem("apex_openai_key") || "");
      setAnthropicKey(localStorage.getItem("apex_anthropic_key") || "");
      setAthleteId(localStorage.getItem("apex_athlete_id") || "");
      setIntervalsApiKey(localStorage.getItem("apex_intervals_key") || "");
      setHevyApiKey(localStorage.getItem("apex_hevy_key") || "");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem("apex_model_provider", provider);
    localStorage.setItem("apex_model_name", modelName);
    localStorage.setItem("apex_thinking_level", thinkingLevel);
    localStorage.setItem("apex_gemini_key", geminiKey);
    localStorage.setItem("apex_openai_key", openAiKey);
    localStorage.setItem("apex_anthropic_key", anthropicKey);
    localStorage.setItem("apex_athlete_id", athleteId.trim());
    localStorage.setItem("apex_intervals_key", intervalsApiKey);
    localStorage.setItem("apex_hevy_key", hevyApiKey);

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
  const showThinking = provider === "google" && supportsThinkingLevel(modelName);
  const thinkingOptions = GOOGLE_MODELS.find((m) => m.id === modelName)?.thinkingLevels ?? THINKING_LEVELS;

  const selectModel = (id: string) => {
    setModelName(id);
    // Keep the chosen effort if the new model accepts it, else move to its closest level.
    setThinkingLevel((level) => resolveThinkingLevel(id, level));
  };

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
                  selectModel(DEFAULT_MODELS[p.id]);
                  setCustomModel(false);
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
        {provider === "google" && (
          <div className="relative">
            <select
              id={customModel ? "model-select" : "model-name"}
              aria-label="Model"
              value={customModel ? CUSTOM_MODEL : modelName}
              onChange={(e) => {
                if (e.target.value === CUSTOM_MODEL) {
                  setCustomModel(true);
                  setModelName("");
                } else {
                  setCustomModel(false);
                  selectModel(e.target.value);
                }
              }}
              className={`${inputClass} appearance-none pr-10 cursor-pointer`}
            >
              {GOOGLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.note}
                </option>
              ))}
              <option value={CUSTOM_MODEL}>Custom model ID…</option>
            </select>
            <ChevronDown
              size={16}
              aria-hidden
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-muted"
            />
          </div>
        )}
        {(provider !== "google" || customModel) && (
          <input
            id="model-name"
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder={`e.g. ${DEFAULT_MODELS[provider]}`}
            className={`${inputClass} font-mono`}
          />
        )}
      </ModalSection>

      {showThinking && (
        <ModalSection
          label="Thinking effort"
          hint="Higher effort reasons longer before answering. Thinking tokens are billed as output, so it costs more and replies take longer."
        >
          <div role="radiogroup" aria-label="Thinking effort" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {THINKING_LEVELS.map((level) => {
              const available = thinkingOptions.includes(level);
              const selected = thinkingLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!available}
                  title={available ? undefined : "Not supported by this model"}
                  onClick={() => setThinkingLevel(level)}
                  className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-[10px] border text-left transition disabled:opacity-40 disabled:cursor-not-allowed ${
                    selected
                      ? "border-fg-muted bg-ink-raised"
                      : "border-ink-line enabled:hover:border-ink-edge enabled:hover:bg-ink-surface"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-signal" />}
                    {THINKING_LABELS[level].label}
                  </span>
                  <span className="text-[11px] text-fg-muted">{THINKING_LABELS[level].sub}</span>
                </button>
              );
            })}
          </div>
        </ModalSection>
      )}

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
          placeholder="e.g. i123456 (blank: INTERVALS_ICU_ATHLETE_ID)"
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

      <ModalSection
        label="Hevy API key (optional)"
        htmlFor="hevy-key"
        hint={
          <>
            With a key, gym sessions the coach schedules also land in Hevy as routines, and it sets weights from your
            past lifts. Needs Hevy Pro; find it at{" "}
            <a
              href="https://hevy.com/settings?developer"
              target="_blank"
              rel="noreferrer"
              className="text-fg-subtle underline underline-offset-2 hover:text-fg"
            >
              hevy.com/settings
            </a>
            . Leave blank to use <code className="font-mono text-fg-subtle">HEVY_API_KEY</code> from .env.local.
          </>
        }
      >
        <input
          id="hevy-key"
          type="password"
          autoComplete="off"
          value={hevyApiKey}
          onChange={(e) => setHevyApiKey(e.target.value)}
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
