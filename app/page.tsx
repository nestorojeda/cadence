"use client";

import React, { useState, useEffect, useCallback } from "react";
import { generateId, type UIMessage } from "ai";
import { MobileBar, Sidebar } from "@/components/Sidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { CoachPreferencesModal } from "@/components/preferences/CoachPreferencesModal";
import { SettingsModal } from "@/components/SettingsModal";
import { HistoryModal } from "@/components/chat/HistoryModal";
import type { ChatMeta, StoredChat } from "@/lib/chat/types";
import { DEFAULT_MODELS, DEFAULT_PROVIDER, type ModelProvider } from "@/lib/llm/models";
import type { MetricsResponse } from "@/lib/intervals/metrics";

function storedAthleteId() {
  return localStorage.getItem("apex_athlete_id") || "";
}

function setChatParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("chat", id);
  else url.searchParams.delete("chat");
  window.history.replaceState(null, "", url);
}

interface OpenChat {
  id: string;
  athleteId: string;
  messages: UIMessage[];
}

function readModelLabel() {
  const provider = (localStorage.getItem("apex_model_provider") as ModelProvider) || DEFAULT_PROVIDER;
  const model = localStorage.getItem("apex_model_name") || DEFAULT_MODELS[provider];
  return `${provider} · ${model}`;
}

export default function Home() {
  const [athleteId, setAthleteId] = useState("");
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modelLabel, setModelLabel] = useState("");
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [chat, setChat] = useState<OpenChat | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const loadStoredSettings = () => {
    const storedId = localStorage.getItem("apex_athlete_id");
    if (storedId) {
      setAthleteId(storedId);
    }
    setModelLabel(readModelLabel());
  };

  // Storage can be unavailable (private mode), so never let it throw.
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

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats?athleteId=${encodeURIComponent(athleteId)}`);
      if (res.ok) setChats(await res.json());
    } catch (e) {
      console.warn("Could not load chats:", e);
    }
  }, [athleteId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const newChat = useCallback((forAthlete: string) => {
    setChat({ id: generateId(), athleteId: forAthlete, messages: [] });
    setChatParam(null);
  }, []);

  const openChat = useCallback(
    async (id: string, forAthlete: string) => {
      try {
        const res = await fetch(`/api/chats/${encodeURIComponent(id)}?athleteId=${encodeURIComponent(forAthlete)}`);
        if (res.ok) {
          const stored: StoredChat = await res.json();
          setChat({ id, athleteId: forAthlete, messages: stored.messages });
          setChatParam(id);
          return;
        }
      } catch (e) {
        console.warn("Could not load chat:", e);
      }
      newChat(forAthlete);
    },
    [newChat]
  );

  // Resolve the first chat once; the athlete comes straight from storage because state hasn't caught up yet.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("chat");
    if (id) openChat(id, storedAthleteId());
    else newChat(storedAthleteId());
  }, [openChat, newChat]);

  useEffect(() => {
    if (chat && chat.athleteId !== athleteId) newChat(athleteId);
  }, [athleteId, chat, newChat]);

  const renameChat = async (id: string, title: string) => {
    await fetch(`/api/chats/${encodeURIComponent(id)}?athleteId=${encodeURIComponent(athleteId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    await fetchChats();
  };

  const deleteChat = async (id: string) => {
    await fetch(`/api/chats/${encodeURIComponent(id)}?athleteId=${encodeURIComponent(athleteId)}`, { method: "DELETE" });
    if (chat?.id === id) newChat(athleteId);
    await fetchChats();
  };

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

  const onTurnEnd = useCallback(
    (changedCalendar: boolean) => {
      if (chat) setChatParam(chat.id);
      fetchChats();
      if (changedCalendar) fetchMetrics();
    },
    [chat, fetchChats, fetchMetrics]
  );

  return (
    <main className="flex-1 flex bg-ink">
      <Sidebar
        athleteId={athleteId || metrics?.athlete?.id || ""}
        metrics={metrics}
        loading={metricsLoading}
        modelLabel={modelLabel}
        compact={sidebarCompact}
        onToggleCompact={toggleSidebar}
        onRefresh={fetchMetrics}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        chats={chats}
        activeChatId={chat?.id}
        onOpenChat={(id) => openChat(id, athleteId)}
        onNewChat={() => newChat(athleteId)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <MobileBar
          metrics={metrics}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
        />
        {chat && chat.athleteId === athleteId && (
          <ChatInterface
            key={chat.id}
            athleteId={athleteId}
            metrics={metrics}
            chatId={chat.id}
            initialMessages={chat.messages}
            title={chats.find((c) => c.id === chat.id)?.title}
            onNewChat={() => newChat(athleteId)}
            onTurnEnd={onTurnEnd}
          />
        )}
      </div>

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        chats={chats}
        activeChatId={chat?.id}
        onOpenChat={(id) => openChat(id, athleteId)}
        onNewChat={() => newChat(athleteId)}
        onRename={renameChat}
        onDelete={deleteChat}
      />

      <CoachPreferencesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        athleteId={athleteId}
      />

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
