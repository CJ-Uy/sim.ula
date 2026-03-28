"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ScrapeEvent } from "@/lib/types";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

interface ScrapeStatus {
  total_jobs: number;
  by_status: Record<string, number>;
  by_ring: Record<number, Record<string, number>>;
  cycle_count: number;
  last_completed: string | null;
}

type RunState = "idle" | "running" | "stopping";

const RING_LABELS: Record<number, string> = {
  0: "Quezon City",
  1: "Metro Manila",
  2: "Philippines",
  3: "ASEAN",
  4: "Global",
};

const RING_COLORS: Record<number, string> = {
  0: "bg-stone-700",
  1: "bg-blue-500",
  2: "bg-teal-500",
  3: "bg-amber-500",
  4: "bg-purple-500",
};

function RingBadge({ ring }: { ring: number }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${RING_COLORS[ring] ?? "bg-gray-500"}`}>
      Ring {ring}: {RING_LABELS[ring] ?? "Unknown"}
    </span>
  );
}

function StatusIcon({ type }: { type: string }) {
  switch (type) {
    case "job_done":
    case "extract_done":
    case "complete":
      return <span className="text-green-500">&#10003;</span>;
    case "job_start":
    case "search_done":
    case "session_start":
      return <span className="text-blue-400 animate-pulse">&#9679;</span>;
    case "job_error":
      return <span className="text-red-400">&#10007;</span>;
    case "stopped":
      return <span className="text-amber-400">&#9632;</span>;
    default:
      return <span className="text-stone-400">&#8226;</span>;
  }
}

export default function ScrapePanel({ onBack }: { onBack: () => void }) {
  const [runState, setRunState] = useState<RunState>("idle");
  const [selectedRings, setSelectedRings] = useState<number[]>([]);
  const [events, setEvents] = useState<ScrapeEvent[]>([]);
  const [status, setStatus] = useState<ScrapeStatus | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [resetting, setResetting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Fetch status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/scrape/status");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // Status endpoint may not have data yet
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/scrape/seed", { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { nodes_created: number; edges_created: number };
        setSeeded(true);
        setEvents((prev) => [
          ...prev,
          {
            type: "session_start",
            message: `Seeded ${data.nodes_created} city nodes + ${data.edges_created} proximity chain edges`,
          },
        ]);
      }
    } catch (err) {
      setEvents((prev) => [
        ...prev,
        { type: "job_error", error: String(err), message: `Seed failed: ${err}` },
      ]);
    }
    setSeeding(false);
  };

  const handleStart = async () => {
    setRunState("running");
    setEvents([]);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          rings: selectedRings.length > 0 ? selectedRings : undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Scrape request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: ScrapeEvent = JSON.parse(line.slice(6));
              setEvents((prev) => [...prev, event]);
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setEvents((prev) => [
          ...prev,
          { type: "job_error", error: String(err), message: `Session error: ${err}` },
        ]);
      }
    }

    setRunState("idle");
    fetchStatus();
  };

  const handleStop = async () => {
    setRunState("stopping");
    try {
      await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
    } catch {
      // Force abort if stop request fails
      abortRef.current?.abort();
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all scrape jobs and cycle count? This cannot be undone.")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/scrape/status", { method: "DELETE" });
      if (res.ok) {
        const data = (await res.json()) as { jobs_deleted: number };
        setEvents([{
          type: "session_start",
          message: `Reset complete. ${data.jobs_deleted} jobs cleared, cycle count reset to 0.`,
        }]);
        setStatus(null);
        fetchStatus();
      }
    } catch (err) {
      setEvents((prev) => [
        ...prev,
        { type: "job_error", error: String(err), message: `Reset failed: ${err}` },
      ]);
    }
    setResetting(false);
  };

  const toggleRing = (ring: number) => {
    setSelectedRings((prev) =>
      prev.includes(ring) ? prev.filter((r) => r !== ring) : [...prev, ring]
    );
  };

  // Compute live progress from events
  const latestProgress = [...events].reverse().find((e) => e.type === "progress");
  const completedCount = latestProgress?.completed ?? 0;
  const totalCount = latestProgress?.total ?? 0;
  const failedCount = latestProgress?.failed ?? 0;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border-light bg-surface px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            &larr; Back
          </button>
          <h1 className="text-sm font-semibold">Policy Scraper</h1>
          {status && (
            <span className="text-xs text-muted">
              Cycle {status.cycle_count} &middot; {status.total_jobs} total jobs
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Controls panel */}
        <div className="w-full border-b border-border-light bg-surface p-6 lg:w-72 lg:border-b-0 lg:border-r lg:overflow-y-auto">
          {/* Seed button */}
          <div className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Setup
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleSeed}
                disabled={seeding || runState === "running"}
                className="flex-1 rounded border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {seeding ? "Seeding..." : seeded ? "Re-seed" : "Seed City Graph"}
              </button>
              <button
                onClick={handleReset}
                disabled={resetting || runState === "running"}
                className="rounded border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? "Resetting..." : "Reset All"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-light">
              Seed creates city nodes. Reset clears all jobs and cycle count.
            </p>
          </div>

          {/* Ring selector */}
          <div className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Rings
            </h2>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4].map((ring) => (
                <button
                  key={ring}
                  onClick={() => toggleRing(ring)}
                  disabled={runState === "running"}
                  className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedRings.includes(ring) || selectedRings.length === 0
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted hover:border-border-light"
                  } disabled:cursor-not-allowed`}
                >
                  {ring}: {RING_LABELS[ring]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-light">
              {selectedRings.length === 0 ? "All rings selected" : `Ring${selectedRings.length > 1 ? "s" : ""} ${selectedRings.join(", ")} selected`}
            </p>
          </div>

          {/* Start / Stop */}
          <div className="mb-6 flex gap-2">
            <button
              onClick={handleStart}
              disabled={runState !== "idle"}
              className="flex-1 rounded bg-green-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {runState === "running" ? "Running..." : "Start Scrape"}
            </button>
            <button
              onClick={handleStop}
              disabled={runState !== "running"}
              className="rounded border border-red-300 px-4 py-2.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Stop
            </button>
          </div>

          {/* Progress */}
          {(runState !== "idle" || totalCount > 0) && (
            <div className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Progress
              </h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Completed</span>
                  <span className="font-medium">{completedCount} / {totalCount}</span>
                </div>
                {totalCount > 0 && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-500"
                      style={{ width: `${(completedCount / totalCount) * 100}%` }}
                    />
                  </div>
                )}
                {failedCount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-red-500">Failed</span>
                    <span className="font-medium text-red-500">{failedCount}</span>
                  </div>
                )}
                {latestProgress?.by_ring && (
                  <div className="mt-3 space-y-1.5">
                    {Object.entries(latestProgress.by_ring).map(([ring, counts]) => (
                      <div key={ring} className="flex items-center justify-between text-xs">
                        <RingBadge ring={Number(ring)} />
                        <span className="text-muted">
                          {(counts as { done: number; total: number }).done} / {(counts as { done: number; total: number }).total}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Historical status */}
          {status && status.total_jobs > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                All-time Stats
              </h2>
              <div className="space-y-1 text-xs text-muted">
                {Object.entries(status.by_status).map(([s, count]) => (
                  <div key={s} className="flex justify-between">
                    <span className="capitalize">{s}</span>
                    <span className="font-medium text-foreground">{count}</span>
                  </div>
                ))}
                {status.last_completed && (
                  <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-light">
                    Last completed: {new Date(status.last_completed).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live feed */}
        <div className="min-h-0 flex-1 overflow-hidden bg-background">
          <div
            ref={feedRef}
            className="h-full overflow-y-auto p-6 font-mono text-xs"
          >
            {events.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-muted">
                  <p className="mb-1 text-sm">No scrape events yet</p>
                  <p className="text-[11px] text-muted-light">
                    Seed the city graph, then start a scrape to see live progress
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-1">
              {events.map((event, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded px-2 py-1 ${
                    event.type === "job_error"
                      ? "bg-red-50"
                      : event.type === "stopped"
                      ? "bg-amber-50"
                      : event.type === "complete" || event.type === "cycle_done"
                      ? "bg-green-50"
                      : ""
                  }`}
                >
                  <StatusIcon type={event.type} />
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-light">[{event.type}]</span>{" "}
                    {event.city && (
                      <span className="font-medium text-foreground">{event.city}</span>
                    )}
                    {event.topic && (
                      <span className="text-muted"> / {event.topic}</span>
                    )}
                    {event.message && (
                      <span className="text-foreground"> &mdash; {event.message}</span>
                    )}
                    {event.results_count !== undefined && (
                      <span className="text-muted"> &mdash; {event.results_count} results</span>
                    )}
                    {event.pages_fetched !== undefined && (
                      <span className="text-blue-500"> &mdash; {event.pages_fetched} pages fetched{event.doc_length ? ` (${(event.doc_length / 1024).toFixed(1)}KB)` : ''}</span>
                    )}
                    {event.policies_found !== undefined && (
                      <span className="text-teal-600"> &mdash; {event.policies_found} policies, {event.edges_created ?? 0} edges{event.doc_length ? ` from ${(event.doc_length / 1024).toFixed(1)}KB` : ''}</span>
                    )}
                    {event.cross_links !== undefined && event.cross_links > 0 && (
                      <span className="text-purple-600"> +{event.cross_links} cross-links</span>
                    )}
                    {event.error && (
                      <span className="text-red-500"> {event.error}</span>
                    )}
                    {event.duration_ms !== undefined && (
                      <span className="text-stone-400 ml-1">({formatDuration(event.duration_ms)})</span>
                    )}
                  </div>
                  {event.ring && <RingBadge ring={event.ring} />}
                </div>
              ))}
              {runState === "running" && (
                <div className="flex items-center gap-2 px-2 py-1 text-muted animate-pulse">
                  <span>&#9679;</span>
                  <span>Processing...</span>
                </div>
              )}
              {runState === "stopping" && (
                <div className="flex items-center gap-2 px-2 py-1 text-amber-500 animate-pulse">
                  <span>&#9632;</span>
                  <span>Stopping after current job completes...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
