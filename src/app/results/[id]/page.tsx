"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SimulationResults from "@/components/SimulationResults";
import Header from "@/components/Header";
import type { SimulationResult } from "@/lib/types";
import type { PolicyFormData } from "@/components/PolicyInput";

const BLANK_FORM: PolicyFormData = {
  policyType: "",
  category: "",
  description: "",
  startDate: "",
  endDate: "",
  location: "",
  agency: "",
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [result, setResult] = useState<(SimulationResult & { simulation_id: string }) | null>(null);
  const [formData, setFormData] = useState<PolicyFormData>(BLANK_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try sessionStorage first (fresh result just simulated)
    const pending = sessionStorage.getItem("pendingSimulation");
    if (pending) {
      try {
        const { result: r, policy, location, formData: fd } = JSON.parse(pending);
        sessionStorage.removeItem("pendingSimulation");
        if (r?.simulation_id !== id) {
          // Stale entry for a different simulation — ignore it and fetch from R2
          throw new Error("id mismatch");
        }
        setResult(r);
        setFormData(fd ?? { ...BLANK_FORM, description: policy ?? "", location: location ?? "" });
        setLoading(false);
        return;
      } catch {
        sessionStorage.removeItem("pendingSimulation");
      }
    }

    // Fall back to R2 fetch
    fetch(`/api/simulate/get?id=${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Not found`);
        const data = await res.json();
        setResult(data.result ?? data);
        setFormData({
          ...BLANK_FORM,
          description: data.policy ?? "",
          location: data.location ?? "",
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReset = () => {
    router.push("/");
  };

  const handleRefine = (refinedDescription: string) => {
    sessionStorage.setItem(
      "refineSimulation",
      JSON.stringify({ description: refinedDescription, location: formData.location })
    );
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-foreground/50 text-sm">Loading simulation…</div>
        </main>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-foreground/60 text-sm">{error ?? "Simulation not found."}</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-md bg-primary px-4 py-2 text-sm text-white"
          >
            Back to Simula
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <main className="min-h-0 w-full flex-1 overflow-y-auto">
        <SimulationResults
          formData={formData}
          result={result}
          onReset={handleReset}
          onRefine={handleRefine}
        />
      </main>
    </div>
  );
}
