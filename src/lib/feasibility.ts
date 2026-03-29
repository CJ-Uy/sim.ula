// src/lib/feasibility.ts
// Chain-of-thought feasibility assessment using proximity chains.
//
// Approach:
//   1. From the graph context's entry nodes, find which real cities enacted similar policies
//   2. For each source city, find the transferability chain → Quezon City
//   3. Build a chain-of-thought prompt that walks the LLM through each hop
//   4. LLM reasons about institutional gaps, infrastructure deltas, and political will
//      at each hop to produce a structured feasibility assessment

import { callLLM } from './llm';
import { findTransferabilityChain } from './graph';
import { getDb, schema } from '@/db';
import { inArray, eq } from 'drizzle-orm';
import type { Env, GraphContext, FeasibilityResult, FeasibilityPrecedentChain } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChainItem {
  policyId: string;
  policyName: string;
  policyDescription: string | null;
  cityId: string;
  cityName: string;
  transferability_score: number;
  chain: Array<{ from: string; to: string; weight: number; basis: string }>;
}

// ── Build Feasibility Context ─────────────────────────────────────────────────

/**
 * From a GraphContext, find which cities enacted the matched policies and
 * build transferability chains from those cities to Quezon City.
 */
export async function buildFeasibilityContext(
  env: Env,
  graphContext: GraphContext,
): Promise<ChainItem[]> {
  const db = getDb(env);

  // Only consider policy-type entry nodes
  const policyNodes = graphContext.entry_nodes.filter((n) => n.type === 'policy');
  if (policyNodes.length === 0) return [];

  const policyIds = policyNodes.map((n) => n.id);

  // Find enacted_in edges for these policies (one query)
  const enactedEdges = await db
    .select({
      source_id: schema.edges.source_id,
      target_id: schema.edges.target_id,
    })
    .from(schema.edges)
    .where(
      inArray(schema.edges.source_id, policyIds),
    )
    .all();

  // Filter to enacted_in relationship — check metadata for city targets
  // Also fetch all location nodes that are targets to confirm they are cities
  const targetIds = enactedEdges.map((e) => e.target_id);
  if (targetIds.length === 0) return [];

  const locationNodes = await db
    .select({ id: schema.nodes.id, name: schema.nodes.name, type: schema.nodes.type })
    .from(schema.nodes)
    .where(inArray(schema.nodes.id, targetIds))
    .all();

  const locationSet = new Map(locationNodes.map((n) => [n.id, n.name]));

  // Build map: policyId → cityId
  const policyToCity = new Map<string, string>();
  for (const edge of enactedEdges) {
    if (locationSet.has(edge.target_id)) {
      policyToCity.set(edge.source_id, edge.target_id);
    }
  }

  // Deduplicate: one chain per unique city
  const citySet = new Set(policyToCity.values());
  const cityIds = [...citySet].filter((id) => id !== 'quezon-city');

  if (cityIds.length === 0) return [];

  // Run transferability chain lookups in parallel
  const chains = await Promise.all(
    cityIds.map((cityId) => findTransferabilityChain(env, cityId, 'quezon-city')),
  );

  // Assemble ChainItems
  const items: ChainItem[] = [];
  for (const policyNode of policyNodes) {
    const cityId = policyToCity.get(policyNode.id);
    if (!cityId || cityId === 'quezon-city') continue;

    const idx = cityIds.indexOf(cityId);
    const chainResult = chains[idx];
    if (!chainResult) continue;

    items.push({
      policyId: policyNode.id,
      policyName: policyNode.name,
      policyDescription: policyNode.description,
      cityId,
      cityName: locationSet.get(cityId) ?? cityId,
      transferability_score: chainResult.score,
      chain: chainResult.edges.map((e) => ({
        from: chainResult.path[chainResult.edges.indexOf(e)]?.name ?? e.source,
        to: chainResult.path[chainResult.edges.indexOf(e) + 1]?.name ?? e.target,
        weight: e.weight,
        basis: e.basis,
      })),
    });
  }

  // Sort: highest transferability first
  items.sort((a, b) => b.transferability_score - a.transferability_score);
  return items;
}

// ── Feasibility System Prompt ─────────────────────────────────────────────────

const FEASIBILITY_SYSTEM_PROMPT = `You are a policy transfer analyst for Quezon City, Metro Manila, Philippines. Your job is to assess whether a proposed urban policy is feasible for Quezon City, based on how similar policies have traveled from other cities through geographic and institutional proximity chains.

You will receive:
1. A proposed policy
2. A target location in Quezon City
3. A set of precedent chains — each showing a similar policy enacted in another city, the transferability path from that city to Quezon City (with edge weights and basis types), and known outcomes

Your job is to reason through each chain step-by-step and produce a structured feasibility assessment.

CHAIN-OF-THOUGHT REASONING FRAMEWORK:
For each precedent city, reason through:
- What institutional capacity does that city have that Quezon City lacks?
- What infrastructure gaps exist at each hop in the chain?
- How does governance style change along the chain (e.g., centralized → fragmented MMDA jurisdiction)?
- What cultural/economic adaptations are needed at each hop?
- What is the "friction" that would erode transferability?

SCORING:
- overall_score: 0–100. Ground this in the transferability_scores (product of chain weights) weighted by how well QC matches the target city's context.
  - 0–25: Not Feasible (fundamental structural mismatches)
  - 26–50: Challenging (significant barriers, possible with major overhaul)
  - 51–75: Feasible (manageable barriers, clear adaptation path)
  - 76–100: Highly Feasible (strong precedent, short chain, high institutional similarity)
- If no precedent chains exist, use general knowledge of QC governance context and lower the score by 15 points.

QUEZON CITY CONTEXT:
- Fragmented traffic authority: MMDA governs major roads (EDSA, C-5), QC LGU governs local roads
- Strong barangay governance network (142 barangays) — useful for ground-level enforcement
- Informal economy dependence: tricycle/jeepney operators are organized and politically vocal
- Tech adoption: QC has a functioning city portal, CCTV network, and GIS office
- Budget constraints: Annual QC budget ~PHP 24B; large infrastructure requires national or PPP funding
- Election cycles: 3-year terms create short political windows for multi-year projects
- Public trust: Surveillance tech faces scrutiny from civil society groups

Return ONLY valid JSON (no markdown) matching this exact schema:
{
  "overall_score": 65,
  "overall_label": "Feasible",
  "reasoning": "Step-by-step chain-of-thought narrative explaining your scoring...",
  "precedent_chains": [
    {
      "city_name": "Singapore",
      "city_id": "singapore",
      "policy_name": "SCATS Adaptive Traffic Control",
      "outcome_summary": "25% reduction in average travel time on arterial roads",
      "chain": [{ "from": "Singapore", "to": "Manila", "weight": 0.68, "basis": "economic" }, { "from": "Manila", "to": "Quezon City", "weight": 0.92, "basis": "geographic" }],
      "transferability_score": 0.63,
      "key_adaptations": ["Replace centralized LTA authority with MMDA-QC coordination MOA", "Add vendor support for mixed vehicle types including jeepneys"]
    }
  ],
  "stakeholder_readiness": [
    { "stakeholder": "MMDA Traffic Engineering Center", "readiness": "cautious", "key_concern": "Jurisdiction overlap with QC LGU on city roads" },
    { "stakeholder": "Jeepney/Tricycle Operators (TODA)", "readiness": "resistant", "key_concern": "Fear that AI control will reduce route flexibility and income" },
    { "stakeholder": "QC GIS and Smart City Office", "readiness": "ready", "key_concern": "Needs budget allocation for sensor installation" }
  ],
  "critical_success_factors": ["Signed MOA between QC LGU and MMDA before pilot launch", "Pilot limited to 3-5 QC-controlled intersections first"],
  "blocking_factors": ["No dedicated funding line in current QC budget", "MMDA jurisdiction over EDSA requires national-level approval"],
  "estimated_feasibility_horizon": "18–24 months for a 5-intersection pilot; 4–5 years for city-wide rollout"
}`;

// ── Generate Feasibility Assessment ─────────────────────────────────────────

/**
 * Run a chain-of-thought feasibility LLM call using the proximity chain evidence.
 */
export async function generateFeasibilityAssessment(
  env: Env,
  policy: string,
  location: string,
  chainItems: ChainItem[],
): Promise<FeasibilityResult | null> {
  // Build the chain-of-thought context block
  const chainBlocks = chainItems.map((item) => {
    const chainStr = item.chain.length > 0
      ? item.chain
          .map((hop) => `  ${hop.from} →[${hop.basis}, weight=${hop.weight.toFixed(2)}]→ ${hop.to}`)
          .join('\n')
      : '  (direct — same city)';

    return `### Precedent: "${item.policyName}" enacted in ${item.cityName}
Outcome: ${item.policyDescription ?? 'Similar policy with documented results'}
Transfer Chain (${item.cityName} → Quezon City):
${chainStr}
Combined Transferability Score: ${(item.transferability_score * 100).toFixed(0)}%`;
  }).join('\n\n');

  const noChainNote = chainItems.length === 0
    ? `## No Direct Precedents Found
No similar policies were found in the knowledge base for cities connected to Quezon City via proximity chains. Assess feasibility based on general knowledge of QC governance and comparable cities in the region. Apply a 15-point penalty to the overall score for lack of local evidence.`
    : '';

  const prompt = `## Proposed Policy
${policy}

## Target Location
${location}, Quezon City, Metro Manila, Philippines

${chainItems.length > 0 ? `## Precedent Chains\n${chainBlocks}` : noChainNote}

---

Reason step by step through each precedent chain. Consider institutional capacity gaps, infrastructure deltas, governance friction, and cultural adaptation needs at each hop. Then produce the full feasibility assessment JSON.`;

  const parseAndValidate = (raw: string): FeasibilityResult | null => {
    try {
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) return null;
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
      // Reject Ollama error objects (e.g. {"error": "Invalid JSON: ..."})
      if ('error' in parsed && Object.keys(parsed).length === 1) return null;
      // Must have at least overall_score to be a real feasibility result
      if (typeof parsed.overall_score !== 'number') return null;
      return parsed as unknown as FeasibilityResult;
    } catch {
      return null;
    }
  };

  // First attempt with format:json
  let raw = await callLLM(env, prompt, FEASIBILITY_SYSTEM_PROMPT, {
    temperature: 0.5,
    format: 'json',
  });

  let parsed = parseAndValidate(raw);

  // Retry without format:json if Ollama returned an error or unparseable output.
  // The format:json constraint can cause empty/error output on long prompts.
  if (!parsed) {
    raw = await callLLM(env, prompt, FEASIBILITY_SYSTEM_PROMPT, {
      temperature: 0.6,
    });
    parsed = parseAndValidate(raw);
  }

  if (!parsed) return null;

  // Inject chain data from our graph lookup if LLM under-populated it
  if (parsed.precedent_chains?.length === 0 && chainItems.length > 0) {
    parsed.precedent_chains = chainItems.map((item): FeasibilityPrecedentChain => ({
      city_name: item.cityName,
      city_id: item.cityId,
      policy_name: item.policyName,
      outcome_summary: item.policyDescription ?? '',
      chain: item.chain,
      transferability_score: item.transferability_score,
      key_adaptations: [],
    }));
  }

  return parsed;
}
