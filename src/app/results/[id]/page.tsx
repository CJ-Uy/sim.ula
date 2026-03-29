"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SimulationResults from "@/components/SimulationResults";
import Header from "@/components/Header";
import type { SimulationResult } from "@/lib/types";
import type { PolicyFormData } from "@/components/PolicyInput";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

/**
 * Normalize LLM-generated result quirks to match SimulationResult exactly:
 *  - impact_scores: plain number → { score, reasoning }
 *  - persona_reactions: array → flat object
 *  - simulation_timeline[].events: string[] → joined string
 */
function normalizeResult(raw: AnyObj): SimulationResult & { simulation_id: string } {
  const out = { ...raw };

  if (out.impact_scores && typeof out.impact_scores === 'object') {
    const fixed: AnyObj = {};
    for (const [key, val] of Object.entries(out.impact_scores)) {
      if (typeof val === 'number') {
        fixed[key] = { score: val, reasoning: '' };
      } else if (val && typeof val === 'object' && 'score' in (val as AnyObj)) {
        fixed[key] = val;
      } else {
        fixed[key] = { score: 0, reasoning: '' };
      }
    }
    out.impact_scores = fixed;
  }

  if (Array.isArray(out.persona_reactions)) {
    const first = out.persona_reactions[0] ?? {};
    out.persona_reactions = {
      supporter: first.supporter ?? { profile: '', reaction: '' },
      opponent: first.opponent ?? { profile: '', reaction: '' },
      neutral: first.neutral ?? { profile: '', reaction: '' },
    };
  }

  if (Array.isArray(out.simulation_timeline)) {
    out.simulation_timeline = out.simulation_timeline.map((step: AnyObj) => ({
      ...step,
      events: Array.isArray(step.events) ? step.events.join(' ') : step.events,
    }));
  }

  return out as SimulationResult & { simulation_id: string };
}

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
        setResult(normalizeResult(r));
        setFormData(fd ?? { ...BLANK_FORM, description: policy ?? "", location: location ?? "" });
        setLoading(false);
        return;
      } catch {
        sessionStorage.removeItem("pendingSimulation");
      }
    }

    // Fall back to R2 fetch (retry once after a delay if not found — save may be in-flight)
    const fetchFromR2 = async (attempt = 1): Promise<void> => {
      const res = await fetch(`/api/simulate/get?id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (res.status === 404 && attempt === 1) {
          await new Promise((r) => setTimeout(r, 2000));
          return fetchFromR2(2);
        }
        throw new Error("Not found");
      }
      const data = await res.json() as Record<string, unknown>;
      setResult(normalizeResult((data.result ?? data) as AnyObj));
      setFormData({
        ...BLANK_FORM,
        description: (data.policy as string) ?? "",
        location: (data.location as string) ?? "",
      });
    };

    fetchFromR2()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReset = () => {
    router.push("/simulate");
  };

  const handleRefine = (refinedDescription: string) => {
    sessionStorage.setItem(
      "refineSimulation",
      JSON.stringify({ description: refinedDescription, location: formData.location })
    );
    router.push("/simulate");
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
