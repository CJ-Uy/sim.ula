"use client";

import { useState, useCallback } from "react";
import PolicyInput from "@/components/PolicyInput";
import type { PolicyFormData } from "@/components/PolicyInput";
import SimulationLoading from "@/components/SimulationLoading";
import SimulationResults from "@/components/SimulationResults";

type Screen = "input" | "loading" | "results";

const INITIAL_FORM: PolicyFormData = {
  policyType: "",
  category: "",
  description: "",
  startDate: "",
  endDate: "",
  location: "",
  agency: "",
};

function Header({ minimal }: { minimal?: boolean }) {
  return (
    <header className="border-b border-border-light bg-surface">
      <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-lg font-semibold tracking-tight">
            SimBayan
          </span>
          {!minimal && (
            <span className="hidden text-sm text-muted sm:inline">
              Urban Policy Simulation Platform
            </span>
          )}
        </div>
        <span className="text-xs text-muted-light">v0.1</span>
      </div>
    </header>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("input");
  const [formData, setFormData] = useState<PolicyFormData>(INITIAL_FORM);

  const handleSubmit = (data: PolicyFormData) => {
    setFormData(data);
    setScreen("loading");
  };

  const handleLoadingComplete = useCallback(() => {
    setScreen("results");
  }, []);

  const handleReset = () => {
    setFormData(INITIAL_FORM);
    setScreen("input");
  };

  return (
    <div className="min-h-screen">
      <Header minimal={screen === "loading"} />
      <main>
        {screen === "input" && <PolicyInput onSubmit={handleSubmit} />}
        {screen === "loading" && (
          <SimulationLoading
            policy={formData.description}
            onComplete={handleLoadingComplete}
          />
        )}
        {screen === "results" && (
          <SimulationResults formData={formData} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}
