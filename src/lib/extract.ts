// src/lib/extract.ts
import type { Env, ExtractedGraph } from './types';
import { callLLM, getEmbedding } from './llm';

// Cosine similarity threshold above which two nodes are considered the same entity.
// 0.87 avoids false positives between related-but-distinct concepts while catching
// genuine duplicates like "Quezon City" vs "QC Metro Manila".
const RESOLUTION_THRESHOLD = 0.87;

const EXTRACTION_SYSTEM_PROMPT = `You are a policy analysis expert specializing in Philippine urban governance. Given a document about urban policy in Quezon City, Metro Manila, extract structured entities and relationships.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation, just the JSON object:

{
  "nodes": [
    {
      "id": "unique-kebab-case-id",
      "type": "policy|location|stakeholder|outcome|event|metric",
      "name": "Human readable name",
      "description": "1-2 sentence description",
      "metadata": { "year": 2023, "budget_php": 5000000 }
    }
  ],
  "edges": [
    {
      "source_id": "node-id-from-above",
      "target_id": "another-node-id-from-above",
      "relationship": "enacted_in|affected|resulted_in|conflicted_with|supported_by|opposed_by|measured_by|located_in|preceded|related_to",
      "metadata": { "detail": "brief explanation of this relationship" }
    }
  ]
}

NODE TYPE GUIDELINES:
- "policy": Any ordinance, executive order, program, initiative, regulation, or law. Include the ordinance number if available.
- "location": Barangays, districts, streets, landmarks, zones. Use official names. QC has 142 barangays grouped into 6 districts.
- "stakeholder": Groups affected — residents, vendors, junk shop operators, informal waste workers, businesses, transport operators (jeepney/tricycle), NGOs, LGU offices, barangay officials, homeowner associations.
- "outcome": Measurable results — waste reduction percentages, revenue changes, traffic improvements, complaint volumes, satisfaction surveys, health indicators.
- "event": Specific incidents — floods, protests, policy launches, disasters, elections that affected policy.
- "metric": Quantitative measurements — specific budget figures in PHP, percentages, population counts, tonnage, area in hectares.

EDGE TYPE GUIDELINES:
- "enacted_in": policy was implemented in a specific location
- "affected": policy impacted a stakeholder group (positive or negative)
- "resulted_in": policy caused a measurable outcome
- "conflicted_with": policy contradicted or undermined another policy
- "supported_by": stakeholder publicly supported the policy
- "opposed_by": stakeholder publicly opposed or resisted the policy
- "measured_by": outcome is quantified by a specific metric
- "located_in": a stakeholder or event is in a specific location
- "preceded": one policy came before and influenced another (temporal chain)
- "related_to": generic connection when none of the above fit precisely

CRITICAL RULES:
- Extract ALL entities and relationships you can find. Be thorough and exhaustive.
- Include NEGATIVE outcomes and OPPOSITION, not just positive results. Real policies have trade-offs.
- Node IDs must be unique kebab-case strings.
- Every edge must reference node IDs that exist in the nodes array.
- If the document mentions specific Philippine peso amounts, dates, percentages, or statistics, capture them in metadata.
- Consider Philippine-specific context: barangay governance, informal economy, wet/dry seasons, flooding, jeepney/tricycle transport.`;

export async function extractEntities(
  env: Env,
  documentText: string,
  docId: string,
  modelOverride?: string,
  noFallback?: boolean
): Promise<ExtractedGraph> {
  const prompt = `Extract all policy entities and relationships from this document about Quezon City:\n\n---\n${documentText}\n---`;

  const result = await callLLM(env, prompt, EXTRACTION_SYSTEM_PROMPT, {
    temperature: 0.2,
    format: 'json',
    modelOverride,
    noFallback,
  });

  try {
    // Slice from first { to last } to handle preamble text and markdown fences
    const jsonStart = result.indexOf('{');
    const jsonEnd = result.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON object found in LLM response');
    const parsed: ExtractedGraph = JSON.parse(result.slice(jsonStart, jsonEnd + 1));

    // Tag all nodes with their source document
    parsed.nodes = parsed.nodes.map((n) => ({ ...n, source_doc_id: docId }));

    // Validate edge references
    const nodeIds = new Set(parsed.nodes.map((n) => n.id));
    parsed.edges = parsed.edges.filter((e) => {
      const valid = nodeIds.has(e.source_id) && nodeIds.has(e.target_id);
      if (!valid) {
        console.warn(`Dropping edge with invalid reference: ${e.source_id} -> ${e.target_id}`);
      }
      return valid;
    });

    return parsed;
  } catch (parseError) {
    console.error('Failed to parse extraction result:', result.substring(0, 500));
    return { nodes: [], edges: [] };
  }
}

/**
 * Resolves newly extracted nodes against the existing knowledge base using
 * vector similarity. When a new node is sufficiently similar to an existing
 * node of the same type (score >= RESOLUTION_THRESHOLD), the existing node's
 * ID is used as the canonical ID so both documents share the same graph node.
 *
 * Also returns a pre-computed embedding cache keyed by canonical node ID so
 * the caller can skip re-embedding during the Vectorize upsert step.
 */
export async function resolveEntities(
  env: Env,
  nodes: ExtractedGraph['nodes'],
  edges: ExtractedGraph['edges'],
): Promise<{
  nodes: ExtractedGraph['nodes'];
  edges: ExtractedGraph['edges'];
  embeddingCache: Map<string, number[]>;
}> {
  // original LLM-generated id -> canonical (existing or kept) id
  const idMap = new Map<string, string>();
  // canonical id -> embedding (reused for Vectorize upsert to avoid double-computing)
  const embeddingCache = new Map<string, number[]>();

  for (const node of nodes) {
    const textToEmbed = `${node.type}: ${node.name}. ${node.description ?? ''}`;
    const embedding = await getEmbedding(env, textToEmbed);

    // Query Vectorize for the closest existing nodes
    const results = await env.VECTOR_INDEX.query(embedding, {
      topK: 3,
      returnMetadata: 'all',
    });

    // Accept the top match only if it's the same node type and above threshold
    const match = results.matches.find(
      (m) =>
        m.score >= RESOLUTION_THRESHOLD &&
        (m.metadata as Record<string, string> | null)?.type === node.type,
    );

    const canonicalId = match ? match.id : node.id;
    idMap.set(node.id, canonicalId);

    // Cache the embedding under the canonical ID (first one wins if multiple
    // new nodes collapse to the same canonical)
    if (!embeddingCache.has(canonicalId)) {
      embeddingCache.set(canonicalId, embedding);
    }
  }

  // Remap node IDs to canonical — deduplicate if multiple new nodes merged into one
  const seen = new Set<string>();
  const resolvedNodes = nodes
    .map((n) => ({ ...n, id: idMap.get(n.id) ?? n.id }))
    .filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });

  // Remap edge endpoints and drop any self-loops that merging may have created
  const resolvedEdges = edges
    .map((e) => ({
      ...e,
      source_id: idMap.get(e.source_id) ?? e.source_id,
      target_id: idMap.get(e.target_id) ?? e.target_id,
    }))
    .filter((e) => e.source_id !== e.target_id);

  const mergedCount = nodes.length - resolvedNodes.length;
  if (mergedCount > 0) {
    console.log(`[resolveEntities] merged ${mergedCount} node(s) into existing canonical nodes`);
  }

  return { nodes: resolvedNodes, edges: resolvedEdges, embeddingCache };
}
