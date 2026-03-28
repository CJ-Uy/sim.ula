// src/lib/extract.ts
import type { Env, ExtractedGraph } from './types';
import { callLLM } from './llm';

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
  modelOverride?: string
): Promise<ExtractedGraph> {
  const prompt = `Extract all policy entities and relationships from this document about Quezon City:\n\n---\n${documentText}\n---`;

  const result = await callLLM(env, prompt, EXTRACTION_SYSTEM_PROMPT, {
    temperature: 0.2,
    format: 'json',
    modelOverride,
  });

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed: ExtractedGraph = JSON.parse(cleaned);

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
