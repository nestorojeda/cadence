"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, MessageSquare } from "lucide-react";
import { CadenceMark } from "@/components/CadenceMark";
import { ThemeCycleButton } from "@/components/ThemeToggle";
import { ReportList } from "@/components/reports/ReportList";
import { ReportDetail } from "@/components/reports/ReportDetail";
import { getModelSettings } from "@/lib/llm/client-settings";
import type { ReportMeta, ReportsResponse, StoredReport } from "@/lib/reports/types";

function storedAthleteId() {
  try {
    return localStorage.getItem("apex_athlete_id") || "";
  } catch {
    return "";
  }
}

function intervalsHeaders(): HeadersInit | undefined {
  const key = localStorage.getItem("apex_intervals_key");
  return key ? { "x-intervals-api-key": key } : undefined;
}

function setReportParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("id", id);
  else url.searchParams.delete("id");
  window.history.replaceState(null, "", url);
}

const RAIL_LINK = "flex h-10 w-10 items-center justify-center rounded-lg transition";

export default function ReportsPage() {
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [data, setData] = useState<ReportsResponse>({ reports: [], pending: [], pendingLoaded: true });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [report, setReport] = useState<StoredReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reportVersion, setReportVersion] = useState(0);

  useEffect(() => {
    setAthleteId(storedAthleteId());
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setSelectedId(id);
  }, []);

  const fetchReports = useCallback(async () => {
    if (athleteId === null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?athleteId=${encodeURIComponent(athleteId)}`, {
        headers: intervalsHeaders(),
      });
      if (res.ok) setData((await res.json()) as ReportsResponse);
    } catch (e) {
      console.warn("Could not load reports:", e);
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchReports();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchReports]);

  const markReadLocally = (meta: ReportMeta) =>
    setData((d) => ({ ...d, reports: d.reports.map((r) => (r.activityId === meta.activityId ? meta : r)) }));

  useEffect(() => {
    if (athleteId === null || !selectedId) {
      setReport(null);
      return;
    }
    let cancelled = false;
    const query = `?athleteId=${encodeURIComponent(athleteId)}`;
    const path = `/api/reports/${encodeURIComponent(selectedId)}${query}`;
    setReportLoading(true);
    void (async () => {
      try {
        const res = await fetch(path);
        if (!res.ok || cancelled) return;
        const loaded = (await res.json()) as StoredReport;
        setReport(loaded);
        if (!loaded.meta.readAt && loaded.meta.status === "ready") {
          const read = await fetch(path, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ read: true }),
          });
          if (read.ok && !cancelled) markReadLocally((await read.json()) as ReportMeta);
        }
      } catch (e) {
        console.warn("Could not load report:", e);
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, selectedId, reportVersion]);

  const select = (id: string | undefined) => {
    setSelectedId(id);
    setReportParam(id ?? null);
    if (id) window.scrollTo({ top: 0 });
  };

  const generate = async (activityId: string) => {
    if (athleteId === null || running.has(activityId)) return;
    setRunning((s) => new Set(s).add(activityId));
    setErrors(({ [activityId]: _, ...rest }) => rest);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, athleteId, ...getModelSettings() }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<ReportMeta> & { error?: string };
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      if (body.status === "failed") throw new Error(body.error || "The model couldn't write the report.");
      await fetchReports();
      setReportVersion((v) => v + 1);
      select(activityId);
    } catch (e) {
      setErrors((errs) => ({ ...errs, [activityId]: e instanceof Error ? e.message : String(e) }));
      await fetchReports();
    } finally {
      setRunning((s) => {
        const next = new Set(s);
        next.delete(activityId);
        return next;
      });
    }
  };

  const unread = data.reports.filter((r) => r.status === "ready" && !r.readAt).length;

  return (
    <main className="flex flex-1 bg-ink">
      <nav
        aria-label="Main"
        className="sticky top-0 hidden h-screen w-[68px] shrink-0 flex-col items-center gap-3 border-r border-ink-line bg-ink-rail py-5 lg:flex"
      >
        <Link href="/" aria-label="Coach chat" className="mb-3">
          <CadenceMark size={20} />
        </Link>
        <Link
          href="/"
          aria-label="Coach chat"
          title="Coach chat"
          className={`${RAIL_LINK} text-fg-muted hover:bg-ink-raised hover:text-fg`}
        >
          <MessageSquare className="h-4 w-4" />
        </Link>
        <span aria-current="page" title="Reports" className={`${RAIL_LINK} relative bg-ink-raised text-signal`}>
          <FileText className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 font-mono text-[10px] text-on-signal">
              {unread}
            </span>
          )}
        </span>
        <div className="flex-1" />
        <ThemeCycleButton />
      </nav>

      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
        <header
          className={`${selectedId ? "hidden" : "flex"} sticky top-0 z-30 box-content h-[60px] items-center gap-1 border-b border-ink-hair bg-ink/95 pl-1 pr-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden`}
        >
          <Link
            href="/"
            aria-label="Back to coach chat"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-base font-semibold tracking-tight">Reports</span>
        </header>

        <section
          aria-label="Reports"
          className={`${selectedId ? "hidden lg:flex" : "flex"} flex-col border-ink-line bg-ink-card lg:sticky lg:top-0 lg:h-screen lg:w-[360px] lg:shrink-0 lg:overflow-y-auto lg:border-r`}
        >
          <div className="hidden h-14 shrink-0 items-center justify-between border-b border-ink-hair px-5 lg:flex">
            <span className="text-sm font-medium">Reports</span>
            {loading && data.reports.length > 0 && <CadenceMark size={14} spinning />}
          </div>
          <ReportList
            reports={data.reports}
            pending={data.pending}
            pendingLoaded={data.pendingLoaded}
            loading={loading}
            selectedId={selectedId}
            running={running}
            errors={errors}
            onSelect={select}
            onGenerate={(id) => void generate(id)}
          />
        </section>

        <div className={`${selectedId ? "flex" : "hidden lg:flex"} min-w-0 flex-1`}>
          <ReportDetail
            report={report}
            loading={reportLoading}
            regenerating={!!selectedId && running.has(selectedId)}
            error={selectedId ? errors[selectedId] : undefined}
            onBack={() => select(undefined)}
            onRegenerate={() => selectedId && void generate(selectedId)}
          />
        </div>
      </div>
    </main>
  );
}
