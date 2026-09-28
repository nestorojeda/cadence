"use client";

import React, { useCallback, useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { DARK_QUERY, THEME_PREFERENCES, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const MODES: Record<ThemePreference, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
  system: { label: "System", icon: Monitor },
};

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);

  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private window): the choice still applies for this page view.
    }
    applyTheme(next);
    listeners.forEach((l) => l());
  }, []);

  return { preference, setPreference };
}

export function ThemeToggle({ size = "sm" }: { size?: "sm" | "md" }) {
  const { preference, setPreference } = useTheme();
  return (
    <div role="group" aria-label="Color mode" className="flex gap-0.5 rounded-[10px] border border-ink-line p-[3px]">
      {THEME_PREFERENCES.map((mode) => {
        const { label, icon: Icon } = MODES[mode];
        const selected = preference === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={selected}
            onClick={() => setPreference(mode)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[7px] transition ${
              size === "md" ? "h-9 text-[13px]" : "h-8 text-xs"
            } ${selected ? "bg-ink-raised text-fg" : "text-fg-muted hover:text-fg"}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeCycleButton() {
  const { preference, setPreference } = useTheme();
  const next = THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(preference) + 1) % THEME_PREFERENCES.length];
  const { label, icon: Icon } = MODES[preference];
  const title = `Color mode: ${label}. Switch to ${MODES[next].label}`;
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={title}
      title={title}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted transition hover:bg-ink-raised hover:text-fg"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
