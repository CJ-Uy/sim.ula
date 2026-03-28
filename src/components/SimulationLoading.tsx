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
  const calledRef = useRef(false);
  // Stable refs so the effect never re-runs or aborts due to prop reference changes
  const formDataRef = useRef(formData);
  const onCompleteRef = useRef(onComplete);

  const displayPolicy =
    formData.description.length > 120
      ? formData.description.slice(0, 120) + "\u2026"
      : formData.description;

  // Animate steps forward as time passes
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Advance steps on a schedule, but the last step stays until the API responds
    for (let i = 1; i < STEPS.length; i++) {
      timers.push(setTimeout(() => setActiveStep(i), i * 2000));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  // Call the simulation API — runs exactly once per mount
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

  return (
    <div
      className="mx-auto flex min-h-[70vh] w-full max-w-[520px] flex-col items-center justify-center px-6"
      style={{ animation: "fade-in 300ms ease" }}
    >
      <div className="w-full border border-border-light bg-surface p-8">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-foreground/70">
          Processing Simulation
        </p>
        <p className="mt-2 text-sm italic text-muted">{displayPolicy}</p>

        <hr className="my-6 border-border-light" />

        <div className="space-y-5">
          {STEPS.map((step, i) => {
            const isCompleted = i < activeStep;
            const isActive = i === activeStep;

            return (
              <div key={step} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center text-xs ${
                      isCompleted
                        ? "bg-accent text-white"
                        : isActive
                          ? "border border-accent text-accent"
                          : "border border-border text-muted-light"
                    }`}
                  >
                    {isCompleted ? "\u2713" : i + 1}
                  </span>
                  <span
                    className={`text-sm ${
                      isCompleted
                        ? "text-foreground"
                        : isActive
                          ? "text-foreground"
                          : "text-muted-light"
                    }`}
                  >
                    {step}
                  </span>
                </div>
                {isActive && !error && (
                  <span
                    className="ml-3 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    style={{
                      animation: "pulse-dot 1.2s ease-in-out infinite",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <>
            <hr className="my-6 border-border-light" />
            <div className="space-y-3">
              <p className="text-sm text-red-500">{error}</p>
              <button
                type="button"
                onClick={onError}
                className="text-sm font-medium text-accent hover:underline"
              >
                Back to form
              </button>
            </div>
          </>
        )}

        {!error && (
          <>
            <hr className="my-6 border-border-light" />
            <p className="text-xs text-muted-light">
              Analyzing against historical policy knowledge graph
            </p>
          </>
        )}
      </div>
    </div>
  );
}
