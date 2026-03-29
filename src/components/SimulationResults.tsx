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
  const [exportingPdf, setExportingPdf] = useState(false);

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

  const slug = result.simulation_id.slice(0, 8);
  const title =
    formData.policyType && formData.category
      ? `${formData.policyType}: ${formData.category}`
      : formData.description;
  const location = formData.location || "Quezon City";

  const handleExportMd = () => {
    const scoreSign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
    const lines: string[] = [
      `# Simulation Report`,
      ``,
      `**Policy:** ${title}`,
      `**Location:** ${location}`,
      `**Generated:** ${today}`,
      `**Simulation ID:** ${result.simulation_id}`,
      `**Confidence:** ${result.confidence.toUpperCase()}`,
      result.confidence_reasoning
        ? `**Confidence Note:** ${result.confidence_reasoning}`
        : "",
      ``,
      `---`,
      ``,
      `## Policy Summary`,
      ``,
      result.policy_summary ?? "",
      ``,
      result.location_context ? result.location_context : "",
      ``,
      `---`,
      ``,
      `## Sustainability Score`,
      ``,
      `| | Score |`,
      `|---|---|`,
      `| Before | ${result.sustainability_score?.before ?? "—"} |`,
      `| **After** | **${result.sustainability_score?.after ?? "—"}** |`,
      `| Change | ${scoreSign((result.sustainability_score?.after ?? 0) - (result.sustainability_score?.before ?? 0))} |`,
    ];

    if (result.sustainability_score?.breakdown) {
      lines.push(``, `### Breakdown`, ``, `| Category | Score |`, `|---|---|`);
      for (const [k, v] of Object.entries(result.sustainability_score.breakdown)) {
        lines.push(`| ${k.replace(/_/g, " ")} | ${v} |`);
      }
    }

    lines.push(``, `---`, ``, `## Impact Assessment`, ``);
    const dimLabels: Record<string, string> = {
      economic: "Economic",
      environmental: "Environmental",
      social: "Social",
      human_centered: "Human-Centered",
    };
    for (const [key, dim] of Object.entries(result.impact_scores ?? {})) {
      lines.push(
        `### ${dimLabels[key] ?? key} — ${scoreSign(dim.score)}/10`,
        ``,
        dim.reasoning,
        ``
      );
    }

    lines.push(`---`, ``, `## Projected Timeline`, ``);
    result.simulation_timeline.forEach((step, i) => {
      const delta =
        step.sustainability_delta !== 0
          ? ` *(sustainability ${scoreSign(step.sustainability_delta)})*`
          : "";
      lines.push(
        `### ${i + 1}. ${step.period} — ${step.label}${delta}`,
        ``,
        step.events,
        ``
      );
    });

    lines.push(`---`, ``, `## Stakeholder Perspectives`, ``);
    const personaLabels: Record<string, string> = {
      supporter: "Supporter",
      opponent: "Opponent",
      neutral: "Neutral Observer",
    };
    for (const [key, persona] of Object.entries(result.persona_reactions ?? {})) {
      lines.push(
        `### ${personaLabels[key] ?? key}`,
        `**${persona.profile}**`,
        ``,
        `> ${persona.reaction}`,
        ``
      );
    }

    if (result.risks?.length > 0) {
      lines.push(`---`, ``, `## Risks & Mitigations`, ``);
      result.risks.forEach((r) => {
        lines.push(
          `### ${r.risk}`,
          `**Likelihood:** ${r.likelihood.toUpperCase()}`,
          ``,
          `**Mitigation:** ${r.mitigation}`,
          ``
        );
      });
    }

    if (result.recommendations?.length > 0) {
      lines.push(`---`, ``, `## Recommendations`, ``);
      result.recommendations.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec}`);
      });
      lines.push(``);
    }

    if (result.historical_precedents?.length > 0) {
      lines.push(`---`, ``, `## Historical Precedents`, ``);
      result.historical_precedents.forEach((p) => {
        lines.push(
          `### ${p.policy_name}`,
          `**Relevance:** ${p.relevance}`,
          ``,
          `**Outcome:** ${p.outcome_summary}`,
          ``
        );
      });
    }

    lines.push(
      `---`,
      ``,
      `*Generated by sim.ula — Urban Policy Simulation Platform*`,
      `*This simulation is for educational and research purposes. Results are projections, not guarantees.*`
    );

    const md = lines.filter((l) => l !== undefined).join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simula-${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulation_id: result.simulation_id }),
      });
      if (!res.ok) throw new Error("Report API failed");
      const { report_html } = (await res.json()) as { report_html: string };
      const win = window.open("", "_blank");
      if (!win) throw new Error("Popup blocked");
      win.document.write(report_html);
      win.document.close();
      win.focus();
      // Small delay to let styles load before print dialog
      setTimeout(() => {
        win.print();
        setExportingPdf(false);
      }, 500);
    } catch {
      setExportingPdf(false);
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
              {formData.policyType && formData.category
                ? `${formData.policyType}: ${formData.category}`
                : formData.description}
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
              {(result.historical_precedents ?? []).map((p, i) => (
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
          {(result.simulation_timeline ?? []).map((m, i) => (
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

      {/* ── Section G: Feasibility Assessment ────────────────── */}
      {result.feasibility && (
        <>
          <section className="py-8 sm:py-10">
            <SectionLabel>Feasibility Assessment</SectionLabel>

            {/* Score + label header */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center text-xl font-bold"
                style={{
                  background:
                    result.feasibility.overall_score >= 76
                      ? "rgba(20,184,166,0.12)"
                      : result.feasibility.overall_score >= 51
                      ? "rgba(37,99,235,0.10)"
                      : result.feasibility.overall_score >= 26
                      ? "rgba(217,119,6,0.12)"
                      : "rgba(220,38,38,0.10)",
                  color:
                    result.feasibility.overall_score >= 76
                      ? "#0d9488"
                      : result.feasibility.overall_score >= 51
                      ? "#2563EB"
                      : result.feasibility.overall_score >= 26
                      ? "#D97706"
                      : "#DC2626",
                }}
              >
                {result.feasibility.overall_score}
              </div>
              <div>
                <p className="text-base font-semibold">{result.feasibility.overall_label}</p>
                <p className="text-xs text-muted-light">out of 100</p>
              </div>
              {result.feasibility.estimated_feasibility_horizon && (
                <span className="ml-auto text-xs text-muted border border-border-light px-2 py-1 self-start">
                  {result.feasibility.estimated_feasibility_horizon}
                </span>
              )}
            </div>

            {/* Chain-of-thought reasoning */}
            <p className="mb-6 text-sm leading-relaxed text-muted">
              {result.feasibility.reasoning}
            </p>

            {/* Precedent chains */}
            {result.feasibility.precedent_chains?.length > 0 && (
              <div className="mb-6 space-y-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
                  Precedent Transfer Chains
                </p>
                {result.feasibility.precedent_chains.map((pc, i) => (
                  <div key={i} className="border border-border-light p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{pc.policy_name}</p>
                      <span className="text-[11px] text-muted-light border border-border-light px-2 py-0.5">
                        {pc.city_name}
                      </span>
                    </div>
                    {pc.outcome_summary && (
                      <p className="mb-3 text-xs text-muted">{pc.outcome_summary}</p>
                    )}

                    {/* Chain visualization */}
                    {pc.chain?.length > 0 && (
                      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
                        <span className="px-2 py-0.5 bg-accent/10 text-accent font-medium">
                          {pc.city_name}
                        </span>
                        {pc.chain.map((hop, j) => (
                          <span key={j} className="flex items-center gap-1">
                            <span className="text-muted-light">
                              →
                              <span className="mx-1 text-[10px] text-muted-light">
                                {(hop.weight * 100).toFixed(0)}%{" "}
                                <span className="italic">{hop.basis}</span>
                              </span>
                            </span>
                            <span className="px-2 py-0.5 bg-surface border border-border-light">
                              {hop.to}
                            </span>
                          </span>
                        ))}
                        <span className="ml-1 text-[10px] text-muted-light">
                          → transferability:{" "}
                          <span className="font-semibold text-foreground/70">
                            {(pc.transferability_score * 100).toFixed(0)}%
                          </span>
                        </span>
                      </div>
                    )}

                    {/* Key adaptations */}
                    {pc.key_adaptations?.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/40">
                          Required Adaptations
                        </p>
                        <ul className="space-y-0.5">
                          {pc.key_adaptations.map((a, k) => (
                            <li key={k} className="flex gap-2 text-xs text-muted">
                              <span className="shrink-0 text-accent">›</span>
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Stakeholder readiness */}
            {result.feasibility.stakeholder_readiness?.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
                  Stakeholder Readiness
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {result.feasibility.stakeholder_readiness.map((sr, i) => (
                    <div key={i} className="border border-border-light p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            background:
                              sr.readiness === "ready"
                                ? "#16A34A"
                                : sr.readiness === "cautious"
                                ? "#D97706"
                                : "#DC2626",
                          }}
                        />
                        <p className="text-xs font-semibold capitalize">{sr.readiness}</p>
                      </div>
                      <p className="text-xs font-medium text-foreground/80">{sr.stakeholder}</p>
                      <p className="mt-1 text-xs text-muted">{sr.key_concern}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success factors + blocking factors */}
            {(result.feasibility.critical_success_factors?.length > 0 ||
              result.feasibility.blocking_factors?.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {result.feasibility.critical_success_factors?.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
                      Critical Success Factors
                    </p>
                    <ul className="space-y-1.5">
                      {result.feasibility.critical_success_factors.map((f, i) => (
                        <li key={i} className="flex gap-2 text-xs text-muted">
                          <span className="shrink-0 font-bold" style={{ color: "#16A34A" }}>
                            ✓
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.feasibility.blocking_factors?.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
                      Blocking Factors
                    </p>
                    <ul className="space-y-1.5">
                      {result.feasibility.blocking_factors.map((f, i) => (
                        <li key={i} className="flex gap-2 text-xs text-muted">
                          <span className="shrink-0 font-bold" style={{ color: "#DC2626" }}>
                            ✗
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
          <hr className="border-border-light" />
        </>
      )}

      {/* ── Section H: Risks & Mitigations ────────────────────── */}
      {result.risks?.length > 0 && (
        <>
          <section className="py-8 sm:py-10">
            <SectionLabel>Risks & Mitigations</SectionLabel>
            <div className="space-y-3 sm:space-y-4">
              {(result.risks ?? []).map((r, i) => (
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
              {(result.recommendations ?? []).map((rec, i) => (
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
          onClick={handleExportMd}
          className="border border-border px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Export .md
        </button>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exportingPdf}
          className="border border-border px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {exportingPdf ? "Opening..." : "Export PDF"}
        </button>
      </div>
    </div>
  );
}
