"use client";

import { useEffect, useState, useRef } from "react";
import type { PolicyFormData } from "./PolicyInput";
import type { SimulationResult } from "@/lib/types";
import PolicyChat from "./PolicyChat";

interface SimulationResultsProps {
  formData: PolicyFormData;
  result: SimulationResult & { simulation_id: string };
  onReset: () => void;
  onRefine: (refinedDescription: string) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 sm:mb-6 text-[13px] font-semibold uppercase tracking-wide text-foreground/70">
      {children}
    </h2>
  );
}

const DIMENSION_COLORS: Record<string, string> = {
  economic: "#2563EB",
  environmental: "#16A34A",
  social: "#D97706",
  human_centered: "#DB2777",
};

const DIMENSION_LABELS: Record<string, string> = {
  economic: "Economic Impact",
  environmental: "Environmental Impact",
  social: "Social Impact",
  human_centered: "Human-Centered Impact",
};

const LIKELIHOOD_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  low: "border-red-400 text-red-600",
  medium: "border-amber-400 text-amber-600",
  high: "border-green-400 text-green-600",
};

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((value / max) * 100), 100);
    return () => clearTimeout(t);
  }, [value, max]);
  return (
    <div className="h-1 w-full bg-border-light">
      <div
        className="h-full transition-[width] duration-1000 ease-out"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function SimulationResults({
  formData,
  result,
  onReset,
  onRefine,
}: SimulationResultsProps) {
  const [scoreWidth, setScoreWidth] = useState(0);
  const [showRefine, setShowRefine] = useState(false);
  const [refinedText, setRefinedText] = useState(formData.description);
  const [exporting, setExporting] = useState(false);

  const afterScore = result.sustainability_score?.after ?? 0;

  useEffect(() => {
    const t = setTimeout(() => setScoreWidth(afterScore), 100);
    return () => clearTimeout(t);
  }, [afterScore]);

  // Save simulation to DB in the background after results render
  const savedRef = useRef(false);
  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    fetch("/api/simulate/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        simulation_id: result.simulation_id,
        policy: formData.description,
        location: formData.location || "Quezon City",
        result,
      }),
    }).catch(() => {}); // best-effort, don't block UI
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formatDate = (d: string) => {
    if (!d) return null;
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulation_id: result.simulation_id }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `simula-report-${result.simulation_id.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: export as JSON
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `simula-report-${result.simulation_id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // Compute impact score as 0-100 for display (from -10..+10 scale)
  const toPercent = (score: number) => Math.round(((score + 10) / 20) * 100);

  return (
    <div
      className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-12 lg:px-16"
      style={{ animation: "fade-in 300ms ease" }}
    >
      {/* ── Section A: Header ─────────────────────────────────── */}
      <div className="mb-8 sm:mb-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-foreground/70">
              Simulation Report
            </p>
            <h1 className="mt-1 font-serif text-xl sm:text-2xl font-semibold leading-snug">
              {formData.policyType}: {formData.category}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={`border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${CONFIDENCE_COLORS[result.confidence] ?? ""}`}
            >
              {result.confidence} confidence
            </span>
            <span className="whitespace-nowrap text-xs text-muted-light">
              {today}
            </span>
          </div>
        </div>

        <blockquote className="mt-4 sm:mt-5 border-l-2 border-accent pl-4 text-sm sm:text-[15px] leading-relaxed text-muted">
          {result.policy_summary}
        </blockquote>

        {/* Metadata grid */}
        <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 sm:gap-x-8">
          {formData.location && (
            <div>
              <p className="text-xs text-muted-light">Location</p>
              <p className="text-sm">{formData.location}</p>
            </div>
          )}
          {formData.agency && (
            <div>
              <p className="text-xs text-muted-light">Agency</p>
              <p className="text-sm">{formData.agency}</p>
            </div>
          )}
          {formData.startDate && (
            <div>
              <p className="text-xs text-muted-light">Start</p>
              <p className="text-sm">{formatDate(formData.startDate)}</p>
            </div>
          )}
          {formData.endDate && (
            <div>
              <p className="text-xs text-muted-light">End</p>
              <p className="text-sm">{formatDate(formData.endDate)}</p>
            </div>
          )}
        </div>

        {result.location_context && (
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {result.location_context}
          </p>
        )}

        {result.confidence_reasoning && (
          <p className="mt-3 text-xs italic text-muted-light">
            {result.confidence_reasoning}
          </p>
        )}
      </div>

      <hr className="border-border-light" />

      {/* ── Section B: Sustainability Score ────────────────────── */}
      <section className="py-8 sm:py-10">
        <SectionLabel>Overall Sustainability Score</SectionLabel>
        <div className="flex items-end gap-4 sm:gap-6">
          <div>
            <p className="text-xs text-muted-light">Before</p>
            <span className="font-serif text-2xl sm:text-3xl font-bold leading-none text-muted-light">
              {result.sustainability_score?.before ?? "—"}
            </span>
          </div>
          <div className="text-xl sm:text-2xl text-muted-light">&rarr;</div>
          <div>
            <p className="text-xs text-accent">After</p>
            <span className="font-serif text-5xl sm:text-[4.5rem] font-bold leading-none">
              {afterScore}
            </span>
            <span className="ml-1 text-base sm:text-xl text-muted-light">/100</span>
          </div>
          {afterScore > (result.sustainability_score?.before ?? 0) && (
            <span className="mb-1 sm:mb-2 text-sm font-semibold text-green-600">
              +{afterScore - (result.sustainability_score?.before ?? 0)}
            </span>
          )}
        </div>
        <div className="mt-4 h-1.5 w-full bg-border-light">
          <div
            className="h-full bg-accent transition-[width] duration-1000 ease-out"
            style={{ width: `${scoreWidth}%` }}
          />
        </div>

        {/* Breakdown */}
        {result.sustainability_score?.breakdown && (
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5 sm:gap-x-8">
            {Object.entries(result.sustainability_score?.breakdown ?? {}).map(
              ([key, val]) => (
                <div key={key}>
                  <p className="text-xs text-muted-light capitalize">
                    {key.replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold">{val}</p>
                  <ScoreBar value={val} max={100} color="#0d9488" />
                </div>
              )
            )}
          </div>
        )}
      </section>

      <hr className="border-border-light" />

      {/* ── Section C: Historical Precedents (Evidence) ────────── */}
      {result.historical_precedents?.length > 0 && (
        <>
          <section className="py-8 sm:py-10">
            <SectionLabel>Historical Precedents</SectionLabel>
            <p className="mb-4 sm:mb-6 text-sm text-muted">
              Past policies from the knowledge graph used as evidence for this
              simulation.
            </p>
            <div className="space-y-3 sm:space-y-4">
              {result.historical_precedents.map((p, i) => (
                <div
                  key={i}
                  className="border-l-2 border-accent/40 bg-surface/50 py-3 pl-4 pr-3 sm:pl-5 sm:pr-4"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <h3 className="text-sm sm:text-[15px] font-semibold">
                      {p.policy_name}
                    </h3>
                    <span className="self-start shrink-0 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                      Precedent
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    <span className="font-medium text-foreground/80">
                      Relevance:
                    </span>{" "}
                    {p.relevance}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    <span className="font-medium text-foreground/80">
                      Outcome:
                    </span>{" "}
                    {p.outcome_summary}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <hr className="border-border-light" />
        </>
      )}

      {/* ── Section D: Impact Assessment ──────────────────────── */}
      <section className="py-8 sm:py-10">
        <SectionLabel>Impact Assessment</SectionLabel>
        <div className="space-y-6 sm:space-y-8">
          {Object.entries(result.impact_scores ?? {}).map(([key, dim]) => {
            const color = DIMENSION_COLORS[key] ?? "#6B7280";
            const label = DIMENSION_LABELS[key] ?? key;
            const pct = toPercent(dim.score);
            const scoreLabel =
              dim.score > 3
                ? "Strong Positive"
                : dim.score > 0
                  ? "Moderate Positive"
                  : dim.score === 0
                    ? "Neutral"
                    : dim.score >= -3
                      ? "Moderate Negative"
                      : "Strong Negative";

            return (
              <div key={key} className="border-l-2 w-full" style={{ borderColor: color }}>
                <div className="flex flex-col gap-1 pl-4 pr-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 sm:pl-5">
                  <h3 className="text-sm sm:text-[15px] font-semibold leading-snug">
                    {label}
                  </h3>
                  <div className="flex items-baseline gap-1.5 shrink-0">
                    <span
                      className="font-serif text-xl sm:text-2xl font-bold leading-none"
                      style={{ color }}
                    >
                      {dim.score > 0 ? "+" : ""}
                      {dim.score}
                    </span>
                    <span className="text-xs text-muted-light">/10</span>
                    <span
                      className="ml-1 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color }}
                    >
                      {scoreLabel}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 ml-4 mr-1 h-1 bg-border-light sm:ml-5">
                  <ScoreBar value={pct} max={100} color={color} />
                </div>
                <p className="mt-3 pl-4 pr-1 text-sm leading-relaxed text-muted sm:pl-5">
                  {dim.reasoning}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <hr className="border-border-light" />

      {/* ── Section E: Projected Timeline ─────────────────────── */}
      <section className="py-8 sm:py-10">
        <SectionLabel>Projected Timeline</SectionLabel>
        <div className="space-y-5 sm:space-y-6">
          {result.simulation_timeline.map((m, i) => (
            <div key={i} className="flex gap-3 sm:gap-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-foreground text-xs font-medium text-background">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-[15px]">
                  <span className="font-semibold">{m.period}</span>
                  <span className="text-muted"> &mdash; {m.label}</span>
                  {m.sustainability_delta !== 0 && (
                    <span
                      className={`ml-2 text-xs font-semibold ${m.sustainability_delta > 0 ? "text-green-600" : "text-red-500"}`}
                    >
                      {m.sustainability_delta > 0 ? "+" : ""}
                      {m.sustainability_delta}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {m.events}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-border-light" />

      {/* ── Section F: Stakeholder Perspectives ───────────────── */}
      <section className="py-8 sm:py-10">
        <SectionLabel>Stakeholder Perspectives</SectionLabel>
        <div className="space-y-5 sm:space-y-6">
          {Object.entries(result.persona_reactions ?? {}).map(([key, persona]) => (
            <div key={key} className="border-l-2 border-border-light pl-4">
              <p className="text-sm font-semibold capitalize">{key}</p>
              <p className="mt-1 text-xs text-muted-light">
                {persona.profile}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted italic">
                &ldquo;{persona.reaction}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-border-light" />

      {/* ── Section G: Risks & Mitigations ────────────────────── */}
      {result.risks?.length > 0 && (
        <>
          <section className="py-8 sm:py-10">
            <SectionLabel>Risks & Mitigations</SectionLabel>
            <div className="space-y-3 sm:space-y-4">
              {result.risks.map((r, i) => (
                <div key={i} className="border border-border-light bg-surface/50 p-3 sm:p-4">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <p className="text-sm font-semibold">{r.risk}</p>
                    <span
                      className={`self-start shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${LIKELIHOOD_COLORS[r.likelihood] ?? ""}`}
                    >
                      {r.likelihood}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    <span className="font-medium text-foreground/80">
                      Mitigation:
                    </span>{" "}
                    {r.mitigation}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <hr className="border-border-light" />
        </>
      )}

      {/* ── Section H: Recommendations ────────────────────────── */}
      {result.recommendations?.length > 0 && (
        <>
          <section className="py-8 sm:py-10">
            <SectionLabel>Recommendations</SectionLabel>
            <div className="space-y-3">
              {result.recommendations.map((rec, i) => (
                <div key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-accent/10 text-[11px] font-semibold text-accent">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-muted">{rec}</p>
                </div>
              ))}
            </div>
          </section>
          <hr className="border-border-light" />
        </>
      )}

      {/* ── Section I: Policy Assistant Chat ─────────────────── */}
      <section className="py-8 sm:py-10">
        <SectionLabel>Policy Assistant</SectionLabel>
        <PolicyChat
          simulationId={result.simulation_id}
          policy={formData.description}
          location={formData.location || "Quezon City"}
        />
      </section>

      <hr className="border-border-light" />

      {/* ── Section J: Refine Policy ──────────────────────────── */}
      <section className="py-8 sm:py-10">
        <SectionLabel>Refine & Iterate</SectionLabel>
        {!showRefine ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Adjust the policy description based on the recommendations and
              risks above, then re-run the simulation to see how changes affect
              the outcome.
            </p>
            <button
              type="button"
              onClick={() => setShowRefine(true)}
              className="border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/5"
            >
              Refine Policy
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <textarea
              rows={5}
              value={refinedText}
              onChange={(e) => setRefinedText(e.target.value)}
              className="w-full border border-border bg-surface px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-light focus:border-accent"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                disabled={
                  refinedText.length < 20 ||
                  refinedText === formData.description
                }
                onClick={() => onRefine(refinedText)}
                className={`px-5 py-2 text-sm font-medium transition-colors ${
                  refinedText.length >= 20 &&
                  refinedText !== formData.description
                    ? "bg-accent text-white hover:bg-accent/90"
                    : "cursor-default bg-border-light text-muted-light"
                }`}
              >
                Re-run Simulation
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRefine(false);
                  setRefinedText(formData.description);
                }}
                className="text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <hr className="border-border-light" />

      {/* ── Section K: Actions ────────────────────────────────── */}
      <div className="flex flex-col gap-3 pt-6 pb-4 sm:flex-row sm:items-center sm:gap-6 sm:pt-8">
        <button
          type="button"
          onClick={onReset}
          className="bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          New Simulation
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="border border-border px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          {exporting ? "Exporting..." : "Export Report"}
        </button>
      </div>
    </div>
  );
}
