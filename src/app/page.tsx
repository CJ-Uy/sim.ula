"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import PolicyInput from "@/components/PolicyInput";
import type { PolicyFormData } from "@/components/PolicyInput";
import PolicyMap from "@/components/PolicyMap";
import SimulationLoading from "@/components/SimulationLoading";
import SimulationResults from "@/components/SimulationResults";
import IngestForm from "@/components/IngestForm";
import DocumentDashboard from "@/components/DocumentDashboard";
import ScrapePanel from "@/components/ScrapePanel";
import PolicyHistory from "@/components/PolicyHistory";
import type { SimulationResult } from "@/lib/types";

type Screen = "input" | "loading" | "results" | "ingest" | "docs" | "scrape" | "history";

const INITIAL_FORM: PolicyFormData = {
  policyType: "",
  category: "",
  description: "",
  startDate: "",
  endDate: "",
  location: "",
  agency: "",
};

function Header({
  minimal,
  onAddData,
  onViewDocs,
  onScrape,
  onHistory,
  screen,
}: {
  minimal?: boolean;
  onAddData: () => void;
  onViewDocs: () => void;
  onScrape: () => void;
  onHistory: () => void;
  screen: Screen;
}) {
  const isSubPage = ["docs", "ingest", "scrape", "history"].includes(screen);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const navItems = [
    { label: "Your Policies", action: onHistory },
    { label: "Knowledge Base", action: onViewDocs },
    { label: "Scrape", action: onScrape },
    { label: "+ Add Data", action: onAddData },
  ];

  return (
    <header className="border-b border-border-light bg-surface">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
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
        <div className="flex items-center gap-3">
          {/* Desktop nav */}
          {!isSubPage && (
            <div className="hidden sm:flex items-center gap-3">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="text-xs font-medium text-muted hover:text-foreground border border-border px-3 py-1.5 transition-colors hover:border-border-light"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <span className="text-xs text-muted-light">v0.1</span>
          {/* Mobile hamburger */}
          {!isSubPage && (
            <div ref={menuRef} className="relative sm:hidden">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu"
                className="flex h-8 w-8 items-center justify-center border border-border text-muted hover:text-foreground transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  {menuOpen ? (
                    <>
                      <line x1="4" y1="4" x2="12" y2="12" />
                      <line x1="12" y1="4" x2="4" y2="12" />
                    </>
                  ) : (
                    <>
                      <line x1="2" y1="4" x2="14" y2="4" />
                      <line x1="2" y1="8" x2="14" y2="8" />
                      <line x1="2" y1="12" x2="14" y2="12" />
                    </>
                  )}
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-45 border border-border-light bg-surface shadow-lg">
                  {navItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        setMenuOpen(false);
                        item.action();
                      }}
                      className="block w-full px-4 py-3 text-left text-sm font-medium text-muted hover:bg-background hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("input");
  const [formData, setFormData] = useState<PolicyFormData>(INITIAL_FORM);
  const [simulationResult, setSimulationResult] = useState<(SimulationResult & { simulation_id: string }) | null>(null);
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
    setFormData(prev => ({ ...prev, description: refinedDescription }));
    setSimulationResult(null);
    setScreen("loading");
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        minimal={screen === "loading"}
        onAddData={() => setScreen("ingest")}
        onViewDocs={() => setScreen("docs")}
        onScrape={() => setScreen("scrape")}
        onHistory={() => setScreen("history")}
        screen={screen}
      />

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

      {screen === "ingest" && (
        <main className="min-h-0 flex-1 overflow-hidden">
          <IngestForm onBack={() => setScreen("input")} />
        </main>
      )}

      {screen === "docs" && (
        <main className="min-h-0 flex-1 overflow-hidden">
          <DocumentDashboard onBack={() => setScreen("input")} />
        </main>
      )}

      {screen === "scrape" && (
        <main className="min-h-0 flex-1 overflow-hidden">
          <ScrapePanel onBack={() => setScreen("input")} />
        </main>
      )}

      {screen === "history" && (
        <main className="min-h-0 flex-1 overflow-hidden">
          <PolicyHistory onBack={() => setScreen("input")} />
        </main>
      )}
    </div>
  );
}
