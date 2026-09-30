"use client";

import React from "react";
import { Brain, ChevronRight } from "lucide-react";
import { FormSection, IntervalsIcon, RacesSection, WeekSection } from "@/components/Sidebar";
import { GhostButton, Modal } from "@/components/ui/Modal";
import type { MetricsResponse } from "@/lib/intervals/metrics";

interface TodaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  athleteId: string;
  metrics: MetricsResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenMemory: () => void;
}

export function TodaySheet({ isOpen, onClose, athleteId, metrics, loading, onRefresh, onOpenMemory }: TodaySheetProps) {
  if (!isOpen) return null;
  return (
    <Modal
      title="Form & this week"
      onClose={onClose}
      footer={
        <>
          <a
            href={`https://intervals.icu/athlete/${athleteId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center gap-2 text-[13px] text-fg-muted transition hover:text-fg"
          >
            <IntervalsIcon />
            Intervals.icu
          </a>
          <GhostButton onClick={onClose}>Done</GhostButton>
        </>
      }
    >
      <FormSection metrics={metrics} loading={loading} onRefresh={onRefresh} fluid />
      <RacesSection metrics={metrics} />
      <WeekSection metrics={metrics} />
      <button
        type="button"
        onClick={onOpenMemory}
        className="flex h-11 items-center gap-2.5 rounded-[10px] border border-ink-line px-3.5 text-left text-[13px] transition hover:bg-ink-raised"
      >
        <Brain className="h-4 w-4 text-fg-muted" />
        <span className="flex-1">Coach memory</span>
        <ChevronRight className="h-4 w-4 text-fg-muted" />
      </button>
    </Modal>
  );
}
