"use client";

import { useState, useCallback, useEffect } from "react";
import { getAllPolicyTypes } from "@/lib/policyTypes";

const CATEGORIES = [
  "Building Code",
  "Zoning",
  "Housing/Reinforcement",
  "Traffic Regulation",
  "Road Safety",
  "Public Space",
  "Green Space",
];

export interface PolicyFormData {
  policyType: string;
  category: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  lat?: number;
  lng?: number;
  agency: string;
}

interface PolicyInputProps {
  onSubmit: (data: PolicyFormData) => void;
  selectedLocation?: string;
  selectedLat?: number;
  selectedLng?: number;
  onLocationSearch?: (location: string, lat: number, lng: number) => void;
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-foreground/70">
      {children}
      {required && <span className="ml-0.5 text-accent">*</span>}
    </label>
  );
}

export default function PolicyInput({
  onSubmit,
  selectedLocation,
  selectedLat,
  selectedLng,
  onLocationSearch,
}: PolicyInputProps) {
  const [policyType, setPolicyType] = useState("");
  const [policyTypes, setPolicyTypes] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [agency, setAgency] = useState("");
  const [locationInput, setLocationInput] = useState(selectedLocation || "");
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Sync when map click updates selectedLocation
  useEffect(() => {
    if (selectedLocation) {
      setLocationInput(selectedLocation);
    }
  }, [selectedLocation]);

  useEffect(() => {
    setPolicyTypes(getAllPolicyTypes());
  }, []);

  const geocodeLocation = useCallback(
    async (query: string) => {
      if (!query.trim() || !onLocationSearch) return;
      setIsGeocoding(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
          { headers: { "User-Agent": "SimBayan/0.1" } },
        );
        const results = (await res.json()) as Array<{
          lat: string;
          lon: string;
          display_name: string;
        }>;
        if (results.length > 0) {
          const { lat, lon, display_name } = results[0];
          const name = display_name.split(",").slice(0, 2).join(",").trim();
          setLocationInput(name);
          onLocationSearch(name, parseFloat(lat), parseFloat(lon));
        }
      } catch {
        // Geocoding failed — keep input as-is
      } finally {
        setIsGeocoding(false);
      }
    },
    [onLocationSearch],
  );

  const canSubmit =
    policyType !== "" && category !== "" && description.length > 20;

  return (
    <div className="px-6 py-8" style={{ animation: "fade-in 300ms ease" }}>
      {/* Page heading */}
      <div className="mb-8">
        <div className="flex">
          <h1 className="font-serif text-[2rem] font-regular leading-tight text-foreground">
            mag
          </h1>
          <h1 className="font-serif text-[2rem] font-bold leading-tight text-foreground">
            simula!
          </h1>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Define policy parameters. Click the map to set a location.
        </p>
      </div>

      <hr className="mb-8 border-border-light" />

      {/* Form sections */}
      <div className="space-y-7">
        {/* Row: Policy Type + Category */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <FieldLabel required>Policy Type</FieldLabel>
            <select
              value={policyType}
              onChange={(e) => setPolicyType(e.target.value)}
              className={`w-full border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent ${
                policyType === "" ? "text-muted-light" : "text-foreground"
              }`}
            >
              <option value="" disabled>
                Select type
              </option>
              {policyTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel required>Category</FieldLabel>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`w-full border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent ${
                category === "" ? "text-muted-light" : "text-foreground"
              }`}
            >
              <option value="" disabled>
                Select category
              </option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <FieldLabel required>Description</FieldLabel>
          <textarea
            rows={4}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the policy proposal, its objectives, and expected scope..."
            className="w-full border border-border bg-surface px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-light focus:border-accent"
          />
          <div className="mt-1 flex justify-between">
            <p className="text-xs text-muted-light">Min. 20 characters</p>
            {description.length > 0 && (
              <p className="text-xs text-muted-light">
                {description.length}/1,000
              </p>
            )}
          </div>
        </div>

        <hr className="border-border-light" />

        {/* Timeline row */}
        <div>
          <FieldLabel>Implementation Timeline</FieldLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted">Start</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">End</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* Location — editable, geocodes on Enter */}
        <div>
          <FieldLabel>Location</FieldLabel>
          <input
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                geocodeLocation(locationInput);
              }
            }}
            onBlur={() => {
              if (locationInput && locationInput !== selectedLocation) {
                geocodeLocation(locationInput);
              }
            }}
            placeholder="Search or click the map"
            className="w-full border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-light focus:border-accent"
          />
          {isGeocoding && (
            <p className="mt-1 text-xs text-muted-light">Searching...</p>
          )}
        </div>

        {/* Implementing Agency */}
        <div>
          <FieldLabel>Implementing Agency</FieldLabel>
          <input
            type="text"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            placeholder="e.g., Dept. of Public Works"
            className="w-full border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-light focus:border-accent"
          />
        </div>
      </div>

      <hr className="mt-8 mb-6 border-border-light" />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-light">
          <span className="text-accent">*</span> Required
        </p>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              policyType,
              category,
              description,
              startDate,
              endDate,
              location: selectedLocation || "",
              lat: selectedLat,
              lng: selectedLng,
              agency,
            })
          }
          className={`px-5 py-2 text-sm font-medium transition-colors ${
            canSubmit
              ? "bg-accent text-white hover:bg-accent/90"
              : "cursor-default bg-border-light text-muted-light"
          }`}
        >
          Run Simulation
        </button>
      </div>
    </div>
  );
}
