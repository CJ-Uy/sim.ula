"use client";

import { useEffect, useState, useRef } from "react";
import type { PolicyFormData } from "./PolicyInput";
import type { SimulationResult } from "@/lib/types";

const STEPS = [
  "Querying knowledge graph for precedents",
  "Fetching environmental context",
  "Running policy simulation",
  "Analyzing impacts & stakeholder reactions",
  "Computing sustainability score",
];

interface SimulationLoadingProps {
  formData: PolicyFormData;
  onComplete: (result: SimulationResult & { simulation_id: string }) => void;
  onError: () => void;
}

export default function SimulationLoading({
  formData,
  onComplete,
  onError,
}: SimulationLoadingProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const calledRef = useRef(false);
  const formDataRef = useRef(formData);
  const onCompleteRef = useRef(onComplete);

  const displayPolicy =
    formData.description.length > 110
      ? formData.description.slice(0, 110) + "\u2026"
      : formData.description;

  // Timer — counts up every second
  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Animate steps forward on a schedule
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < STEPS.length; i++) {
      timers.push(setTimeout(() => setActiveStep(i), i * 2000));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  // Call simulation API — runs exactly once per mount
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const fd = formDataRef.current;
    const complete = onCompleteRef.current;

    (async () => {
      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            policy: fd.description,
            location: fd.location || "Quezon City",
            lat: fd.lat,
            lng: fd.lng,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error || `Simulation failed (${res.status})`);
        }

        const result = (await res.json()) as SimulationResult & { simulation_id: string };
        setActiveStep(STEPS.length);
        setTimeout(() => complete(result), 600);
      } catch (err: unknown) {
        setError((err as Error).message);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const completedCount = Math.min(activeStep, STEPS.length);
  const progressPct = (completedCount / STEPS.length) * 100;

  return (
    <div
      className="mx-auto flex min-h-[80vh] w-full max-w-145 flex-col items-center justify-center px-6"
      style={{ animation: "fade-in 300ms ease" }}
    >
      {/* ── BREAKING NEWS HEADER ── */}
      <div className="w-full border-2 border-foreground bg-foreground flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2.5">
          {!error ? (
            <>
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-red-400"
                style={{ animation: "pulse-dot 1s ease-in-out infinite" }}
              />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-background">
                Live
              </span>
              <span className="mx-2 text-background/20">|</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-background/70">
                Policy Analysis in Progress
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                Analysis Failed
              </span>
            </>
          )}
        </div>
        <span className="font-mono text-sm font-bold tabular-nums text-background">
          {formatTime(elapsed)}
        </span>
      </div>

      {/* ── CARD ── */}
      <div className="w-full border border-t-0 border-border bg-surface px-7 py-7">

        {/* Headline */}
        <div className="mb-5">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">
            Breaking
          </span>
          <h2 className="mt-1 font-serif text-[1.25rem] font-bold leading-snug text-foreground">
            {displayPolicy}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-px w-6 bg-border" />
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-light">
              By sim.ula Intelligence Engine
            </p>
          </div>
        </div>

        <hr className="border-border-light" />

        {/* Steps */}
        <div className="mt-5">
          <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-muted">
            Analysis Pipeline
          </p>
          <div className="space-y-3.5">
            {STEPS.map((step, i) => {
              const isCompleted = i < activeStep;
              const isActive = i === activeStep && !error;
              const isPending = i > activeStep;

              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 transition-opacity duration-500 ${isPending ? "opacity-35" : ""}`}
                >
                  {/* Step indicator */}
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-bold transition-colors duration-300 ${
                      isCompleted
                        ? "bg-foreground text-background"
                        : isActive
                          ? "border-2 border-foreground text-foreground"
                          : "border border-border text-muted-light"
                    }`}
                  >
                    {isCompleted ? "✓" : i + 1}
                  </span>

                  {/* Label */}
                  <span
                    className={`text-sm leading-tight transition-colors duration-300 ${
                      isCompleted || isActive ? "text-foreground" : "text-muted-light"
                    }`}
                  >
                    {step}
                  </span>

                  {/* Active pulse */}
                  {isActive && (
                    <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-accent shrink-0">
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-accent"
                        style={{ animation: "pulse-dot 1.2s ease-in-out infinite" }}
                      />
                      Processing
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        {!error && (
          <div className="mt-6">
            <div className="h-px w-full bg-border-light overflow-hidden">
              <div
                className="h-full bg-foreground transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <>
            <hr className="my-5 border-border-light" />
            <div className="space-y-3">
              <p className="text-sm text-red-500">{error}</p>
              <button
                type="button"
                onClick={onError}
                className="text-sm font-semibold text-accent hover:underline underline-offset-4"
              >
                ← Back to form
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        {!error && (
          <>
            <hr className="mt-5 border-border-light" />
            <p className="mt-3 text-[10px] uppercase tracking-[0.15em] text-muted-light">
              Analyzing against historical policy knowledge graph
            </p>
          </>
        )}
      </div>
    </div>
  );
}
