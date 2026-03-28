"use client";

import { useState, useCallback } from "react";
import PolicyInput from "@/components/PolicyInput";
import type { PolicyFormData } from "@/components/PolicyInput";
import PolicyMap from "@/components/PolicyMap";
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
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-lg font-semibold tracking-tight">
            sim.ula
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
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedLat, setSelectedLat] = useState<number | undefined>();
  const [selectedLng, setSelectedLng] = useState<number | undefined>();
  // Target for the map to fly to (set by form geocoding)
  const [mapTarget, setMapTarget] = useState<{ lng: number; lat: number } | null>(null);

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

  const handleLoadingComplete = useCallback(() => {
    setScreen("results");
  }, []);

  const handleReset = () => {
    setFormData(INITIAL_FORM);
    setSelectedLocation("");
    setSelectedLat(undefined);
    setSelectedLng(undefined);
    setMapTarget(null);
    setScreen("input");
  };

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
            policy={formData.description}
            onComplete={handleLoadingComplete}
          />
        </main>
      )}

      {screen === "results" && (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <SimulationResults formData={formData} onReset={handleReset} />
        </main>
      )}
    </div>
  );
}
