"use client";

import { useState, useEffect } from "react";
import type { SimulationResult } from "@/lib/types";

interface SavedSimulation {
  id: string;
  input_policy: string;
  input_location: string | null;
  sustainability_score: number | null;
  created_at: string | null;
}

interface PolicyHistoryProps {
  onBack: () => void;
  onSelect: (
    result: SimulationResult & { simulation_id: string },
    policy: string,
    location: string
  ) => void;
}

export default function PolicyHistory({ onBack, onSelect }: PolicyHistoryProps) {
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/simulate/list");
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as { simulations: SavedSimulation[] };
        setSimulations(data.simulations);
      } catch {
        setSimulations([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleClick = async (sim: SavedSimulation) => {
    setLoadingId(sim.id);
    setError(null);
    try {
      const res = await fetch(`/api/simulate/get?id=${encodeURIComponent(sim.id)}`);
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as {
        simulation_id: string;
        policy: string;
        location: string;
        result: SimulationResult;
      };
      onSelect(
        { simulation_id: data.simulation_id, ...data.result },
        data.policy,
        data.location
      );
    } catch (err) {
      setError(`Could not load simulation: ${err}`);
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    // Optimistically remove from view
    setSimulations((prev) => prev.filter((s) => s.id !== id));
    // Fire delete request in background (endpoint may not exist yet)
    fetch(`/api/simulate/delete?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
      () => {}
    );
    setDeletingId(null);
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const scoreColor = (score: number | null) => {
    if (score == null) return "text-muted-light";
    if (score >= 65) return "text-green-600";
    if (score >= 45) return "text-amber-600";
    return "text-red-500";
  };

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ animation: "fade-in 300ms ease" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-light bg-surface px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <h1 className="font-serif text-base sm:text-lg font-semibold">Your Policies</h1>
          <p className="text-[11px] sm:text-xs text-muted-light">
            Previously simulated policies
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-xs font-medium text-muted hover:text-foreground border border-border px-3 py-1.5 transition-colors hover:border-border-light"
        >
          ← Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <span
              className="inline-block h-2 w-2 rounded-full bg-accent"
              style={{ animation: "pulse-dot 1.2s ease-in-out infinite" }}
            />
            <span className="ml-3 text-sm text-muted-light">Loading…</span>
          </div>
        )}

        {!loading && simulations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="font-serif text-base font-semibold text-muted">No simulations yet</p>
            <p className="mt-1 text-xs text-muted-light">
              Run a simulation to see your policy history here.
            </p>
          </div>
        )}

        {!loading && simulations.length > 0 && (
          <div className="mx-auto max-w-3xl space-y-0 divide-y divide-border-light border border-border-light">
            {/* Table header */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto] items-center gap-4 bg-background px-4 py-2">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted">Policy</span>
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted text-right">Score</span>
              <span className="w-8" />
            </div>

            {simulations.map((sim, i) => (
              <div
                key={sim.id}
                className="group relative flex items-start gap-4 bg-surface p-4 transition-colors hover:bg-background"
                style={{
                  animation: `slide-up 350ms ease both`,
                  animationDelay: `${i * 55}ms`,
                }}
              >
                {/* Clickable area */}
                <button
                  type="button"
                  onClick={() => handleClick(sim)}
                  disabled={loadingId === sim.id || deletingId === sim.id}
                  className="min-w-0 flex-1 text-left disabled:opacity-60"
                >
                  <p className="text-sm font-medium leading-snug pr-2">
                    {sim.input_policy || "Untitled policy"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-light">
                    {sim.input_location && (
                      <span className="flex items-center gap-1">
                        <svg
                          className="h-3 w-3 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {sim.input_location}
                      </span>
                    )}
                    <span>{formatDate(sim.created_at)}</span>
                  </div>
                </button>

                {/* Score + actions */}
                <div className="flex shrink-0 items-center gap-3">
                  {sim.sustainability_score != null && (
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-light">Score</p>
                      <p className={`font-serif text-2xl font-bold leading-none ${scoreColor(sim.sustainability_score)}`}>
                        {sim.sustainability_score}
                      </p>
                    </div>
                  )}

                  {loadingId === sim.id ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  ) : (
                    <svg
                      className="h-4 w-4 text-muted-light group-hover:text-foreground transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      onClick={() => handleClick(sim)}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(sim.id, e)}
                    disabled={deletingId === sim.id || loadingId === sim.id}
                    title="Delete"
                    className="flex h-6 w-6 items-center justify-center border border-transparent text-muted-light opacity-0 transition-all group-hover:opacity-100 hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
