"use client";

import React from "react";
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
}

export function TodaySheet({ isOpen, onClose, athleteId, metrics, loading, onRefresh }: TodaySheetProps) {
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
    </Modal>
  );
}
