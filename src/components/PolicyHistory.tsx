"use client";

import { useState, useEffect } from "react";

interface SavedSimulation {
  id: string;
  input_policy: string;
  input_location: string | null;
  sustainability_score: number | null;
  created_at: string | null;
}

export default function PolicyHistory({ onBack }: { onBack: () => void }) {
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-light bg-surface px-6 py-4">
        <div>
          <h1 className="font-serif text-lg font-semibold">Your Policies</h1>
          <p className="text-xs text-muted-light">
            Previously simulated policies
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-xs font-medium text-muted hover:text-foreground border border-border px-3 py-1.5 transition-colors hover:border-border-light"
        >
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
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
            <p className="text-sm text-muted">No simulations yet</p>
            <p className="mt-1 text-xs text-muted-light">
              Run a simulation to see your policy history here.
            </p>
          </div>
        )}

        {!loading && simulations.length > 0 && (
          <div className="mx-auto max-w-3xl space-y-3">
            {simulations.map((sim) => (
              <div
                key={sim.id}
                className="border border-border-light bg-surface p-4 transition-colors hover:border-accent/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">
                      {sim.input_policy || "Untitled policy"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-light">
                      {sim.input_location && (
                        <span className="flex items-center gap-1">
                          <svg
                            className="h-3 w-3"
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
                  </div>
                  {sim.sustainability_score != null && (
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-light">
                        Score
                      </p>
                      <p
                        className={`font-serif text-2xl font-bold leading-none ${scoreColor(sim.sustainability_score)}`}
                      >
                        {sim.sustainability_score}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
