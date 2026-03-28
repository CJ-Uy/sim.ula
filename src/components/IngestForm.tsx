"use client";

import { useState, useCallback } from "react";
import type { IngestFormRecord, ResearchResult, SearchResult, ClaimVerification } from "@/lib/types";

const POLICY_TYPES: IngestFormRecord["policyType"][] = [
  "Ordinance",
  "Executive Order",
  "Plan",
  "Implementing Rules and Regulation",
  "Resolution",
  "Program",
];

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
}: {
  children: React.ReactNode;
  required?: boolean;
  sub?: string;
}) {
  return (
    <div className="mb-2">
      <label className="block text-[13px] font-semibold uppercase tracking-wide text-foreground/70">
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
      className="w-full border border-border bg-surface px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-light focus:border-accent resize-none"
    />
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

  const borderColor = accepted
    ? "border-green-300 bg-green-50/30"
    : rejected
    ? "border-red-200 bg-red-50/30 opacity-60"
    : "border-border";

  return (
    <div className={`rounded border p-4 transition-colors ${borderColor}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
          {FIELD_LABELS[field]}
        </span>
        {verification && (
          <VerdictBadge verdict={verification.verdict} score={verification.entailment_score} />
        )}
      </div>

      <p className="mb-3 text-sm leading-relaxed text-foreground">
        {value || <span className="text-muted-light italic">No data found</span>}
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={onAccept}
          disabled={accepted}
          className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
            accepted
              ? "bg-green-100 text-green-700 cursor-default"
              : "bg-surface border border-border hover:bg-green-50 hover:border-green-300 hover:text-green-700"
          }`}
        >
          {accepted ? "✓ Accepted" : "✓ Accept"}
        </button>
        <button
          onClick={onReject}
          disabled={rejected}
          className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
            rejected
              ? "bg-red-100 text-red-700 cursor-default"
              : "bg-surface border border-border hover:bg-red-50 hover:border-red-300 hover:text-red-700"
          }`}
        >
          {rejected ? "✗ Rejected" : "✗ Reject"}
        </button>
        {!rejected && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-xs px-3 py-1 rounded font-medium bg-surface border border-border hover:bg-surface/80 transition-colors disabled:opacity-50"
          >
            {regenerating ? "Regenerating…" : "↺ Regenerate"}
          </button>
        )}
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
  | { state: "submitting" }
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

export default function IngestForm({ onBack }: IngestFormProps) {
  const [tab, setTab] = useState<"manual" | "research">("manual");
  const [form, setForm] = useState<Omit<IngestFormRecord, "model">>(EMPTY_FORM);
  const [model, setModel] = useState<IngestFormRecord["model"]>("qwen3:8b");
  const [ingestStatus, setIngestStatus] = useState<IngestStatus>({ state: "idle" });

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
    setIngestStatus({ state: "submitting" });

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

      const data = (await res.json()) as {
        results?: Array<{ doc_id?: string; nodes_extracted?: number; edges_extracted?: number; error?: string }>;
      };
      const first = data.results?.[0];

      if (first?.error) {
        setIngestStatus({ state: "error", message: first.error });
      } else {
        setIngestStatus({
          state: "success",
          nodes: first?.nodes_extracted ?? 0,
          edges: first?.edges_extracted ?? 0,
          docId: first?.doc_id ?? "",
        });
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      setIngestStatus({ state: "error", message: String(err) });
    }
  }, [form, model, canSubmit]);

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

      // Distribute verification badges to individual fields
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

  return (
    <div className="flex h-full flex-col" style={{ animation: "fade-in 300ms ease" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-light bg-surface px-6 py-4">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">Add Policy Data</h2>
          <p className="text-xs text-muted">Build the historical knowledge graph</p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-light bg-surface">
        {(["manual", "research"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t === "manual" ? "Manual Entry" : "Auto-Research"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ── Manual Entry Tab ──────────────────────────────────────── */}
        {tab === "manual" && (
          <div className="px-6 py-8 space-y-6">
            {/* Success / error toast */}
            {ingestStatus.state === "success" && (
              <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm">
                <span className="font-medium text-green-800">Ingested successfully.</span>
                <span className="ml-2 text-green-700">
                  {ingestStatus.nodes} nodes, {ingestStatus.edges} edges extracted.
                </span>
              </div>
            )}
            {ingestStatus.state === "error" && (
              <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span className="font-medium">Error:</span> {ingestStatus.message}
              </div>
            )}

            {/* Title */}
            <div>
              <FieldLabel required>Title</FieldLabel>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setField("title")(e.target.value)}
                placeholder="e.g. QC Ordinance SP-2356: Mandatory Waste Segregation at Source"
                className="w-full border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-light focus:border-accent"
              />
            </div>

            {/* Date + Type row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel sub='Year ("2017") or full date ("2017-03-15")'>Date</FieldLabel>
                <input
                  type="text"
                  value={form.date}
                  onChange={(e) => setField("date")(e.target.value)}
                  placeholder="e.g. 2017 or 2017-03-15"
                  className="w-full border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-light focus:border-accent"
                />
              </div>
              <div>
                <FieldLabel required>Type</FieldLabel>
                <select
                  value={form.policyType}
                  onChange={(e) => setField("policyType")(e.target.value)}
                  className="w-full border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent text-foreground"
                >
                  {POLICY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <hr className="border-border-light" />

            {/* Structured fields */}
            <div>
              <FieldLabel required>What was the policy?</FieldLabel>
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
              <FieldLabel>Where implemented?</FieldLabel>
              <input
                type="text"
                value={form.whereImplemented}
                onChange={(e) => setField("whereImplemented")(e.target.value)}
                placeholder="e.g. Barangay Commonwealth, District 4, or city-wide"
                className="w-full border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-light focus:border-accent"
              />
            </div>

            <div>
              <FieldLabel>Who was affected?</FieldLabel>
              <Textarea
                value={form.whoWasAffected}
                onChange={setField("whoWasAffected")}
                placeholder="e.g. Informal waste workers, junk shop operators, barangay officials, residents of District 5…"
              />
            </div>

            <div>
              <FieldLabel sub="Measurable outcomes, budgets, compliance rates, timelines">
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
              <FieldLabel>Who supported / opposed it?</FieldLabel>
              <Textarea
                value={form.whoSupportedOpposed}
                onChange={setField("whoSupportedOpposed")}
                placeholder="e.g. EcoWaste Coalition supported. Junk shop operators in Payatas initially opposed due to reduced unsorted waste access."
              />
            </div>

            <div>
              <FieldLabel>What went wrong / risks / gaps</FieldLabel>
              <Textarea
                value={form.whatWentWrong}
                onChange={setField("whatWentWrong")}
                placeholder="e.g. Informal waste workers reported 15-30% income losses during transition. Enforcement was weak in Districts 3-6."
              />
            </div>

            <hr className="border-border-light" />

            {/* Model selection */}
            <div>
              <FieldLabel>Extraction Model</FieldLabel>
              <div className="flex gap-3">
                {(["qwen3:8b", "phi4:14b"] as const).map((m) => (
                  <label
                    key={m}
                    className={`flex flex-1 cursor-pointer items-start gap-3 rounded border p-3 transition-colors ${
                      model === m ? "border-accent bg-accent/5" : "border-border bg-surface hover:bg-surface/80"
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

            {/* Submit */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-light">
                <span className="text-accent">*</span> Required
              </p>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || ingestStatus.state === "submitting"}
                className={`px-5 py-2 text-sm font-medium transition-colors ${
                  canSubmit && ingestStatus.state !== "submitting"
                    ? "bg-accent text-white hover:bg-accent/90"
                    : "cursor-default bg-border-light text-muted-light"
                }`}
              >
                {ingestStatus.state === "submitting" ? "Ingesting…" : "Ingest into Graph"}
              </button>
            </div>
          </div>
        )}

        {/* ── Auto-Research Tab ─────────────────────────────────────── */}
        {tab === "research" && (
          <div className="px-6 py-8 space-y-6">
            <div className="rounded border border-border bg-surface/50 px-4 py-3 text-xs text-muted leading-relaxed">
              Search for a policy using SearXNG, then review and accept the AI-synthesized fields.
              Each field is verified against search sources by DeBERTa NLI. Accepted fields are
              transferred to Manual Entry for final review before ingestion.
            </div>

            {/* Search input */}
            <div>
              <FieldLabel>Search Query</FieldLabel>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="e.g. QC solid waste ordinance Barangay Commonwealth"
                  className="flex-1 border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-light focus:border-accent"
                />
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || researchStatus.state === "searching"}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    searchQuery.trim() && researchStatus.state !== "searching"
                      ? "bg-accent text-white hover:bg-accent/90"
                      : "cursor-default bg-border-light text-muted-light"
                  }`}
                >
                  {researchStatus.state === "searching" ? "Searching…" : "Search & Synthesize"}
                </button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-muted cursor-pointer">
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
              <div className="flex items-center gap-3 rounded border border-border-light bg-surface/50 px-4 py-3 text-sm text-muted">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                {researchStatus.step}
              </div>
            )}

            {/* Error */}
            {researchStatus.state === "error" && (
              <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span className="font-medium">Research failed:</span> {researchStatus.message}
              </div>
            )}

            {/* Results */}
            {researchStatus.state === "done" && researchResult && (
              <>
                {/* Sources */}
                <details className="rounded border border-border-light">
                  <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground/60 hover:bg-surface/50">
                    Sources ({researchResult.results.length} found)
                  </summary>
                  <div className="px-4 pb-3 pt-1 space-y-2">
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
                  <div className={`rounded border px-4 py-2.5 text-sm ${
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
                  <div className="rounded border border-border-light bg-surface/50 px-4 py-2.5 text-xs text-muted">
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
                <div className="flex items-center justify-between pt-2 border-t border-border-light">
                  <p className="text-xs text-muted-light">
                    {acceptedCount} of {RESEARCH_FIELDS.length} fields accepted
                  </p>
                  <button
                    onClick={handleUseAccepted}
                    disabled={acceptedCount === 0}
                    className={`px-5 py-2 text-sm font-medium transition-colors ${
                      acceptedCount > 0
                        ? "bg-accent text-white hover:bg-accent/90"
                        : "cursor-default bg-border-light text-muted-light"
                    }`}
                  >
                    Use Accepted Fields →
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
