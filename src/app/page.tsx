"use client";

import { useState, useCallback, useEffect } from "react";
import PolicyInput from "@/components/PolicyInput";
import type { PolicyFormData } from "@/components/PolicyInput";
import PolicyMap from "@/components/PolicyMap";
import SimulationLoading from "@/components/SimulationLoading";
import SimulationResults from "@/components/SimulationResults";
import Header from "@/components/Header";
import type { SimulationResult } from "@/lib/types";

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

export default function Home() {
  const [screen, setScreen] = useState<Screen>("input");
  const [formData, setFormData] = useState<PolicyFormData>(INITIAL_FORM);
  const [simulationResult, setSimulationResult] = useState<(SimulationResult & { simulation_id: string }) | null>(null);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedLat, setSelectedLat] = useState<number | undefined>();
  const [selectedLng, setSelectedLng] = useState<number | undefined>();
  const [mapTarget, setMapTarget] = useState<{ lng: number; lat: number } | null>(null);

  // Pick up a simulation selected from the /policies page
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingSimulation");
    if (pending) {
      sessionStorage.removeItem("pendingSimulation");
      const { result, policy, location } = JSON.parse(pending);
      setFormData((prev) => ({ ...prev, description: policy, location }));
      setSimulationResult(result);
      setScreen("results");
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

  const handleSimulationComplete = useCallback((result: SimulationResult & { simulation_id: string }) => {
    setSimulationResult(result);
    setScreen("results");
  }, []);

  const handleReset = () => {
    setFormData(INITIAL_FORM);
    setSimulationResult(null);
    setSelectedLocation("");
    setSelectedLat(undefined);
    setSelectedLng(undefined);
    setMapTarget(null);
    setScreen("input");
  };

  const handleRefine = useCallback((refinedDescription: string) => {
    setFormData((prev) => ({ ...prev, description: refinedDescription }));
    setSimulationResult(null);
    setScreen("loading");
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header minimal={screen === "loading"} />

      {screen === "input" && (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
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

      {screen === "results" && simulationResult && (
        <main className="min-h-0 w-full flex-1 overflow-y-auto">
          <SimulationResults
            formData={formData}
            result={simulationResult}
            onReset={handleReset}
            onRefine={handleRefine}
          />
        </main>
      )}
    </div>
  );
}
