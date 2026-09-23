"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MobileBar, Sidebar } from "@/components/Sidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { CoachPreferencesModal } from "@/components/preferences/CoachPreferencesModal";
import { SettingsModal } from "@/components/SettingsModal";
import { DEFAULT_MODELS, DEFAULT_PROVIDER, type ModelProvider } from "@/lib/llm/models";
import type { MetricsResponse } from "@/lib/intervals/metrics";

function readModelLabel() {
  const provider = (localStorage.getItem("apex_model_provider") as ModelProvider) || DEFAULT_PROVIDER;
  const model = localStorage.getItem("apex_model_name") || DEFAULT_MODELS[provider];
  return `${provider} · ${model}`;
}

export default function Home() {
  const [athleteId, setAthleteId] = useState("i435091");
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modelLabel, setModelLabel] = useState("");
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  // Bumped when settings are saved so the metrics reload with a new key or athlete.
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [sidebarCompact, setSidebarCompact] = useState(false);

  const loadStoredSettings = () => {
    const storedId = localStorage.getItem("apex_athlete_id");
    if (storedId) {
      setAthleteId(storedId);
    }
    setModelLabel(readModelLabel());
  };

  // Compact sidebar is a per-browser preference; storage can be unavailable (private mode), so never let it throw.
  useEffect(() => {
    try {
      setSidebarCompact(localStorage.getItem("apex_sidebar_compact") === "true");
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setSidebarCompact((compact) => {
      try {
        localStorage.setItem("apex_sidebar_compact", String(!compact));
      } catch {}
      return !compact;
    });
  };

  useEffect(loadStoredSettings, []);

  const fetchMetrics = useCallback(async () => {
    try {
      setMetricsLoading(true);
      const intervalsKey = localStorage.getItem("apex_intervals_key");
      const res = await fetch(`/api/metrics?athleteId=${encodeURIComponent(athleteId)}`, {
        headers: intervalsKey ? { "x-intervals-api-key": intervalsKey } : undefined,
      });
      if (res.ok) {
        setMetrics(await res.json());
      }
    } catch (e) {
      console.warn("Could not load metrics:", e);
    } finally {
      setMetricsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settingsVersion only triggers a refetch
  }, [athleteId, settingsVersion]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <main className="flex-1 flex bg-ink">
      <Sidebar
        athleteId={athleteId}
        metrics={metrics}
        loading={metricsLoading}
        modelLabel={modelLabel}
        compact={sidebarCompact}
        onToggleCompact={toggleSidebar}
        onRefresh={fetchMetrics}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <MobileBar
          metrics={metrics}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <ChatInterface athleteId={athleteId} metrics={metrics} />
      </div>

      {/* Coach Rules & Schedule Modal */}
      <CoachPreferencesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        athleteId={athleteId}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsChanged={() => {
          loadStoredSettings();
          setSettingsVersion((v) => v + 1);
        }}
      />
    </main>
  );
}
