// src/lib/simulate.ts
import { callLLM } from './llm';
import { queryGraph } from './graph';
import { getLocationWeatherContext } from './weather';
import { buildFeasibilityContext } from './feasibility';
import type { Env, SimulationResult, WeatherContext } from './types';

const SIMULATION_SYSTEM_PROMPT = `You are Simula, an urban policy simulation engine for Quezon City, Metro Manila, Philippines. Analyze proposed policies using historical precedents, live environmental context, and proximity-chain transferability evidence.

CRITICAL: Always return the full simulation JSON. Never return {"error":...}. For harmful/illegal policies, produce a critique simulation with negative scores showing how it fails — the simulation IS the critique.

Return ONLY valid JSON (no markdown) with these fields:

policy_summary: string (1-2 sentences)
location_context: string
historical_precedents: [{policy_name, relevance, outcome_summary}]
simulation_timeline: [{period, label, events, sustainability_delta: number}] — 4 entries: Month 1-2, Month 3-6, Month 6-12, Year 1-2
impact_scores: {economic, environmental, social, human_centered} — each {score: -10 to +10, reasoning: string}
persona_reactions: {supporter, opponent, neutral} — each {profile, reaction}
sustainability_score: {before: 0-100, after: 0-100, breakdown: {energy_efficiency, waste_reduction, green_coverage, community_resilience, resource_circularity}}
risks: [{risk, likelihood: "low"|"medium"|"high", mitigation}]
recommendations: [string]
confidence: "low"|"medium"|"high"
confidence_reasoning: string
feasibility: {
  overall_score: 0-100,
  overall_label: "Not Feasible"|"Challenging"|"Feasible"|"Highly Feasible",
  reasoning: string (CoT walk through each transfer chain hop — capacity gaps, infrastructure deltas, governance friction),
  precedent_chains: [{city_name, city_id, policy_name, outcome_summary, chain:[{from,to,weight,basis}], transferability_score, key_adaptations:[string]}],
  stakeholder_readiness: [{stakeholder, readiness:"ready"|"cautious"|"resistant", key_concern}],
  critical_success_factors: [string],
  blocking_factors: [string],
  estimated_feasibility_horizon: string
}

SCORING RULES:
- Impact scores: bad policies -4 to -8, do not cluster around 0
- Sustainability: harmful policy drops to 20-35, not near 50
- Feasibility overall_score: 0-25 Not Feasible, 26-50 Challenging, 51-75 Feasible, 76-100 Highly Feasible; deduct 15 if no chains provided
- Ground feasibility in transferability_score evidence from provided chains

QC CONTEXT:
- Real stakeholders: barangay captains, tanods, TODA operators, ISF communities, sari-sari owners, jeepney operators, MMDA, QC Smart City Office, civil society groups
- MMDA governs major roads (EDSA, C-5); QC LGU governs local roads — jurisdiction friction is real
- Monsoon flooding June-November; informal economy dependence; 3-year election cycles
- Bad policy timeline: initial resistance → enforcement breakdown → community harm → rollback/scandal
- Low historical context → lower confidence, explain why, but still simulate fully`;

function buildWeatherSection(location: string, ctx: WeatherContext): string {
  const aqiLabel = ctx.usAqi == null ? 'N/A' : ctx.usAqi <= 50 ? 'Good' : ctx.usAqi <= 100 ? 'Moderate' : 'Unhealthy';
  const dischargeLabel =
    ctx.riverDischarge == null
      ? 'N/A'
      : `${ctx.riverDischarge.toFixed(1)} m³/s`;

  return `## Current Environmental Context — ${location}
- Temperature: ${ctx.temperature}°C (feels like ${ctx.apparentTemperature}°C), Humidity: ${ctx.humidity}%
- Air Quality: US AQI ${ctx.usAqi ?? 'N/A'} (${aqiLabel})
- River Discharge: ${dischargeLabel} → Flood Risk: ${ctx.floodRisk.toUpperCase()}
- Season: ${ctx.season}
  Note: ${
    ctx.isRainySeason
      ? 'Currently wet season. Flooding risk is elevated; outdoor compliance enforcement is harder. Community solidarity around flood events can INCREASE support for environmental and flood-mitigation policies. Timing new regulations during peak rain often drives urgency.'
      : 'Currently dry season. Heat stress is relevant; water conservation and cooling policies are more resonant to residents. Lower flood risk means infrastructure projects face less urgency pressure.'
  }`;
}

export async function runSimulation(
  env: Env,
  policy: string,
  location: string,
  lat?: number,
  lng?: number
) {
  // 1. Query graph for relevant historical context
  const graphContext = await queryGraph(env, `${policy} ${location} Quezon City`, 2, 8);

  // 2. Get live weather context + build feasibility chain context in parallel
  const [weatherCtxResult, feasibilityChainItems] = await Promise.all([
    (async (): Promise<WeatherContext | null> => {
      if (lat == null || lng == null) return null;
      try {
        return await getLocationWeatherContext(env, lat, lng);
      } catch {
        console.warn('Weather context fetch failed — continuing without it');
        return null;
      }
    })(),
    buildFeasibilityContext(env, graphContext).catch(() => []),
  ]);

  const weatherCtx = weatherCtxResult;

  // 3. Build simulation prompt
  const weatherSection = weatherCtx
    ? `\n${buildWeatherSection(location, weatherCtx)}\n`
    : '';

  const hasGraphContext = graphContext.entry_nodes.length > 0 || graphContext.related_nodes.length > 0;
  const historicalSection = hasGraphContext
    ? `## Historical Context from Knowledge Graph\n${graphContext.context_text}`
    : `## Historical Context from Knowledge Graph\nNo direct precedents found in the knowledge base. Simulate using your general knowledge of Quezon City's governance history, Philippine urban policy patterns, and comparable cities in Southeast Asia. Lower your confidence score accordingly and note the lack of local precedents in confidence_reasoning.`;

  // Build feasibility chain section from proximity graph
  const feasibilitySection = feasibilityChainItems.length > 0
    ? `## Precedent Transfer Chains (for feasibility assessment)\n` +
      feasibilityChainItems.map((item) => {
        const chainStr = item.chain.length > 0
          ? item.chain.map((hop) => `  ${hop.from} →[${hop.basis}, w=${hop.weight.toFixed(2)}]→ ${hop.to}`).join('\n')
          : '  (same city)';
        return `### "${item.policyName}" enacted in ${item.cityName}\nOutcome: ${item.policyDescription ?? 'documented results'}\nChain:\n${chainStr}\nTransferability: ${(item.transferability_score * 100).toFixed(0)}%`;
      }).join('\n\n')
    : `## Precedent Transfer Chains (for feasibility assessment)\nNo proximity chain precedents found. Base feasibility on general QC governance knowledge.`;

  const prompt = `## Proposed Policy
${policy}

## Target Location
${location}, Quezon City, Metro Manila, Philippines
${weatherSection}
${historicalSection}

${feasibilitySection}

---

Simulate the full impact of the proposed policy AND assess its feasibility using the transfer chains above. Return the complete simulation JSON including the feasibility object — always return a valid simulation regardless of how much historical context is available.`;

  // 4. Run main simulation + feasibility assessment in parallel
  const parseResult = (raw: string): SimulationResult | null => {
    try {
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) return null;
      const cleaned = raw.slice(jsonStart, jsonEnd + 1);
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  };

  const isErrorObject = (obj: Record<string, unknown>) =>
    'error' in obj && Object.keys(obj).length === 1;

  // Single LLM call — feasibility is now part of the schema so no second call needed.
  let rawResult = await callLLM(env, prompt, SIMULATION_SYSTEM_PROMPT, { temperature: 0.6, format: 'json' });

  let parsed = parseResult(rawResult) as (SimulationResult & Record<string, unknown>) | null;

  // If LLM returned an error object or unparseable output, retry once without JSON-format
  // constraint (Ollama's format:json can produce empty output on long prompts, triggering its
  // own {"error": "Invalid JSON: ..."} response). Use a shorter, direct retry prompt.
  if (!parsed || isErrorObject(parsed as Record<string, unknown>)) {
    const retryPrompt = `## Proposed Policy\n${policy}\n\n## Target Location\n${location}, Quezon City, Metro Manila, Philippines\n\nProduce a full critique simulation JSON for this policy. If it is harmful or poorly designed, assign negative scores and describe how it will fail. Never return an error — always return the complete simulation JSON.`;

    const retryRaw = await callLLM(env, retryPrompt, SIMULATION_SYSTEM_PROMPT, {
      temperature: 0.7,
      // No format:'json' — Ollama's JSON constraint can fail on long prompts; rely on system prompt
    });
    parsed = parseResult(retryRaw) as (SimulationResult & Record<string, unknown>) | null;

    // 5. Final validation
    if (!parsed) {
      throw new Error(`Failed to parse simulation output: ${retryRaw.substring(0, 300)}`);
    }

    if (isErrorObject(parsed as Record<string, unknown>)) {
      throw new Error(`LLM returned an error after retry: ${(parsed as Record<string, unknown>).error}`);
    }
  }

  if (!parsed) {
    throw new Error(`Failed to parse simulation output: ${rawResult.substring(0, 300)}`);
  }

  // 6. Return result directly — skip DB persistence to avoid D1 size limits
  const simId = crypto.randomUUID();
  return { simulation_id: simId, ...parsed };
}
