"use client";

import React, { useEffect, useState } from "react";
import { Activity, Sliders, Settings, ExternalLink, RefreshCw, Zap } from "lucide-react";
import { FitnessSummary } from "@/lib/intervals/client";

interface HeaderProps {
  athleteId: string;
  onOpenRules: () => void;
  onOpenSettings: () => void;
}

export function Header({ athleteId, onOpenRules, onOpenSettings }: HeaderProps) {
  const [metrics, setMetrics] = useState<{
    athlete?: { name: string; firstname: string } | null;
    fitness?: FitnessSummary | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/metrics?athleteId=${encodeURIComponent(athleteId)}`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (e) {
      console.warn("Could not load metrics:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [athleteId]);

  const fitness = metrics?.fitness;
  const tsb = fitness?.tsb;

  const getTsbBadge = () => {
    if (tsb == null) return null;
    if (tsb > 20) {
      return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-semibold">Very Fresh (+{tsb})</span>;
    }
    if (tsb > 5) {
      return <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded text-xs font-semibold">Recovered (+{tsb})</span>;
    }
    if (tsb > -10) {
      return <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded text-xs font-semibold">Optimal ({tsb})</span>;
    }
    if (tsb > -30) {
      return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-semibold">Fatigued ({tsb})</span>;
    }
    return <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-xs font-semibold">Overreached ({tsb})</span>;
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 tracking-tight text-base md:text-lg">
                Apex Cycling Coach
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                AI Coach
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {metrics?.athlete?.name || "Néstor Ojeda"} ({athleteId})
            </p>
          </div>
        </div>

        {/* Live Fitness / Readiness Pill */}
        <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-1.5 shadow-inner">
          <div className="flex items-center gap-3 text-xs">
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Fitness</div>
              <div className="text-slate-100 font-bold text-sm">{fitness?.ctl ?? "—"} <span className="text-[10px] text-slate-500 font-normal">CTL</span></div>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Fatigue</div>
              <div className="text-slate-100 font-bold text-sm">{fitness?.atl ?? "—"} <span className="text-[10px] text-slate-500 font-normal">ATL</span></div>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Form</div>
              <div className="flex items-center justify-center pt-0.5">{getTsbBadge() || <span className="text-slate-400 font-bold text-sm">{tsb ?? "—"}</span>}</div>
            </div>
          </div>

          <button
            onClick={fetchMetrics}
            disabled={loading}
            title="Refresh metrics from Intervals.icu"
            className="text-slate-400 hover:text-slate-200 p-1 rounded transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenRules}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Coach Rules</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Settings</span>
          </button>

          <a
            href={`https://intervals.icu/athlete/${athleteId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Intervals.icu Calendar"
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
