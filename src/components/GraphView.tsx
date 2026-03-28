"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphNode, GraphEdge, GraphAPIResponse } from "@/lib/types";

// ── Color palettes ────────────────────────────────────────────────────────────

const NODE_COLORS: Record<GraphNode["type"], string> = {
  policy:      "#0d9488",
  location:    "#2563eb",
  stakeholder: "#d97706",
  outcome:     "#16a34a",
  event:       "#7c3aed",
  metric:      "#db2777",
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  conflicted_with: "#ef4444",
  opposed_by:      "#ef4444",
  supported_by:    "#16a34a",
  resulted_in:     "#16a34a",
  enacted_in:      "#2563eb",
  located_in:      "#2563eb",
  preceded:        "#7c3aed",
  measured_by:     "#db2777",
  affected:        "#78716c",
  related_to:      "#78716c",
};

// ── Sub-components ────────────────────────────────────────────────────────────


interface DocRow {
  id: string;
  title: string;
  source_type: string;
}

type Selection =
  | { kind: "node"; data: GraphNode }
  | { kind: "edge"; data: GraphEdge; sourceName: string; targetName: string }
  | null;

function NodeCard({
  node,
  docs,
  onClose,
}: {
  node: GraphNode;
  docs: DocRow[];
  onClose: () => void;
}) {
  const color = NODE_COLORS[node.type] ?? "#78716c";
  const sourceDoc = docs.find((d) => d.id === node.source_doc_id);
  let meta: Record<string, unknown> = {};
  try { if (node.metadata) meta = JSON.parse(node.metadata); } catch { /* ignore */ }

  return (
    <aside className="absolute bottom-4 right-4 w-72 rounded-lg border border-border bg-surface shadow-lg overflow-hidden z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {node.type}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted hover:text-foreground transition-colors leading-none"
        >
          ✕
        </button>
      </div>
      <div className="px-4 py-4 space-y-3 max-h-80 overflow-y-auto">
        <h3 className="font-serif font-semibold text-foreground text-sm leading-snug">
          {node.name}
        </h3>
        {node.description && (
          <p className="text-xs text-muted leading-relaxed">{node.description}</p>
        )}
        {Object.keys(meta).length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-light mb-1.5">
              Metadata
            </p>
            <dl className="space-y-1">
              {Object.entries(meta).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <dt className="shrink-0 w-24 truncate text-muted-light">{k}</dt>
                  <dd className="text-foreground break-words">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {sourceDoc && (
          <div className="border-t border-border-light pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-light mb-1">
              Source Document
            </p>
            <p className="text-xs text-foreground">{sourceDoc.title}</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function EdgeCard({
  edge,
  sourceName,
  targetName,
  onClose,
}: {
  edge: GraphEdge;
  sourceName: string;
  targetName: string;
  onClose: () => void;
}) {
  const color = RELATIONSHIP_COLORS[edge.relationship] ?? "#78716c";
  const weight = edge.weight ?? 1;
  let meta: Record<string, unknown> = {};
  try { if (edge.metadata) meta = JSON.parse(edge.metadata); } catch { /* ignore */ }

  return (
    <aside className="absolute bottom-4 right-4 w-72 rounded-lg border border-border bg-surface shadow-lg overflow-hidden z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Relationship
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted hover:text-foreground transition-colors leading-none"
        >
          ✕
        </button>
      </div>
      <div className="px-4 py-4 space-y-3">
        <h3 className="font-serif font-semibold text-foreground text-sm">
          {edge.relationship.replace(/_/g, " ")}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="font-medium text-foreground truncate max-w-[90px]">{sourceName}</span>
          <span className="text-muted">→</span>
          <span className="font-medium text-foreground truncate max-w-[90px]">{targetName}</span>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-light mb-1.5">
            Confidence
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-border-light">
              <div
                className="h-full rounded-full"
                style={{ width: `${weight * 100}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted">{(weight * 100).toFixed(0)}%</span>
          </div>
        </div>
        {Object.keys(meta).length > 0 && (
          <dl className="space-y-1">
            {Object.entries(meta).map(([k, v]) => (
              <div key={k} className="flex gap-2 text-xs">
                <dt className="shrink-0 w-24 truncate text-muted-light">{k}</dt>
                <dd className="text-foreground break-words">{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </aside>
  );
}

function GraphLegend() {
  const entries = Object.entries(NODE_COLORS) as [GraphNode["type"], string][];
  return (
    <div className="absolute bottom-4 left-4 rounded-lg border border-border bg-surface/90 backdrop-blur-sm px-3 py-2.5 z-10">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-light mb-2">
        Node Types
      </p>
      <ul className="space-y-1">
        {entries.map(([type, color]) => (
          <li key={type} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-foreground capitalize">{type}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main GraphView ────────────────────────────────────────────────────────────

interface GraphViewProps {
  docs: DocRow[];
  docId?: string;
}

// Shape that react-force-graph mutates after simulation (source/target become node objects)
interface FGNode extends GraphNode {
  x?: number;
  y?: number;
}
interface FGLink extends GraphEdge {
  source: string | FGNode;
  target: string | FGNode;
}

export default function GraphView({ docs, docId }: GraphViewProps) {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Fetch graph data
  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelection(null);
    const url = docId ? `/api/graph?doc_id=${encodeURIComponent(docId)}` : "/api/graph";
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json() as Promise<GraphAPIResponse>;
      })
      .then((data) => {
        setGraphData({ nodes: data.nodes, edges: data.edges });
        setTruncated(data.truncated);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [docId]);

  // Track container size for canvas sizing — measure eagerly on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setDimensions({ width: Math.floor(width), height: Math.floor(height) });
      }
    };

    // Measure immediately
    measure();

    const obs = new ResizeObserver(() => measure());
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // react-force-graph expects { nodes: [...], links: [...] } with source/target fields
  const fgData = useMemo(() => ({
    nodes: (graphData?.nodes ?? []).map((n) => ({ ...n })),
    links: (graphData?.edges ?? []).map((e) => ({ ...e, source: e.source_id, target: e.target_id })),
  }), [graphData]);

  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    graphData?.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [graphData]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((node: any) => {
    setSelection({ kind: "node", data: node as GraphNode });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLinkClick = useCallback((link: any) => {
    const l = link as FGLink;
    const srcId = typeof l.source === "string" ? l.source : l.source.id;
    const tgtId = typeof l.target === "string" ? l.target : l.target.id;
    const sourceName = nodeById.get(srcId)?.name ?? srcId;
    const targetName = nodeById.get(tgtId)?.name ?? tgtId;
    setSelection({ kind: "edge", data: l as GraphEdge, sourceName, targetName });
  }, [nodeById]);

  // Canvas node painter — filled circle + soft shadow + label
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as FGNode & GraphNode;
    const color = NODE_COLORS[n.type] ?? "#78716c";
    const isSelected = selection?.kind === "node" && selection.data.id === n.id;
    const r = isSelected ? 7 : 5;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = isSelected ? 12 : 6;
    ctx.beginPath();
    ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(n.x ?? 0, n.y ?? 0, r + 2, 0, 2 * Math.PI);
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // Label — always show at default zoom, full name at zoom > 1.5
    const label = globalScale >= 1.5 ? n.name : n.name.slice(0, 14) + (n.name.length > 14 ? "…" : "");
    const fontSize = Math.max(10 / globalScale, 3);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = "#1c1917";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, n.x ?? 0, (n.y ?? 0) + r + 2 / globalScale);
  }, [selection]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const n = node as FGNode;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(n.x ?? 0, n.y ?? 0, 8, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkColorFn = useCallback((link: any) => {
    const rel = (link as FGLink).relationship;
    const base = RELATIONSHIP_COLORS[rel] ?? "#78716c";
    return base + "88"; // 53% opacity
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkWidthFn = useCallback((link: any) => {
    return ((link as GraphEdge).weight ?? 1) * 1.5;
  }, []);

  const ready = !loading && !error && graphData && graphData.nodes.length > 0 && dimensions;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#fafaf9]">
      {loading && (
        <div className="flex h-full w-full items-center justify-center gap-3 text-sm text-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading graph…
        </div>
      )}

      {error && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 max-w-sm text-center">
            <span className="font-medium">Failed to load graph:</span> {error}
          </div>
        </div>
      )}

      {!loading && !error && (!graphData || graphData.nodes.length === 0) && (
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-sm text-muted-light">No graph data yet. Ingest some documents first.</p>
        </div>
      )}

      {ready && (
        <>
          {truncated && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-800 text-center">
              Showing first 500 nodes. Use document filter for a focused view.
            </div>
          )}

          <ForceGraph2D
            backgroundColor="#fafaf9"
            width={dimensions.width}
            height={dimensions.height}
            graphData={fgData}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkColor={linkColorFn}
            linkWidth={linkWidthFn}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            onNodeClick={handleNodeClick}
            onLinkClick={handleLinkClick}
            onBackgroundClick={() => setSelection(null)}
            cooldownTicks={100}
            warmupTicks={50}
            d3AlphaDecay={0.02}
            nodeLabel=""
          />

          <GraphLegend />

          {selection?.kind === "node" && (
            <NodeCard
              node={selection.data}
              docs={docs}
              onClose={() => setSelection(null)}
            />
          )}
          {selection?.kind === "edge" && (
            <EdgeCard
              edge={selection.data}
              sourceName={selection.sourceName}
              targetName={selection.targetName}
              onClose={() => setSelection(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
