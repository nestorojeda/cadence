"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { CoachPreferencesModal } from "@/components/preferences/CoachPreferencesModal";
import { SettingsModal } from "@/components/SettingsModal";

export default function Home() {
  const [athleteId, setAthleteId] = useState("i435091");
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = localStorage.getItem("apex_athlete_id");
      if (storedId) {
        setAthleteId(storedId);
      }
    }
  }, []);

  const handleSettingsChanged = () => {
    if (typeof window !== "undefined") {
      const storedId = localStorage.getItem("apex_athlete_id");
      if (storedId) {
        setAthleteId(storedId);
      }
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-[#0b0f17]">
      {/* Header with live metrics */}
      <Header
        athleteId={athleteId}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Chat Interface */}
      <ChatInterface athleteId={athleteId} />

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
        onSettingsChanged={handleSettingsChanged}
      />
    </main>
  );
}
