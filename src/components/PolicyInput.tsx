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
  initialDescription?: string;
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

type LocationScope = "citywide" | "specific";

export default function PolicyInput({
  onSubmit,
  selectedLocation,
  selectedLat,
  selectedLng,
  onLocationSearch,
  initialDescription,
}: PolicyInputProps) {
  const [policyType, setPolicyType] = useState("");
  const [policyTypes, setPolicyTypes] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [agency, setAgency] = useState("");
  const [locationInput, setLocationInput] = useState(selectedLocation || "");
  const [locationScope, setLocationScope] = useState<LocationScope>("citywide");
  const [noEndDate, setNoEndDate] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Sync description when refine pre-fills it
  useEffect(() => {
    if (initialDescription) setDescription(initialDescription);
  }, [initialDescription]);

  // Sync when map click updates selectedLocation (only in specific mode)
  useEffect(() => {
    if (selectedLocation && locationScope === "specific") {
      setLocationInput(selectedLocation);
    }
  }, [selectedLocation, locationScope]);

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
    <div className="overflow-x-hidden px-6 py-8" style={{ animation: "fade-in 300ms ease" }}>
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
                className="w-full min-w-0 border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs text-muted">End</label>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-light hover:text-muted transition-colors">
                  <input
                    type="checkbox"
                    checked={!endDate && noEndDate}
                    onChange={(e) => {
                      setNoEndDate(e.target.checked);
                      if (e.target.checked) setEndDate("");
                    }}
                    className="h-3 w-3 accent-accent"
                  />
                  N/A
                </label>
              </div>
              <input
                type="date"
                value={endDate}
                disabled={noEndDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full min-w-0 border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent ${noEndDate ? "cursor-not-allowed opacity-40" : ""}`}
              />
            </div>
          </div>
        </div>

        {/* Location — with scope toggle */}
        <div>
          <FieldLabel>Location</FieldLabel>

          {/* Scope toggle */}
          <div className="mb-3 flex">
            <button
              type="button"
              onClick={() => setLocationScope("citywide")}
              className={`flex-1 border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                locationScope === "citywide"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface text-muted hover:text-foreground hover:border-border-light"
              }`}
            >
              City-wide
            </button>
            <button
              type="button"
              onClick={() => setLocationScope("specific")}
              className={`flex-1 border-t border-b border-r px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                locationScope === "specific"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface text-muted hover:text-foreground hover:border-border-light"
              }`}
            >
              Specific Location
            </button>
          </div>

          {/* Text input — disabled when city-wide */}
          <div className="relative">
            <input
              type="text"
              value={locationScope === "citywide" ? "" : locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && locationScope === "specific") {
                  e.preventDefault();
                  geocodeLocation(locationInput);
                }
              }}
              onBlur={() => {
                if (
                  locationScope === "specific" &&
                  locationInput &&
                  locationInput !== selectedLocation
                ) {
                  geocodeLocation(locationInput);
                }
              }}
              disabled={locationScope === "citywide"}
              placeholder={
                locationScope === "citywide"
                  ? "Applies to the entire city"
                  : "Search or click the map"
              }
              className={`w-full border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-light focus:border-accent ${
                locationScope === "citywide"
                  ? "cursor-not-allowed bg-background text-muted-light opacity-60"
                  : ""
              }`}
            />
            {isGeocoding && locationScope === "specific" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <span
                  className="inline-block h-2 w-2 rounded-full bg-accent"
                  style={{ animation: "pulse-dot 1.2s ease-in-out infinite" }}
                />
              </span>
            )}
          </div>
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
              location:
                locationScope === "citywide" ? "" : selectedLocation || "",
              lat: locationScope === "citywide" ? undefined : selectedLat,
              lng: locationScope === "citywide" ? undefined : selectedLng,
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
