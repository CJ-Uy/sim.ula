"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import PolicyInput from "@/components/PolicyInput";
import type { PolicyFormData } from "@/components/PolicyInput";
import PolicyMap from "@/components/PolicyMap";
import SimulationLoading from "@/components/SimulationLoading";
import Header from "@/components/Header";
import type { SimulationResult } from "@/lib/types";

type Screen = "input" | "loading";

const INITIAL_FORM: PolicyFormData = {
  policyType: "",
  category: "",
  description: "",
  startDate: "",
  endDate: "",
  location: "",
  agency: "",
};

export default function SimulatePage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("input");
  const [formData, setFormData] = useState<PolicyFormData>(INITIAL_FORM);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedLat, setSelectedLat] = useState<number | undefined>();
  const [selectedLng, setSelectedLng] = useState<number | undefined>();
  const [mapTarget, setMapTarget] = useState<{ lng: number; lat: number } | null>(null);

  // Pick up a refine request coming back from the results page
  useEffect(() => {
    const refine = sessionStorage.getItem("refineSimulation");
    if (refine) {
      sessionStorage.removeItem("refineSimulation");
      const { description, location } = JSON.parse(refine);
      setFormData((prev) => ({ ...prev, description, location }));
    }
  }, []);

  const handleLocationSelect = useCallback(
    (location: string, lat: number, lng: number) => {
      setSelectedLocation(location);
      setSelectedLat(lat);
      setSelectedLng(lng);
    },
    []
  );

  const handleLocationSearch = useCallback(
    (location: string, lat: number, lng: number) => {
      setSelectedLocation(location);
      setSelectedLat(lat);
      setSelectedLng(lng);
      setMapTarget({ lng, lat });
    },
    []
  );

  const handleSubmit = (data: PolicyFormData) => {
    setFormData(data);
    setScreen("loading");
  };

  const handleSimulationComplete = useCallback(
    async (result: SimulationResult & { simulation_id: string }) => {
      // Save to R2/D1 first so the results page can always find it
      try {
        await fetch("/api/simulate/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            simulation_id: result.simulation_id,
            policy: formData.description,
            location: formData.location || "Quezon City",
            result,
          }),
        });
      } catch {
        // Best-effort — sessionStorage is the primary hand-off
      }

      sessionStorage.setItem(
        "pendingSimulation",
        JSON.stringify({ result, policy: formData.description, location: formData.location, formData })
      );
      router.push(`/results/${result.simulation_id}`);
    },
    [formData, router]
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header minimal={screen === "loading"} />

      {screen === "input" && (
        <div
          className="flex min-h-0 flex-1 flex-col lg:flex-row"
          style={{ animation: "fade-in 300ms ease" }}
        >
          <div className="h-[40vh] w-full lg:h-full lg:w-[60%]">
            <PolicyMap
              onLocationSelect={handleLocationSelect}
              flyTo={mapTarget}
            />
          </div>
          <div className="min-h-0 w-full flex-1 overflow-y-auto border-l border-border-light bg-background lg:w-[40%] lg:flex-none">
            <PolicyInput
              onSubmit={handleSubmit}
              selectedLocation={selectedLocation}
              selectedLat={selectedLat}
              selectedLng={selectedLng}
              onLocationSearch={handleLocationSearch}
              initialDescription={formData.description}
            />
          </div>
        </div>
      )}

      {screen === "loading" && (
        <main className="min-h-0 flex-1">
          <SimulationLoading
            formData={formData}
            onComplete={handleSimulationComplete}
            onError={() => setScreen("input")}
          />
        </main>
      )}
    </div>
  );
}
