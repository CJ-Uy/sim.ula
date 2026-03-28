"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Retrieving relevant policy cases",
  "Analyzing economic impact",
  "Simulating environmental outcomes",
  "Evaluating social effects",
  "Computing sustainability score",
];

interface SimulationLoadingProps {
  policy: string;
  onComplete: () => void;
}

export default function SimulationLoading({
  policy,
  onComplete,
}: SimulationLoadingProps) {
  const [activeStep, setActiveStep] = useState(0);

  const displayPolicy =
    policy.length > 120 ? policy.slice(0, 120) + "\u2026" : policy;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 1; i <= STEPS.length; i++) {
      timers.push(
        setTimeout(() => {
          setActiveStep(i);
        }, i * 1200)
      );
    }

    timers.push(
      setTimeout(() => {
        onComplete();
      }, STEPS.length * 1200 + 500)
    );

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

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
                {isActive && (
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

        <hr className="my-6 border-border-light" />

        <p className="text-xs text-muted-light">
          Analyzing against 73 historical policy cases
        </p>
      </div>
    </div>
  );
}
