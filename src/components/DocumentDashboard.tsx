"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { BASE_POLICY_TYPES, getCustomTypes, saveCustomTypes } from "@/lib/policyTypes";

// ssr: false ensures react-force-graph-2d (canvas/WebGL) never enters the Worker bundle
const GraphView = dynamic(() => import("./GraphView"), { ssr: false });

interface DocRow {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  date_published: string | null;
  ingested_at: string | null;
  node_count: number;
}

type DeleteState = "idle" | "confirming" | "deleting";

function SourceTypePill({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ordinance: "bg-blue-50 text-blue-700 border-blue-200",
    study: "bg-purple-50 text-purple-700 border-purple-200",
    news: "bg-yellow-50 text-yellow-700 border-yellow-200",
    report: "bg-green-50 text-green-700 border-green-200",
    synthetic: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${colors[type] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {type}
    </span>
  );
}

function DocRow({
  doc,
  onDeleted,
}: {
  doc: DocRow;
  onDeleted: (id: string) => void;
}) {
  const [state, setState] = useState<DeleteState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setState("deleting");
    setError(null);
    try {
      const res = await fetch(`/api/docs/${doc.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Server returned ${res.status}`);
      }
      onDeleted(doc.id);
    } catch (err) {
      setError(String(err));
      setState("idle");
    }
  };

  const ingestedDate = doc.ingested_at
    ? new Date(doc.ingested_at).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="flex items-start justify-between gap-4 rounded border border-border bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground truncate">{doc.title}</span>
          <SourceTypePill type={doc.source_type} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-light">
          <span>{doc.node_count} nodes</span>
          {doc.date_published && <span>Published: {doc.date_published}</span>}
          <span>Ingested: {ingestedDate}</span>
          <span className="font-mono opacity-60">{doc.id}</span>
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {doc.source_url && (
          <a
            href={doc.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Source ↗
          </a>
        )}

        {state === "idle" && (
          <button
            onClick={() => setState("confirming")}
            className="text-xs px-3 py-1.5 rounded border border-border text-muted hover:border-red-300 hover:text-red-600 transition-colors"
          >
            Delete
          </button>
        )}
        {state === "confirming" && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-600 font-medium">Remove all nodes?</span>
            <button
              onClick={handleDelete}
              className="text-xs px-2.5 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
            >
              Yes, delete
            </button>
            <button
              onClick={() => setState("idle")}
              className="text-xs px-2.5 py-1 rounded border border-border text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        {state === "deleting" && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Deleting…
          </div>
        )}
      </div>
    </div>
  );
}

// ── Policy Type Manager ───────────────────────────────────────────────────────

function PolicyTypesManager() {
  const [custom, setCustom] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setCustom(getCustomTypes());
  }, []);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const all = [...BASE_POLICY_TYPES as readonly string[], ...custom];
    if (all.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setErr("Already exists");
      return;
    }
    const updated = [...custom, trimmed];
    setCustom(updated);
    saveCustomTypes(updated);
    setInput("");
    setErr(null);
  };

  const handleRemove = (type: string) => {
    const updated = custom.filter((t) => t !== type);
    setCustom(updated);
    saveCustomTypes(updated);
  };

  return (
    <div className="rounded border border-border bg-surface">
      <div className="border-b border-border-light px-4 py-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/70">
          Policy Types
        </h3>
        <p className="mt-0.5 text-xs text-muted-light">
          Types available in the Add Data form. Built-in types cannot be removed.
        </p>
      </div>

      <div className="px-4 py-3 space-y-1">
        {(BASE_POLICY_TYPES as readonly string[]).map((t) => (
          <div key={t} className="py-1">
            <span className="text-sm text-foreground">{t}</span>
          </div>
        ))}

        {custom.map((t) => (
          <div key={t} className="flex items-center justify-between py-1">
            <span className="text-sm text-foreground">{t}</span>
            <button
              onClick={() => handleRemove(t)}
              className="text-[11px] text-muted hover:text-red-600 transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-border-light px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setErr(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="e.g. Memorandum Circular"
            className="flex-1 border border-border bg-background px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-light focus:border-accent"
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              input.trim() ? "bg-accent text-white hover:bg-accent/90" : "bg-border-light text-muted-light cursor-default"
            }`}
          >
            Add
          </button>
        </div>
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

interface DocumentDashboardProps {
  onBack: () => void;
}

export default function DocumentDashboard({ onBack }: DocumentDashboardProps) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/docs");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setDocs((await res.json()) as DocRow[]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleDeleted = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="flex h-full flex-col" style={{ animation: "fade-in 300ms ease" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-light bg-surface px-6 py-4">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">Knowledge Base</h2>
          <p className="text-xs text-muted">
            {loading ? "Loading…" : `${docs.length} document${docs.length !== 1 ? "s" : ""} ingested`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDocs}
            disabled={loading}
            className="text-xs text-muted hover:text-foreground transition-colors disabled:opacity-40"
          >
            ↺ Refresh
          </button>
          <button
            onClick={onBack}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Body — single scrollable page: graph on top, documents below */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Graph section */}
        <div className="h-[50vh] min-h-[400px] border-b border-border-light">
          <GraphView docs={docs} />
        </div>

        {/* Documents section */}
        <div className="px-6 py-6">
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-foreground/70">
            Documents
          </h3>

          {loading && (
            <div className="flex items-center gap-3 text-sm text-muted py-8 justify-center">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Loading documents…
            </div>
          )}

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="font-medium">Failed to load:</span> {error}
            </div>
          )}

          {!loading && !error && docs.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-light">
              No documents ingested yet.
            </div>
          )}

          {!loading && docs.length > 0 && (
            <div className="space-y-2">
              {docs.map((doc) => (
                <DocRow key={doc.id} doc={doc} onDeleted={handleDeleted} />
              ))}
            </div>
          )}

          <div className="mt-8">
            <PolicyTypesManager />
          </div>
        </div>
      </div>
    </div>
  );
}
