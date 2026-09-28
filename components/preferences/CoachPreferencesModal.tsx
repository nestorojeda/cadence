"use client";

import React, { useState, useEffect } from "react";
import { Minus, Mountain, MountainSnow, RotateCcw, ScanSearch, Waves, type LucideIcon } from "lucide-react";
import { CoachPreferences, createDefaultPreferences } from "@/lib/types/preferences";
import { TERRAINS, type Terrain, type TerrainSummary } from "@/lib/intervals/terrain";
import { GYM_EQUIPMENT, GYM_EXPERIENCE, GYM_GOALS, type GymPreferences } from "@/lib/coach/gym";
import { STRENGTH_COLOR } from "@/lib/intervals/metrics";
import { POWER_ZONE_COLORS } from "@/lib/intervals/workout";
import { GhostButton, Modal, ModalSection, PrimaryButton, SavedNote, inputClass } from "@/components/ui/Modal";

interface CoachPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteId: string;
  onSaved?: (prefs: CoachPreferences) => void;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type DayListKey = "longRideDays" | "intervalDays" | "gymDays" | "restDays";

const TERRAIN_ICONS: Record<Terrain, LucideIcon> = {
  flat: Minus,
  rolling: Waves,
  hilly: Mountain,
  mountainous: MountainSnow,
};

const SESSION_ROWS: Array<{ key: DayListKey; label: string; color: string }> = [
  { key: "intervalDays", label: "Intervals", color: POWER_ZONE_COLORS[4] },
  { key: "longRideDays", label: "Long ride", color: POWER_ZONE_COLORS[2] },
  { key: "gymDays", label: "Gym", color: STRENGTH_COLOR },
  { key: "restDays", label: "Rest", color: POWER_ZONE_COLORS[0] },
];

export function CoachPreferencesModal({ isOpen, onClose, athleteId, onSaved }: CoachPreferencesModalProps) {
  const [preferences, setPreferences] = useState<CoachPreferences>(() => createDefaultPreferences(athleteId));
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
        .then((res) => res.json() as Promise<CoachPreferences | { error: string }>)
        .then((data) => {
          if (data && !("error" in data)) {
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

  const setGym = (patch: Partial<GymPreferences>) =>
    setPreferences((prev) => ({ ...prev, gym: { ...prev.gym, ...patch } }));

  const toggleGoal = (goal: GymPreferences["goals"][number]) => {
    const goals = preferences.gym.goals;
    setGym({ goals: goals.includes(goal) ? goals.filter((g) => g !== goal) : [...goals, goal] });
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
        const data = (await res.json()) as { preferences: CoachPreferences };
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

  // Gym on a rest day is fine: the coach reads it as gym only, no bike.
  const restConflicts = preferences.restDays.filter((day) =>
    SESSION_ROWS.some((row) => row.key !== "restDays" && row.key !== "gymDays" && preferences[row.key].includes(day)),
  );

  return (
    <Modal
      title="Coach rules"
      description={
        <>
          The coach follows these when planning your weeks. Saved on this server for{" "}
          <span className="font-mono text-fg-subtle">{preferences.athleteId || athleteId}</span>.
        </>
      }
      onClose={onClose}
      width="sm:max-w-xl"
      footer={
        <>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex h-10 items-center gap-1.5 text-xs text-fg-muted transition hover:text-fg"
          >
            <RotateCcw className="h-3.5 w-3.5" />
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
                  {restConflicts.length > 1
                    ? "are marked as rest but also have rides"
                    : "is marked as rest but also has a ride"}
                  .
                </span>
              ) : (
                "Preferences, not fixed rules: the coach moves sessions when your form or calendar calls for it. Gym on a rest day means gym only, no bike."
              )
            }
          >
            <div className="grid grid-cols-[minmax(0,1fr)_repeat(7,32px)] items-center gap-x-1 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_repeat(7,40px)]">
              <span />
              {DAYS_OF_WEEK.map((day) => (
                <span key={day} className="text-center font-mono text-[11px] text-fg-muted">
                  {day.slice(0, 2).toUpperCase()}
                </span>
              ))}
              {SESSION_ROWS.map((row) => (
                <React.Fragment key={row.key}>
                  <span className="flex items-center gap-2 pr-2 text-[13px] text-fg-soft">
                    <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: row.color }} />
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
                        className={`h-8 rounded-md border transition sm:h-10 ${
                          active ? "border-transparent" : "border-ink-line hover:border-ink-edge hover:bg-ink-surface"
                        }`}
                        style={active ? { background: row.color } : undefined}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-4 pt-2">
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
                className={`relative h-6 w-10 shrink-0 rounded-full border transition ${
                  preferences.backToBackIntervals ? "border-transparent bg-signal" : "border-ink-edge bg-ink-surface"
                }`}
              >
                <span
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
                    preferences.backToBackIntervals ? "left-5 bg-on-signal" : "left-1 bg-fg-muted"
                  }`}
                />
              </button>
            </label>
          </ModalSection>

          <ModalSection
            label="Gym"
            hint="What your strength work is for. The coach picks exercises, sets, reps and RPE from it and keeps heavy leg days away from key rides."
          >
            <div className="flex flex-wrap gap-2" role="group" aria-label="Gym goals">
              {GYM_GOALS.map((goal) => {
                const selected = preferences.gym.goals.includes(goal.id);
                return (
                  <button
                    key={goal.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleGoal(goal.id)}
                    className={`h-9 rounded-full border px-3 text-[13px] transition ${
                      selected
                        ? "border-fg-muted bg-ink-raised text-fg"
                        : "border-ink-line text-fg-subtle hover:border-ink-edge hover:bg-ink-surface"
                    }`}
                  >
                    {selected && (
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-[2px]"
                        style={{ background: STRENGTH_COLOR }}
                      />
                    )}
                    {goal.label}
                  </button>
                );
              })}
            </div>
            <Segmented
              label="Experience"
              options={GYM_EXPERIENCE}
              value={preferences.gym.experience}
              onChange={(experience) => setGym({ experience })}
            />
            <Segmented
              label="Equipment"
              options={GYM_EQUIPMENT}
              value={preferences.gym.equipment}
              onChange={(equipment) => setGym({ equipment })}
            />
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13px] text-fg-soft">Session length</span>
              <div className="relative w-28">
                <input
                  type="number"
                  aria-label="Gym session length in minutes"
                  min={15}
                  max={120}
                  step={5}
                  value={preferences.gym.sessionMinutes}
                  onChange={(e) => setGym({ sessionMinutes: Number(e.target.value) })}
                  className={`${inputClass} pr-12 font-mono`}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-fg-muted">
                  min
                </span>
              </div>
            </div>
            <textarea
              aria-label="Gym notes"
              rows={2}
              value={preferences.gym.notes}
              onChange={(e) => setGym({ notes: e.target.value })}
              placeholder="e.g. Lower back is sensitive to heavy deadlifts, love kettlebell work, no pull-up bar…"
              className={`${inputClass} h-auto resize-none py-2.5 leading-relaxed`}
            />
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
            <div role="radiogroup" aria-label="Terrain settings" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    className={`flex flex-col items-start gap-0.5 rounded-[10px] border px-3 py-2.5 text-left transition ${
                      selected
                        ? "border-fg-muted bg-ink-raised"
                        : "border-ink-line hover:border-ink-edge hover:bg-ink-surface"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-medium">
                      <Icon className={`h-4 w-4 ${selected ? "text-signal" : "text-fg-muted"}`} aria-hidden />
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
              className="flex h-9 items-center gap-1.5 self-start rounded-[10px] border border-ink-line px-3 text-xs text-fg-soft transition hover:border-ink-edge hover:bg-ink-surface hover:text-fg disabled:opacity-50"
            >
              <ScanSearch className="h-3.5 w-3.5" />
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
              className={`${inputClass} h-auto resize-none py-2.5 leading-relaxed`}
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
        className={`${inputClass} pr-8 font-mono`}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-fg-muted">
        h
      </span>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <span className="text-[13px] text-fg-soft">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex rounded-[10px] border border-ink-line bg-ink-surface p-0.5"
      >
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`h-8 rounded-lg px-3 text-xs transition ${
              value === o.id ? "bg-ink-raised font-medium text-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
