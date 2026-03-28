"use client";

import { useEffect, useState } from "react";
import type { PolicyFormData } from "./PolicyInput";
import { mockResults } from "@/data/mockResults";
import DimensionBlock from "./DimensionBlock";
import TimelineBlock from "./TimelineBlock";
import StakeholderBlock from "./StakeholderBlock";

interface SimulationResultsProps {
  formData: PolicyFormData;
  onReset: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-6 text-[13px] font-semibold uppercase tracking-wide text-foreground/70">
      {children}
    </h2>
  );
}

export default function SimulationResults({
  formData,
  onReset,
}: SimulationResultsProps) {
  const { sustainabilityScore, summary, dimensions, timeline, stakeholders } =
    mockResults;

  const [scoreWidth, setScoreWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setScoreWidth(sustainabilityScore), 100);
    return () => clearTimeout(t);
  }, [sustainabilityScore]);

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

  return (
    <div
      className="mx-auto w-full max-w-[760px] px-6 py-12"
      style={{ animation: "fade-in 300ms ease" }}
    >
      {/* Section A — Header */}
      <div className="mb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-foreground/70">
              Simulation Report
            </p>
            <h1 className="mt-1 font-serif text-2xl font-semibold leading-snug">
              {formData.policyType}: {formData.category}
            </h1>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-light">
            {today}
          </span>
        </div>

        <blockquote className="mt-5 border-l-2 border-accent pl-4 text-[15px] leading-relaxed text-muted">
          {formData.description}
        </blockquote>

        {/* Metadata grid */}
        <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
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
      </div>

      <hr className="border-border-light" />

      {/* Section B — Sustainability Score */}
      <section className="py-10">
        <SectionLabel>Overall Sustainability Score</SectionLabel>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[4.5rem] font-bold leading-none">
            {sustainabilityScore}
          </span>
          <span className="text-xl text-muted-light">/100</span>
        </div>
        <div className="mt-4 h-1.5 w-full bg-border-light">
          <div
            className="h-full bg-accent transition-[width] duration-1000 ease-out"
            style={{ width: `${scoreWidth}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-muted">{summary}</p>
      </section>

      <hr className="border-border-light" />

      {/* Section C — Impact Dimensions */}
      <section className="py-10">
        <SectionLabel>Impact Assessment</SectionLabel>
        <div className="space-y-8">
          {dimensions.map((dim) => (
            <DimensionBlock key={dim.name} {...dim} />
          ))}
        </div>
      </section>

      <hr className="border-border-light" />

      {/* Section D — Projected Timeline */}
      <section className="py-10">
        <SectionLabel>Projected Timeline</SectionLabel>
        <div className="space-y-6">
          {timeline.map((m, i) => (
            <TimelineBlock key={m.timeframe} index={i + 1} {...m} />
          ))}
        </div>
      </section>

      <hr className="border-border-light" />

      {/* Section E — Stakeholder Perspectives */}
      <section className="py-10">
        <SectionLabel>Stakeholder Perspectives</SectionLabel>
        <div className="space-y-6">
          {stakeholders.map((s) => (
            <StakeholderBlock key={s.persona} {...s} />
          ))}
        </div>
      </section>

      <hr className="border-border-light" />

      {/* Section F — Actions */}
      <div className="flex items-center gap-6 pt-8 pb-4">
        <button
          type="button"
          onClick={onReset}
          className="bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          New Simulation
        </button>
        <button
          type="button"
          disabled
          className="px-5 py-2.5 text-sm text-muted-light"
        >
          Export as PDF
        </button>
      </div>
    </div>
  );
}
