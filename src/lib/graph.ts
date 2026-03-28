// src/lib/graph.ts
import { sql, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getEmbedding } from './llm';
import type { Env, GraphNode, GraphEdgeWithNames, GraphContext } from './types';

/**
 * The core GraphRAG retrieval pipeline:
 * 1. Vector search  → find semantically similar nodes (entry points)
 * 2. Graph traversal → walk along edges to collect related context (recursive CTE)
 * 3. Flatten         → produce readable text for LLM consumption
 */
export async function queryGraph(
  env: Env,
  queryText: string,
  maxDepth = 2,
  topK = 5
): Promise<GraphContext> {
  const db = getDb(env);

  // ── Step 1: Vector search for entry points ──────────────────────────────
  // Best-effort — if Vectorize is unavailable (e.g. local dev), fall back to
  // an empty context so the simulation still runs without graph precedents.
  let entryNodeIds: string[] = [];
  try {
    const queryEmbedding = await getEmbedding(env, queryText);
    const vectorResults = await env.VECTOR_INDEX.query(queryEmbedding, {
      topK,
      returnMetadata: 'all',
    });
    entryNodeIds = vectorResults.matches.map((m) => m.id);
  } catch {
    console.warn('[queryGraph] Vector search unavailable — returning empty context');
  }

  if (entryNodeIds.length === 0) {
    return {
      entry_nodes: [],
      related_nodes: [],
      edges: [],
      context_text:
        'No relevant historical data found in the knowledge base for this query.',
    };
  }

  // ── Step 2: Fetch entry nodes via Drizzle ───────────────────────────────
  const entryNodes = await db
    .select()
    .from(schema.nodes)
    .where(inArray(schema.nodes.id, entryNodeIds))
    .all() as GraphNode[];

  // ── Step 3: Graph traversal via recursive CTE ───────────────────────────
  // Walk outward from entry nodes in BOTH directions up to maxDepth hops.
  // Drizzle doesn't generate recursive CTEs natively, so we use the sql tag.
  const placeholders = entryNodeIds.map(() => '?').join(',');

  const traversalResult = await env.DB.prepare(`
    WITH RECURSIVE related AS (
      SELECT target_id AS node_id, 1 AS depth
      FROM edges WHERE source_id IN (${placeholders})
      UNION ALL
      SELECT source_id AS node_id, 1 AS depth
      FROM edges WHERE target_id IN (${placeholders})
      UNION ALL
      SELECT e.target_id, r.depth + 1
      FROM edges e JOIN related r ON e.source_id = r.node_id
      WHERE r.depth < ?
      UNION ALL
      SELECT e.source_id, r.depth + 1
      FROM edges e JOIN related r ON e.target_id = r.node_id
      WHERE r.depth < ?
    )
    SELECT DISTINCT n.id, n.type, n.name, n.description, n.metadata, n.source_doc_id
    FROM nodes n
    JOIN related r ON n.id = r.node_id
    WHERE n.id NOT IN (${placeholders})
    LIMIT 40
  `)
    .bind(...entryNodeIds, ...entryNodeIds, maxDepth, maxDepth, ...entryNodeIds)
    .all<GraphNode>();

  const relatedNodes = traversalResult.results;

  // ── Step 4: Fetch all edges between the combined node set ───────────────
  const allNodeIds = [
    ...entryNodes.map((n) => n.id),
    ...relatedNodes.map((n) => n.id),
  ];

  let edges: GraphEdgeWithNames[] = [];

  if (allNodeIds.length > 0) {
    const allPh = allNodeIds.map(() => '?').join(',');
    const edgeResult = await env.DB.prepare(`
      SELECT
        e.id, e.source_id, e.target_id, e.relationship, e.weight, e.metadata,
        ns.name AS source_name, nt.name AS target_name
      FROM edges e
      JOIN nodes ns ON e.source_id = ns.id
      JOIN nodes nt ON e.target_id = nt.id
      WHERE e.source_id IN (${allPh}) OR e.target_id IN (${allPh})
    `)
      .bind(...allNodeIds, ...allNodeIds)
      .all<GraphEdgeWithNames>();

    edges = edgeResult.results;
  }

  // ── Step 5: Flatten into readable context for LLM ──────────────────────
  const contextParts: string[] = [];

  contextParts.push('## Directly Relevant Policies and Entities');
  contextParts.push('(These matched the query most closely)');
  for (const node of entryNodes) {
    const meta = node.metadata ? JSON.parse(node.metadata) : {};
    const metaStr =
      Object.keys(meta).length > 0 ? ` | Metadata: ${JSON.stringify(meta)}` : '';
    contextParts.push(
      `- [${node.type.toUpperCase()}] ${node.name}: ${node.description ?? 'No description'}${metaStr}`
    );
  }

  if (relatedNodes.length > 0) {
    contextParts.push('\n## Related Entities (discovered via graph connections)');
    for (const node of relatedNodes) {
      const meta = node.metadata ? JSON.parse(node.metadata) : {};
      const metaStr =
        Object.keys(meta).length > 0 ? ` | Metadata: ${JSON.stringify(meta)}` : '';
      contextParts.push(
        `- [${node.type.toUpperCase()}] ${node.name}: ${node.description ?? 'No description'}${metaStr}`
      );
    }
  }

  if (edges.length > 0) {
    contextParts.push('\n## Documented Relationships');
    for (const edge of edges) {
      const meta = edge.metadata ? JSON.parse(edge.metadata) : {};
      const detail = meta.detail ? ` — ${meta.detail}` : '';
      contextParts.push(
        `- "${edge.source_name}" --[${edge.relationship}]--> "${edge.target_name}"${detail}`
      );
    }
  }

  return {
    entry_nodes: entryNodes,
    related_nodes: relatedNodes,
    edges,
    context_text: contextParts.join('\n'),
  };
}

// ── Transferability Chain ───────────────────────────────────────────────────

export interface TransferabilityChain {
  path: Array<{ id: string; name: string }>;
  edges: Array<{ source: string; target: string; weight: number; basis: string }>;
  score: number; // Product of weights along the path (0-1)
}

/**
 * Find the highest-weight proximity chain path from a source city to Quezon City.
 * Uses BFS over proximity_chain edges, tracking the best (highest product-of-weights) path.
 */
export async function findTransferabilityChain(
  env: Env,
  fromCityId: string,
  toCityId: string = 'quezon-city',
): Promise<TransferabilityChain | null> {
  if (fromCityId === toCityId) {
    return { path: [{ id: toCityId, name: 'Quezon City' }], edges: [], score: 1.0 };
  }

  // Fetch all proximity_chain edges
  const chainEdges = await env.DB.prepare(`
    SELECT source_id, target_id, weight, metadata
    FROM edges WHERE relationship = 'proximity_chain'
  `).all<{ source_id: string; target_id: string; weight: number; metadata: string | null }>();

  // Build adjacency list (bidirectional)
  const adj = new Map<string, Array<{ neighbor: string; weight: number; basis: string }>>();
  for (const edge of chainEdges.results) {
    let basis = '';
    try { basis = JSON.parse(edge.metadata ?? '{}').basis ?? ''; } catch {}

    if (!adj.has(edge.source_id)) adj.set(edge.source_id, []);
    if (!adj.has(edge.target_id)) adj.set(edge.target_id, []);
    adj.get(edge.source_id)!.push({ neighbor: edge.target_id, weight: edge.weight, basis });
    adj.get(edge.target_id)!.push({ neighbor: edge.source_id, weight: edge.weight, basis });
  }

  // BFS with best-score tracking (maximize product of weights)
  interface QueueItem {
    nodeId: string;
    path: string[];
    edgeWeights: Array<{ source: string; target: string; weight: number; basis: string }>;
    score: number;
  }

  const queue: QueueItem[] = [{
    nodeId: fromCityId,
    path: [fromCityId],
    edgeWeights: [],
    score: 1.0,
  }];

  const bestScore = new Map<string, number>();
  bestScore.set(fromCityId, 1.0);

  let bestChain: QueueItem | null = null;

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.nodeId === toCityId) {
      if (!bestChain || current.score > bestChain.score) {
        bestChain = current;
      }
      continue;
    }

    const neighbors = adj.get(current.nodeId) ?? [];
    for (const { neighbor, weight, basis } of neighbors) {
      if (current.path.includes(neighbor)) continue; // No cycles

      const newScore = current.score * weight;
      const prevBest = bestScore.get(neighbor) ?? 0;
      if (newScore <= prevBest) continue; // Already found a better path

      bestScore.set(neighbor, newScore);
      queue.push({
        nodeId: neighbor,
        path: [...current.path, neighbor],
        edgeWeights: [...current.edgeWeights, {
          source: current.nodeId,
          target: neighbor,
          weight,
          basis,
        }],
        score: newScore,
      });
    }
  }

  if (!bestChain) return null;

  // Fetch node names for the path
  const db = getDb(env);
  const pathNodes = await db
    .select({ id: schema.nodes.id, name: schema.nodes.name })
    .from(schema.nodes)
    .where(inArray(schema.nodes.id, bestChain.path))
    .all();

  const nameMap = new Map(pathNodes.map((n) => [n.id, n.name]));

  return {
    path: bestChain.path.map((id) => ({ id, name: nameMap.get(id) ?? id })),
    edges: bestChain.edgeWeights,
    score: bestChain.score,
  };
}
