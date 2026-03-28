"use client";

import { useState } from "react";

const POLICY_TYPES = [
  "Ordinance",
  "Executive Order",
  "Plan",
  "Resolution",
  "Program",
];

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
  agency: string;
}

interface PolicyInputProps {
  onSubmit: (data: PolicyFormData) => void;
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

export default function PolicyInput({ onSubmit }: PolicyInputProps) {
  const [policyType, setPolicyType] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [agency, setAgency] = useState("");

  const canSubmit =
    policyType !== "" && category !== "" && description.length > 20;

  return (
    <div
      className="mx-auto w-full max-w-[680px] px-6 py-12"
      style={{ animation: "fade-in 300ms ease" }}
    >
      {/* Page heading */}
      <div className="mb-10">
        <h1 className="font-serif text-[1.75rem] font-semibold leading-tight text-foreground">
          New Policy Simulation
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Define the parameters of your policy proposal. The simulation will
          analyze projected impact across economic, environmental, and social
          dimensions.
        </p>
      </div>

      <hr className="mb-10 border-border-light" />

      {/* Form sections */}
      <div className="space-y-9">
        {/* Row: Policy Type + Category */}
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <FieldLabel required>Policy Type</FieldLabel>
            <select
              value={policyType}
              onChange={(e) => setPolicyType(e.target.value)}
              className={`w-full border border-border bg-surface px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-accent ${
                policyType === "" ? "text-muted-light" : "text-foreground"
              }`}
            >
              <option value="" disabled>
                Select type
              </option>
              {POLICY_TYPES.map((type) => (
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
              className={`w-full border border-border bg-surface px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-accent ${
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
            rows={5}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the policy proposal, its objectives, and expected scope of implementation..."
            className="w-full border border-border bg-surface px-3 py-2.5 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-muted-light focus:border-accent"
          />
          <div className="mt-1.5 flex justify-between">
            <p className="text-xs text-muted-light">Minimum 20 characters</p>
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
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-muted">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-border bg-surface px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-border bg-surface px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* Location + Agency row */}
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <FieldLabel>Location</FieldLabel>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Barangay Commonwealth"
              className="w-full border border-border bg-surface px-3 py-2.5 text-[15px] outline-none transition-colors placeholder:text-muted-light focus:border-accent"
            />
          </div>
          <div>
            <FieldLabel>Implementing Agency</FieldLabel>
            <input
              type="text"
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              placeholder="e.g., Dept. of Public Works"
              className="w-full border border-border bg-surface px-3 py-2.5 text-[15px] outline-none transition-colors placeholder:text-muted-light focus:border-accent"
            />
          </div>
        </div>
      </div>

      <hr className="mt-10 mb-8 border-border-light" />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs leading-relaxed text-muted-light">
          Fields marked with{" "}
          <span className="text-accent">*</span> are required
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
              location,
              agency,
            })
          }
          className={`px-6 py-2.5 text-[15px] font-medium transition-colors ${
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
