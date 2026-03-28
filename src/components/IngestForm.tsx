"use client";

import { useState, useCallback, useEffect } from "react";
import type { IngestFormRecord, ResearchResult, SearchResult, ClaimVerification } from "@/lib/types";
import { getAllPolicyTypes } from "@/lib/policyTypes";

const EMPTY_FORM: Omit<IngestFormRecord, "model"> = {
  title: "",
  date: "",
  policyType: "Ordinance",
  whatWasThePolicy: "",
  whereImplemented: "",
  whoWasAffected: "",
  whatHappened: "",
  whoSupportedOpposed: "",
  whatWentWrong: "",
};

// ── Sub-components ─────────────────────────────────────────────────────────

function FieldLabel({
  children,
  required,
  sub,
  dotColor,
}: {
  children: React.ReactNode;
  required?: boolean;
  sub?: string;
  dotColor?: string;
}) {
  return (
    <div className="mb-2">
      <label className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-foreground/70">
        {dotColor && (
          <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
        )}
        {children}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </label>
      {sub && <p className="mt-0.5 text-xs text-muted-light">{sub}</p>}
    </div>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-light focus:border-accent resize-none"
    />
  );
}

// ── Section card ──────────────────────────────────────────────────────────

function SectionCard({
  label,
  railColor,
  bgColor,
  children,
}: {
  label: string;
  railColor: string;
  bgColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg p-5 space-y-5"
      style={{
        borderLeft: `4px solid ${railColor}`,
        backgroundColor: bgColor,
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</p>
      {children}
    </div>
  );
}

// ── Verdict badge ─────────────────────────────────────────────────────────

function VerdictBadge({ verdict, score }: { verdict: string; score: number }) {
  const cfg = {
    entailed: { color: "text-green-700 bg-green-50 border-green-200", label: "Entailed" },
    contradicted: { color: "text-red-700 bg-red-50 border-red-200", label: "Contradicted" },
    neutral: { color: "text-yellow-700 bg-yellow-50 border-yellow-200", label: "Neutral" },
  }[verdict] ?? { color: "text-gray-600 bg-gray-50 border-gray-200", label: verdict };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {cfg.label} ({(score * 100).toFixed(0)}%)
    </span>
  );
}

// ── Research Review Card ───────────────────────────────────────────────────

type FieldKey = keyof Omit<IngestFormRecord, "model">;

const FIELD_LABELS: Record<FieldKey, string> = {
  title: "Title",
  date: "Date",
  policyType: "Policy Type",
  whatWasThePolicy: "What was the policy?",
  whereImplemented: "Where implemented?",
  whoWasAffected: "Who was affected?",
  whatHappened: "What happened?",
  whoSupportedOpposed: "Who supported / opposed it?",
  whatWentWrong: "What went wrong / risks / gaps",
};

const VERDICT_BAR_COLORS: Record<string, string> = {
  entailed: "#16a34a",
  contradicted: "#ef4444",
  neutral: "#d97706",
};

function ResearchCard({
  field,
  value,
  accepted,
  rejected,
  verification,
  query,
  sources,
  sourceText,
  onAccept,
  onReject,
  onRegenerate,
}: {
  field: FieldKey;
  value: string;
  accepted: boolean;
  rejected: boolean;
  verification?: ClaimVerification | null;
  query: string;
  sources: SearchResult[];
  sourceText: string;
  onAccept: () => void;
  onReject: () => void;
  onRegenerate: (newValue: string, newVerification: ClaimVerification | null) => void;
}) {
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const res = await fetch("/api/research/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sources, field, source_text: sourceText }),
      });
      if (res.ok) {
        const data = await res.json() as { value: string; verification?: { claims?: ClaimVerification[] } | null };
        const firstClaim = data.verification?.claims?.[0] ?? null;
        onRegenerate(data.value, firstClaim);
      }
    } finally {
      setRegenerating(false);
    }
  }, [query, sources, field, sourceText, onRegenerate]);

  const verdictColor = verification ? (VERDICT_BAR_COLORS[verification.verdict] ?? "#78716c") : null;

  const borderClass = accepted
    ? "border-green-300 ring-1 ring-green-300"
    : rejected
    ? "border-red-200 opacity-50"
    : "border-border";

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${borderClass}`}>
      {/* Top verdict bar */}
      {verdictColor && (
        <div className="h-0.75" style={{ backgroundColor: verdictColor }} />
      )}
      <div className={`p-4 ${accepted ? "bg-green-50/30" : rejected ? "bg-red-50/20" : "bg-surface"}`}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
            {FIELD_LABELS[field]}
          </span>
          {verification && (
            <VerdictBadge verdict={verification.verdict} score={verification.entailment_score} />
          )}
        </div>

        <p className="mb-4 text-sm leading-relaxed text-foreground">
          {value || <span className="text-muted-light italic">No data found</span>}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onAccept}
            disabled={accepted}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              accepted
                ? "bg-green-100 text-green-700 cursor-default"
                : "bg-surface border border-border hover:bg-green-50 hover:border-green-300 hover:text-green-700"
            }`}
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {accepted ? "Accepted" : "Accept"}
          </button>
          <button
            onClick={onReject}
            disabled={rejected}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              rejected
                ? "bg-red-100 text-red-700 cursor-default"
                : "bg-surface border border-border hover:bg-red-50 hover:border-red-300 hover:text-red-700"
            }`}
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
            </svg>
            {rejected ? "Rejected" : "Reject"}
          </button>
          {!rejected && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium bg-surface border border-border hover:bg-surface/80 transition-colors disabled:opacity-50"
            >
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 2a5 5 0 11-8 8" strokeLinecap="round" />
                <path d="M10 2v3h-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {regenerating ? "Regenerating…" : "Regenerate"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface IngestFormProps {
  onBack: () => void;
}

type IngestStatus =
  | { state: "idle" }
  | { state: "submitting"; step: string }
  | { state: "success"; nodes: number; edges: number; docId: string }
  | { state: "error"; message: string };

type ResearchStatus =
  | { state: "idle" }
  | { state: "searching"; step: string }
  | { state: "done"; result: ResearchResult }
  | { state: "error"; message: string };

const RESEARCH_FIELDS: FieldKey[] = [
  "title",
  "date",
  "policyType",
  "whatWasThePolicy",
  "whereImplemented",
  "whoWasAffected",
  "whatHappened",
  "whoSupportedOpposed",
  "whatWentWrong",
];

// Design tokens for section cards
const ACCENT_COLOR = "#0F766E";
const BLUE_COLOR = "#1D4ED8";
const GREEN_COLOR = "#15803D";

export default function IngestForm({ onBack }: IngestFormProps) {
  const [tab, setTab] = useState<"manual" | "research">("manual");
  const [form, setForm] = useState<Omit<IngestFormRecord, "model">>(EMPTY_FORM);
  const [model, setModel] = useState<IngestFormRecord["model"]>("qwen3:8b");
  const [disableFallback, setDisableFallback] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<IngestStatus>({ state: "idle" });
  const [policyTypes, setPolicyTypes] = useState<string[]>([]);

  useEffect(() => {
    setPolicyTypes(getAllPolicyTypes());
  }, []);

  // Research state
  const [searchQuery, setSearchQuery] = useState("");
  const [appendLocation, setAppendLocation] = useState(true);
  const [researchStatus, setResearchStatus] = useState<ResearchStatus>({ state: "idle" });
  const [accepted, setAccepted] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [rejected, setRejected] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [researchValues, setResearchValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [fieldVerifications, setFieldVerifications] = useState<Partial<Record<FieldKey, ClaimVerification | null>>>({});

  const setField = (key: FieldKey) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ── Manual submit ────────────────────────────────────────────────────────
  const canSubmit =
    form.title.trim() &&
    form.policyType &&
    form.whatWasThePolicy.trim().length >= 20;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIngestStatus({ state: "submitting", step: "Preparing…" });

    const content = [
      `Policy Type: ${form.policyType}`,
      `Date: ${form.date || "Not specified"}`,
      "",
      "What was the policy?",
      form.whatWasThePolicy,
      "",
      "Where was it implemented?",
      form.whereImplemented || "Not specified",
      "",
      "Who was affected?",
      form.whoWasAffected || "Not specified",
      "",
      "What happened? (Outcomes, budgets, compliance rates, timelines)",
      form.whatHappened || "Not specified",
      "",
      "Who supported or opposed it?",
      form.whoSupportedOpposed || "Not specified",
      "",
      "What went wrong / risks / gaps",
      form.whatWentWrong || "Not specified",
    ].join("\n");

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disable_fallback: disableFallback,
          documents: [
            {
              title: form.title,
              content,
              source_type: form.policyType === "Ordinance" ? "ordinance" : "study",
              date_published: form.date || undefined,
              model,
            },
          ],
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6)) as {
            step: string;
            message?: string;
            results?: Array<{ doc_id?: string; nodes_extracted?: number; edges_extracted?: number; error?: string; status?: string }>;
          };

          if (event.step === "done") {
            const first = event.results?.[0];
            if (first?.error || first?.status === "error") {
              setIngestStatus({ state: "error", message: first.error ?? "Ingestion failed" });
            } else {
              setIngestStatus({
                state: "success",
                nodes: first?.nodes_extracted ?? 0,
                edges: first?.edges_extracted ?? 0,
                docId: first?.doc_id ?? "",
              });
              setForm(EMPTY_FORM);
            }
          } else {
            setIngestStatus({ state: "submitting", step: event.message ?? event.step });
          }
        }
      }
    } catch (err) {
      setIngestStatus({ state: "error", message: String(err) });
    }
  }, [form, model, canSubmit, disableFallback]);

  // ── Auto-research ────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setResearchStatus({ state: "searching", step: "Searching…" });
    setAccepted({});
    setRejected({});
    setResearchValues({});
    setFieldVerifications({});

    try {
      setResearchStatus({ state: "searching", step: "Synthesizing with AI…" });

      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery.trim(),
          location: appendLocation ? "Quezon City" : undefined,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string; detail?: string };
        setResearchStatus({ state: "error", message: err.detail ?? err.error ?? "Research failed" });
        return;
      }

      setResearchStatus({ state: "searching", step: "Verifying claims…" });
      const result = (await res.json()) as ResearchResult;

      const verifs: Partial<Record<FieldKey, ClaimVerification | null>> = {};
      if (result.verification?.claims) {
        const claimsPerField = Math.ceil(result.verification.claims.length / RESEARCH_FIELDS.length);
        RESEARCH_FIELDS.forEach((field, i) => {
          const claim = result.verification!.claims[i * claimsPerField];
          verifs[field] = claim ?? null;
        });
      }

      setResearchValues(result.synthesized as Partial<Record<FieldKey, string>>);
      setFieldVerifications(verifs);
      setResearchStatus({ state: "done", result });
    } catch (err) {
      setResearchStatus({ state: "error", message: String(err) });
    }
  }, [searchQuery, appendLocation]);

  const handleAccept = (field: FieldKey) => {
    setAccepted((prev) => ({ ...prev, [field]: true }));
    setRejected((prev) => ({ ...prev, [field]: false }));
  };

  const handleReject = (field: FieldKey) => {
    setRejected((prev) => ({ ...prev, [field]: true }));
    setAccepted((prev) => ({ ...prev, [field]: false }));
  };

  const handleRegenerate = (field: FieldKey) => (newValue: string, newVerification: ClaimVerification | null) => {
    setResearchValues((prev) => ({ ...prev, [field]: newValue }));
    setFieldVerifications((prev) => ({ ...prev, [field]: newVerification }));
    setAccepted((prev) => ({ ...prev, [field]: false }));
    setRejected((prev) => ({ ...prev, [field]: false }));
  };

  const handleUseAccepted = () => {
    const updates: Partial<Omit<IngestFormRecord, "model">> = {};
    RESEARCH_FIELDS.forEach((field) => {
      if (accepted[field] && researchValues[field]) {
        (updates as Record<string, string>)[field] = researchValues[field]!;
      }
    });
    setForm((prev) => ({ ...prev, ...updates }));
    setTab("manual");
  };

  const acceptedCount = RESEARCH_FIELDS.filter((f) => accepted[f]).length;
  const researchResult = researchStatus.state === "done" ? researchStatus.result : null;

  const inputClass = "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-light focus:border-accent";

  return (
    <div className="flex h-full flex-col" style={{ animation: "fade-in 300ms ease" }}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-border-light"
        style={{ backgroundColor: "color-mix(in srgb, var(--accent) 6%, var(--surface))", borderLeft: "4px solid var(--accent)" }}
      >
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground">Add Policy Data</h2>
          <p className="mt-0.5 text-xs text-muted">Build the historical knowledge graph</p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-black/5"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 12L6 8l4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-border-light bg-background px-4 py-3">
        {(["manual", "research"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-accent text-white"
                : "text-muted hover:bg-border-light"
            }`}
          >
            {t === "manual" ? "Manual Entry" : "Auto-Research"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">

        {/* ── Manual Entry Tab ──────────────────────────────────────── */}
        {tab === "manual" && (
          <div className="px-5 py-6 space-y-5">
            {/* Success / error toast */}
            {ingestStatus.state === "success" && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm">
                <span className="font-medium text-green-800">Ingested successfully.</span>
                <span className="ml-2 text-green-700">
                  {ingestStatus.nodes} nodes, {ingestStatus.edges} edges extracted.
                </span>
              </div>
            )}
            {ingestStatus.state === "error" && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span className="font-medium">Error:</span> {ingestStatus.message}
              </div>
            )}

            {/* Card 1 — Policy Identity */}
            <SectionCard
              label="Policy Identity"
              railColor={ACCENT_COLOR}
              bgColor="color-mix(in srgb, #0F766E 4%, #FAFAF9)"
            >
              <div>
                <FieldLabel required dotColor={ACCENT_COLOR}>Title</FieldLabel>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setField("title")(e.target.value)}
                  placeholder="e.g. QC Ordinance SP-2356: Mandatory Waste Segregation at Source"
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel sub='Year ("2017") or full date ("2017-03-15")' dotColor={ACCENT_COLOR}>Date</FieldLabel>
                  <input
                    type="text"
                    value={form.date}
                    onChange={(e) => setField("date")(e.target.value)}
                    placeholder="e.g. 2017 or 2017-03-15"
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel required dotColor={ACCENT_COLOR}>Type</FieldLabel>
                  <select
                    value={form.policyType}
                    onChange={(e) => setField("policyType")(e.target.value)}
                    className={`${inputClass} text-foreground`}
                  >
                    {policyTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </SectionCard>

            {/* Card 2 — Context & Stakeholders */}
            <SectionCard
              label="Context & Stakeholders"
              railColor={BLUE_COLOR}
              bgColor="color-mix(in srgb, #1D4ED8 4%, #FAFAF9)"
            >
              <div>
                <FieldLabel required dotColor={BLUE_COLOR}>What was the policy?</FieldLabel>
                <Textarea
                  value={form.whatWasThePolicy}
                  onChange={setField("whatWasThePolicy")}
                  placeholder="What did it mandate or incentivize? Include ordinance number if available."
                  rows={4}
                />
                {form.whatWasThePolicy.length > 0 && form.whatWasThePolicy.length < 20 && (
                  <p className="mt-1 text-xs text-muted-light">Min. 20 characters</p>
                )}
              </div>

              <div>
                <FieldLabel dotColor={BLUE_COLOR}>Where implemented?</FieldLabel>
                <input
                  type="text"
                  value={form.whereImplemented}
                  onChange={(e) => setField("whereImplemented")(e.target.value)}
                  placeholder="e.g. Barangay Commonwealth, District 4, or city-wide"
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel dotColor={BLUE_COLOR}>Who was affected?</FieldLabel>
                <Textarea
                  value={form.whoWasAffected}
                  onChange={setField("whoWasAffected")}
                  placeholder="e.g. Informal waste workers, junk shop operators, barangay officials, residents of District 5…"
                />
              </div>

              <div>
                <FieldLabel dotColor={BLUE_COLOR}>Who supported / opposed it?</FieldLabel>
                <Textarea
                  value={form.whoSupportedOpposed}
                  onChange={setField("whoSupportedOpposed")}
                  placeholder="e.g. EcoWaste Coalition supported. Junk shop operators in Payatas initially opposed due to reduced unsorted waste access."
                />
              </div>
            </SectionCard>

            {/* Card 3 — Outcomes & Risks */}
            <SectionCard
              label="Outcomes & Risks"
              railColor={GREEN_COLOR}
              bgColor="color-mix(in srgb, #15803D 4%, #FAFAF9)"
            >
              <div>
                <FieldLabel sub="Measurable outcomes, budgets, compliance rates, timelines" dotColor={GREEN_COLOR}>
                  What happened?
                </FieldLabel>
                <Textarea
                  value={form.whatHappened}
                  onChange={setField("whatHappened")}
                  placeholder="e.g. 22% reduction in landfill waste within 18 months. PHP 45M allocated. Compliance rose from 35% to 58%."
                  rows={4}
                />
              </div>

              <div>
                <FieldLabel dotColor={GREEN_COLOR}>What went wrong / risks / gaps</FieldLabel>
                <Textarea
                  value={form.whatWentWrong}
                  onChange={setField("whatWentWrong")}
                  placeholder="e.g. Informal waste workers reported 15-30% income losses during transition. Enforcement was weak in Districts 3-6."
                />
              </div>
            </SectionCard>

            {/* Model selection */}
            <div>
              <FieldLabel>Extraction Model</FieldLabel>
              <div className="flex gap-3">
                {(["qwen3:8b", "phi4:14b"] as const).map((m) => (
                  <label
                    key={m}
                    className={`flex flex-1 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      model === m
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-border bg-surface hover:bg-surface/80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={m}
                      checked={model === m}
                      onChange={() => setModel(m)}
                      className="mt-0.5 accent-accent"
                    />
                    <div>
                      <div className="text-sm font-medium text-foreground">{m}</div>
                      <div className="text-xs text-muted-light">
                        {m === "qwen3:8b" ? "Fast (~30s)" : "High quality (~2–3 min)"}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Fallback toggle */}
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={disableFallback}
                onChange={(e) => setDisableFallback(e.target.checked)}
                className="accent-accent"
              />
              <span>
                Disable Workers AI fallback{" "}
                <span className="text-muted-light">(Ollama errors surface directly)</span>
              </span>
            </label>

            {/* Submit */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <p className="text-xs text-muted-light">
                <span className="text-accent">*</span> Required
              </p>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || ingestStatus.state === "submitting"}
                className={`flex w-full sm:w-auto items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition-colors ${
                  canSubmit && ingestStatus.state !== "submitting"
                    ? "bg-accent text-white hover:bg-accent/90"
                    : "cursor-default bg-border-light text-muted-light"
                }`}
              >
                {ingestStatus.state === "submitting" && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {ingestStatus.state === "submitting" ? "Ingesting…" : "Ingest into Graph"}
              </button>
            </div>

            {/* Progress step */}
            {ingestStatus.state === "submitting" && (
              <div className="flex items-center gap-3 rounded-lg border-l-4 border-l-accent border border-border-light bg-surface/50 px-4 py-3 text-sm text-muted">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                {ingestStatus.step}
              </div>
            )}
          </div>
        )}

        {/* ── Auto-Research Tab ─────────────────────────────────────── */}
        {tab === "research" && (
          <div className="px-5 py-6 space-y-5">
            {/* Info banner */}
            <div className="rounded-lg border-l-4 border-l-accent bg-accent/5 px-4 py-3 text-xs text-muted leading-relaxed flex gap-2">
              <svg className="h-4 w-4 shrink-0 mt-0.5 text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6.5" />
                <path d="M8 7v4M8 5.5v.5" strokeLinecap="round" />
              </svg>
              <span>
                Search for a policy using SearXNG, then review and accept the AI-synthesized fields.
                Each field is verified against search sources by DeBERTa NLI. Accepted fields are
                transferred to Manual Entry for final review before ingestion.
              </span>
            </div>

            {/* Search area */}
            <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
              <FieldLabel>Search Query</FieldLabel>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-light" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="6.5" cy="6.5" r="4.5" />
                    <path d="M10.5 10.5l3 3" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="e.g. QC solid waste ordinance Barangay Commonwealth"
                    className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-light focus:border-accent"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || researchStatus.state === "searching"}
                  className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    searchQuery.trim() && researchStatus.state !== "searching"
                      ? "bg-accent text-white hover:bg-accent/90"
                      : "cursor-default bg-border-light text-muted-light"
                  }`}
                >
                  {researchStatus.state === "searching" ? "Searching…" : "Search & Synthesize"}
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={appendLocation}
                  onChange={(e) => setAppendLocation(e.target.checked)}
                  className="accent-accent"
                />
                Append "Quezon City Philippines" to query
              </label>
            </div>

            {/* Progress */}
            {researchStatus.state === "searching" && (
              <div className="flex items-center gap-3 rounded-lg border-l-4 border-l-accent border border-border-light bg-surface/50 px-4 py-3 text-sm text-muted">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                {researchStatus.step}
              </div>
            )}

            {/* Error */}
            {researchStatus.state === "error" && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span className="font-medium">Research failed:</span> {researchStatus.message}
              </div>
            )}

            {/* Results */}
            {researchStatus.state === "done" && researchResult && (
              <>
                {/* Sources */}
                <details className="rounded-lg border border-border-light overflow-hidden group">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wide text-foreground/60 hover:bg-surface/50 list-none">
                    <span className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 3h10v10H3zM3 7h10M7 3v10" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Sources ({researchResult.results.length} found)
                    </span>
                    <svg className="h-3.5 w-3.5 text-muted transition-transform group-open:rotate-90" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <div className="px-4 pb-4 pt-2 space-y-2 bg-surface/30">
                    {researchResult.results.map((r, i) => (
                      <div key={i} className="text-xs">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-accent hover:underline"
                        >
                          {r.title}
                        </a>
                        <span className="ml-2 text-muted-light">[{r.engine}]</span>
                        <p className="mt-0.5 text-muted line-clamp-2">{r.content}</p>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Verification summary */}
                {researchResult.verification && (
                  <div className={`rounded-lg border px-4 py-3 text-sm ${
                    researchResult.verification.card_verified
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-yellow-200 bg-yellow-50 text-yellow-800"
                  }`}>
                    <span className="font-medium">DeBERTa verification: </span>
                    {researchResult.verification.summary}
                    <span className="ml-2 text-xs opacity-75">
                      (threshold: {(researchResult.verification.threshold_used * 100).toFixed(0)}%)
                    </span>
                  </div>
                )}
                {!researchResult.verification && (
                  <div className="rounded-lg border border-border-light bg-surface/50 px-4 py-2.5 text-xs text-muted">
                    DeBERTa NLI verification unavailable (service offline) — review fields manually.
                  </div>
                )}

                {/* Review cards */}
                <div className="space-y-3">
                  {RESEARCH_FIELDS.map((field) => (
                    <ResearchCard
                      key={field}
                      field={field}
                      value={researchValues[field] ?? ""}
                      accepted={!!accepted[field]}
                      rejected={!!rejected[field]}
                      verification={fieldVerifications[field]}
                      query={searchQuery}
                      sources={researchResult.results}
                      sourceText={researchResult.source_text}
                      onAccept={() => handleAccept(field)}
                      onReject={() => handleReject(field)}
                      onRegenerate={handleRegenerate(field)}
                    />
                  ))}
                </div>

                {/* Transfer button */}
                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-border-light">
                  <p className="text-xs text-muted-light">
                    {acceptedCount} of {RESEARCH_FIELDS.length} fields accepted
                  </p>
                  <button
                    onClick={handleUseAccepted}
                    disabled={acceptedCount === 0}
                    className={`flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-md px-5 py-2.5 text-sm font-medium transition-colors ${
                      acceptedCount > 0
                        ? "bg-accent text-white hover:bg-accent/90"
                        : "cursor-default bg-border-light text-muted-light"
                    }`}
                  >
                    Use {acceptedCount > 0 ? acceptedCount : ""} Accepted Fields
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 8h8M9 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
