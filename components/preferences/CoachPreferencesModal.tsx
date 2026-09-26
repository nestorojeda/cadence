"use client";

import React, { useState, useEffect } from "react";
import { Minus, Mountain, MountainSnow, RotateCcw, ScanSearch, Waves, type LucideIcon } from "lucide-react";
import { CoachPreferences, createDefaultPreferences } from "@/lib/types/preferences";
import { TERRAINS, type Terrain, type TerrainSummary } from "@/lib/intervals/terrain";
import { GhostButton, Modal, ModalSection, PrimaryButton, SavedNote, inputClass } from "@/components/ui/Modal";

interface CoachPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteId: string;
  onSaved?: (prefs: CoachPreferences) => void;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type DayListKey = "longRideDays" | "intervalDays" | "gymDays" | "restDays";

/** Rows of the week grid; colours follow the zone palette used for sessions in the sidebar. */
const TERRAIN_ICONS: Record<Terrain, LucideIcon> = {
  flat: Minus,
  rolling: Waves,
  hilly: Mountain,
  mountainous: MountainSnow,
};

const SESSION_ROWS: Array<{ key: DayListKey; label: string; color: string }> = [
  { key: "intervalDays", label: "Intervals", color: "#fb923c" },
  { key: "longRideDays", label: "Long ride", color: "#4ade80" },
  { key: "gymDays", label: "Gym", color: "#c084fc" },
  { key: "restDays", label: "Rest", color: "#94a3b8" },
];

export function CoachPreferencesModal({
  isOpen,
  onClose,
  athleteId,
  onSaved,
}: CoachPreferencesModalProps) {
  const [preferences, setPreferences] = useState<CoachPreferences>(() =>
    createDefaultPreferences(athleteId)
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectNote, setDetectNote] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSavedSuccess(false);
      setDetectNote(null);
      fetch(`/api/preferences?athleteId=${encodeURIComponent(athleteId)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setPreferences(data);
          }
        })
        .catch((e) => console.warn("Could not load preferences:", e))
        .finally(() => setLoading(false));
    }
  }, [isOpen, athleteId]);

  if (!isOpen) return null;

  const toggleDay = (key: DayListKey, day: string) => {
    const list = preferences[key];
    setPreferences({
      ...preferences,
      [key]: list.includes(day) ? list.filter((d) => d !== day) : [...list, day],
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences);
        setSavedSuccess(true);
        if (onSaved) onSaved(data.preferences);
        setTimeout(() => {
          setSavedSuccess(false);
        }, 2000);
      }
    } catch (e) {
      console.error("Failed to save preferences:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDetectTerrain = async () => {
    setDetecting(true);
    setDetectNote(null);
    try {
      const intervalsKey = localStorage.getItem("apex_intervals_key");
      const res = await fetch(`/api/terrain?athleteId=${encodeURIComponent(athleteId)}`, {
        headers: intervalsKey ? { "x-intervals-api-key": intervalsKey } : undefined,
      });
      const data = (await res.json()) as (TerrainSummary & { days: number }) | { error: string };
      if ("error" in data) {
        setDetectNote({ text: data.error, error: true });
        return;
      }
      setPreferences((prev) => ({ ...prev, terrain: data.terrain }));
      setDetectNote({
        text:
          `From ${data.rides} outdoor rides in the last ${data.days} days · ${data.metersPerKm} m/km climbing on average` +
          (data.longRide
            ? ` · typical long ride ≈ ${data.longRide.distanceKm} km, +${data.longRide.elevationM.toLocaleString("en-US")} m.`
            : "."),
      });
    } catch (e) {
      console.warn("Could not detect terrain:", e);
      setDetectNote({ text: "Could not reach Intervals.icu.", error: true });
    } finally {
      setDetecting(false);
    }
  };

  const handleResetDefaults = () => {
    setPreferences(createDefaultPreferences(athleteId));
  };

  // A rest day with a bike session is almost always a mistake worth pointing out. Gym on a rest day is fine: the
  // coach reads it as gym only, no bike.
  const restConflicts = preferences.restDays.filter((day) =>
    SESSION_ROWS.some(
      (row) => row.key !== "restDays" && row.key !== "gymDays" && preferences[row.key].includes(day)
    )
  );

  return (
    <Modal
      title="Coach rules"
      description={
        <>
          The coach follows these when planning your weeks. Saved on this server for{" "}
          <span className="font-mono text-fg-subtle">{athleteId}</span>.
        </>
      }
      onClose={onClose}
      width="sm:max-w-xl"
      footer={
        <>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 h-10 text-xs text-fg-muted hover:text-fg transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset defaults
          </button>
          <div className="flex items-center gap-3">
            <SavedNote show={savedSuccess}>Saved</SavedNote>
            <GhostButton onClick={onClose}>Close</GhostButton>
            <PrimaryButton onClick={handleSave} disabled={saving || loading}>
              {saving ? "Saving…" : "Save rules"}
            </PrimaryButton>
          </div>
        </>
      }
    >
      {loading ? (
        <div className="py-12 text-center text-sm text-fg-muted">Loading rules…</div>
      ) : (
        <>
          <ModalSection label="Weekly volume">
            <div className="flex items-center gap-3">
              <HoursInput
                label="Minimum hours per week"
                value={preferences.weeklyVolumeMinHours}
                min={1}
                max={preferences.weeklyVolumeMaxHours}
                onChange={(v) => setPreferences({ ...preferences, weeklyVolumeMinHours: v })}
              />
              <span className="text-sm text-fg-muted">to</span>
              <HoursInput
                label="Maximum hours per week"
                value={preferences.weeklyVolumeMaxHours}
                min={preferences.weeklyVolumeMinHours}
                max={40}
                onChange={(v) => setPreferences({ ...preferences, weeklyVolumeMaxHours: v })}
              />
              <span className="text-sm text-fg-muted">per week</span>
            </div>
          </ModalSection>

          <ModalSection
            label="Preferred days"
            hint={
              restConflicts.length > 0 ? (
                <span className="text-signal-warn">
                  {restConflicts.join(", ")}{" "}
                  {restConflicts.length > 1 ? "are marked as rest but also have rides" : "is marked as rest but also has a ride"}.
                </span>
              ) : (
                "Preferences, not fixed rules: the coach moves sessions when your form or calendar calls for it. Gym on a rest day means gym only, no bike."
              )
            }
          >
            <div className="grid grid-cols-[minmax(0,1fr)_repeat(7,32px)] sm:grid-cols-[minmax(0,1fr)_repeat(7,40px)] gap-x-1 gap-y-1.5 items-center">
              <span />
              {DAYS_OF_WEEK.map((day) => (
                <span key={day} className="text-center font-mono text-[11px] text-fg-muted">
                  {day.slice(0, 2).toUpperCase()}
                </span>
              ))}
              {SESSION_ROWS.map((row) => (
                <React.Fragment key={row.key}>
                  <span className="flex items-center gap-2 text-[13px] text-fg-soft pr-2">
                    <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: row.color }} />
                    <span className="truncate">{row.label}</span>
                  </span>
                  {DAYS_OF_WEEK.map((day) => {
                    const active = preferences[row.key].includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${row.label} on ${day}`}
                        title={`${row.label} on ${day}`}
                        onClick={() => toggleDay(row.key, day)}
                        className={`h-8 sm:h-10 rounded-md border transition ${
                          active ? "border-transparent" : "border-ink-line hover:border-ink-edge hover:bg-ink-surface"
                        }`}
                        style={active ? { background: row.color } : undefined}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <label className="flex items-center justify-between gap-4 pt-2 cursor-pointer">
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] text-fg-soft">Allow back-to-back interval days</span>
                <span className="text-xs text-fg-muted">
                  {preferences.backToBackIntervals
                    ? "Hard sessions may land on consecutive days."
                    : "The coach keeps an easy or rest day between interval sessions."}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.backToBackIntervals}
                onClick={() =>
                  setPreferences({ ...preferences, backToBackIntervals: !preferences.backToBackIntervals })
                }
                className={`relative shrink-0 w-10 h-6 rounded-full border transition ${
                  preferences.backToBackIntervals ? "bg-signal border-transparent" : "bg-ink-surface border-ink-edge"
                }`}
              >
                <span
                  className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all ${
                    preferences.backToBackIntervals ? "left-5 bg-on-signal" : "left-1 bg-fg-muted"
                  }`}
                />
              </button>
            </label>
          </ModalSection>

          <ModalSection
            label="Terrain settings"
            hint={
              detectNote ? (
                <span className={detectNote.error ? "text-signal-warn" : undefined}>{detectNote.text}</span>
              ) : (
                "What your local roads are like. The coach shapes long rides, pacing and fueling around it."
              )
            }
          >
            <div role="radiogroup" aria-label="Terrain settings" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TERRAINS.map((t) => {
                const selected = preferences.terrain === t.id;
                const Icon = TERRAIN_ICONS[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPreferences({ ...preferences, terrain: t.id })}
                    className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-[10px] border text-left transition ${
                      selected ? "border-fg-muted bg-ink-raised" : "border-ink-line hover:border-ink-edge hover:bg-ink-surface"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-medium">
                      <Icon className={`w-4 h-4 ${selected ? "text-signal" : "text-fg-muted"}`} aria-hidden />
                      {t.label}
                    </span>
                    <span className="font-mono text-[11px] text-fg-muted">{t.sub}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleDetectTerrain}
              disabled={detecting}
              title="Suggest a terrain type from your recent outdoor rides"
              className="self-start flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-ink-line text-xs text-fg-soft hover:border-ink-edge hover:bg-ink-surface hover:text-fg transition disabled:opacity-50"
            >
              <ScanSearch className="w-3.5 h-3.5" />
              {detecting ? "Detecting…" : "Detect from my rides"}
            </button>
          </ModalSection>

          <ModalSection label="Notes & temporary constraints" htmlFor="notes">
            <textarea
              id="notes"
              rows={3}
              value={preferences.customNotes}
              onChange={(e) => setPreferences({ ...preferences, customNotes: e.target.value })}
              placeholder="e.g. Rehabbing left knee, travelling for work on Wednesdays, tapering for a race…"
              className={`${inputClass} h-auto py-2.5 leading-relaxed resize-none`}
            />
          </ModalSection>
        </>
      )}
    </Modal>
  );
}

function HoursInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="relative w-24">
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${inputClass} font-mono pr-8`}
      />
      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-fg-muted pointer-events-none">h</span>
    </div>
  );
}
