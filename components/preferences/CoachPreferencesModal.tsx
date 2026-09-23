"use client";

import React, { useState, useEffect } from "react";
import { X, Check, RotateCcw, Mountain, Dumbbell, Calendar, Heart, ShieldCheck } from "lucide-react";
import { CoachPreferences, createDefaultPreferences } from "@/lib/types/preferences";

interface CoachPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteId: string;
  onSaved?: (prefs: CoachPreferences) => void;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSavedSuccess(false);
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

  const toggleDay = (
    currentList: string[],
    day: string,
    setter: (newList: string[]) => void
  ) => {
    if (currentList.includes(day)) {
      setter(currentList.filter((d) => d !== day));
    } else {
      setter([...currentList, day]);
    }
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

  const handleResetDefaults = () => {
    setPreferences(createDefaultPreferences(athleteId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Coach Rules & Schedule Preferences
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Persisted server-side for athlete <code className="text-emerald-400 font-semibold">{athleteId}</code>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6 text-sm text-slate-300">
          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading athlete preferences...</div>
          ) : (
            <>
              {/* Target Volume */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Weekly Volume Target (Hours)
                </label>
                <div className="flex items-center gap-4 bg-slate-950/40 border border-slate-800 p-3 rounded-xl">
                  <div className="flex-1">
                    <span className="text-xs text-slate-500">Minimum Hours:</span>
                    <input
                      type="number"
                      min={4}
                      max={preferences.weeklyVolumeMaxHours}
                      value={preferences.weeklyVolumeMinHours}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          weeklyVolumeMinHours: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-slate-500">Maximum Hours:</span>
                    <input
                      type="number"
                      min={preferences.weeklyVolumeMinHours}
                      max={30}
                      value={preferences.weeklyVolumeMaxHours}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          weeklyVolumeMaxHours: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Long Ride Days */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mountain className="w-4 h-4 text-emerald-400" />
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Preferred Long Endurance Ride Days
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const active = preferences.longRideDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          toggleDay(preferences.longRideDays, day, (list) =>
                            setPreferences({ ...preferences, longRideDays: list })
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          active
                            ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                            : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700/60"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Workday Interval Days */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Preferred Quality Interval Days (VO2 / Threshold / OU)
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const active = preferences.intervalDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          toggleDay(preferences.intervalDays, day, (list) =>
                            setPreferences({ ...preferences, intervalDays: list })
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          active
                            ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                            : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700/60"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  * Coach rule: strictly keeps a recovery or endurance day between hard interval sessions.
                </p>
              </div>

              {/* Gym & Strength Days */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell className="w-4 h-4 text-amber-400" />
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Preferred Gym & Strength Training Days
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const active = preferences.gymDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          toggleDay(preferences.gymDays, day, (list) =>
                            setPreferences({ ...preferences, gymDays: list })
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          active
                            ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                            : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700/60"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rest Days */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-rose-400" />
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Preferred Rest Days
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const active = preferences.restDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          toggleDay(preferences.restDays, day, (list) =>
                            setPreferences({ ...preferences, restDays: list })
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          active
                            ? "bg-rose-500 text-slate-950 font-bold shadow-md shadow-rose-500/20"
                            : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700/60"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sunday Routine */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Sunday Routine
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "coffee_ride", label: "Coffee Ride (Z1/Z2)" },
                      { id: "rest", label: "Full Rest Day" },
                      { id: "flexible", label: "Flexible" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setPreferences({ ...preferences, sundayRoutine: option.id })
                      }
                      className={`p-2.5 rounded-xl border text-xs text-center font-medium transition ${
                        preferences.sundayRoutine === option.id
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 font-bold"
                          : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Terrain & Specific Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Long Ride Terrain & Climbing Profile
                </label>
                <input
                  type="text"
                  value={preferences.mountainTerrainNotes}
                  onChange={(e) =>
                    setPreferences({ ...preferences, mountainTerrainNotes: e.target.value })
                  }
                  placeholder="e.g. +2,000m climbing, Gran Canaria mountain terrain"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Custom Athlete Constraints */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Special Notes / Temporary Constraints
                </label>
                <textarea
                  rows={2}
                  value={preferences.customNotes}
                  onChange={(e) =>
                    setPreferences({ ...preferences, customNotes: e.target.value })
                  }
                  placeholder="e.g., Rehabbing left knee, high work travel on Wednesdays, tapering for Gran Canaria race..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold animate-in fade-in">
                <ShieldCheck className="w-4 h-4" />
                Saved to athlete file!
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 transition"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Rules"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
