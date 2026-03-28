// src/lib/simulate.ts
import { callLLM } from './llm';
import { queryGraph } from './graph';
import { getLocationWeatherContext } from './weather';
import type { Env, SimulationResult, WeatherContext } from './types';

const SIMULATION_SYSTEM_PROMPT = `You are Simula, an urban policy simulation engine for Quezon City, Metro Manila, Philippines. You analyze proposed policies by drawing on historical precedents and their documented outcomes.

You will receive:
1. A proposed policy from the user
2. A location context (barangay, district, or area in QC)
3. Historical context from a knowledge graph of past policies, stakeholders, and outcomes
4. Current environmental context (live weather, air quality, flood risk) for the target location

Your job is to simulate the likely impact of the proposed policy across multiple dimensions and time steps, taking into account both historical precedents AND current environmental conditions.

Return ONLY valid JSON (no markdown fences, no explanation) matching this schema:

{
  "policy_summary": "1-2 sentence restatement of the proposed policy",
  "location_context": "Brief description of the target area's current relevant characteristics",
  "historical_precedents": [
    {
      "policy_name": "Name of a similar past policy from the provided context",
      "relevance": "Why this precedent is relevant to the proposed policy",
      "outcome_summary": "What happened when this was implemented"
    }
  ],
  "simulation_timeline": [
    { "period": "Month 1-2", "label": "Implementation", "events": "What happens during this period", "sustainability_delta": 0 },
    { "period": "Month 3-6", "label": "Early effects", "events": "Short-term changes becoming visible", "sustainability_delta": 0 },
    { "period": "Month 6-12", "label": "Medium-term", "events": "Established patterns and community adaptation", "sustainability_delta": 0 },
    { "period": "Year 1-2", "label": "Long-term projection", "events": "Projected sustained effects", "sustainability_delta": 0 }
  ],
  "impact_scores": {
    "economic": { "score": 0, "reasoning": "Scale: -10 (devastating) to +10 (transformative). Most realistic: -3 to +5." },
    "environmental": { "score": 0, "reasoning": "Environmental impact on the same scale." },
    "social": { "score": 0, "reasoning": "Social/community cohesion impact." },
    "human_centered": { "score": 0, "reasoning": "How well does this serve the most vulnerable? Consider informal workers, urban poor, elderly, children." }
  },
  "persona_reactions": {
    "supporter": { "profile": "Who would support this and why", "reaction": "Their likely public response and advocacy actions" },
    "opponent": { "profile": "Who would oppose this — include vested interests and affected businesses", "reaction": "Their objections and resistance tactics" },
    "neutral": { "profile": "Who would be indifferent initially", "reaction": "Their passive response and what would move them to engage" }
  },
  "sustainability_score": {
    "before": 50,
    "after": 55,
    "breakdown": {
      "energy_efficiency": 50,
      "waste_reduction": 50,
      "green_coverage": 50,
      "community_resilience": 50,
      "resource_circularity": 50
    }
  },
  "risks": [
    { "risk": "Specific negative outcome that could happen", "likelihood": "low|medium|high", "mitigation": "Concrete action to prevent or reduce this risk" }
  ],
  "recommendations": ["Specific, actionable suggestion to make this policy more effective"],
  "confidence": "low|medium|high",
  "confidence_reasoning": "Honest assessment of prediction reliability"
}

CRITICAL GUIDELINES:
- GROUND every claim in the historical context provided. Reference specific past policies BY NAME.
- USE the current environmental context: if it's rainy season with high flood risk, flood-related policies get stronger social support. If air quality is poor, policies addressing pollution are more politically salient.
- Be HONEST about negative outcomes. Every real policy has trade-offs.
- Sustainability scores are 0-100. Most QC neighborhoods baseline: 45-55.
- Impact scores: -10 to +10. Most realistic policies: -3 to +5.
- Think about REAL QC stakeholders: barangay captains, tanods, informal settlers/vendors, junk shop operators, sari-sari store owners, jeepney/tricycle operators, middle-class subdivisions, NGOs, religious organizations.
- Consider Philippine-specific factors: monsoon season flooding (June-November), informal economy dependence, barangay-level governance, election cycles.
- If historical context is thin, LOWER your confidence and explain why.`;

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

  // 2. Get live weather context for the target location (if coordinates provided)
  let weatherCtx: WeatherContext | null = null;
  if (lat != null && lng != null) {
    try {
      weatherCtx = await getLocationWeatherContext(env, lat, lng);
    } catch {
      console.warn('Weather context fetch failed — continuing without it');
    }
  }

  // 3. Build simulation prompt
  const weatherSection = weatherCtx
    ? `\n${buildWeatherSection(location, weatherCtx)}\n`
    : '';

  const hasGraphContext = graphContext.entry_nodes.length > 0 || graphContext.related_nodes.length > 0;
  const historicalSection = hasGraphContext
    ? `## Historical Context from Knowledge Graph\n${graphContext.context_text}`
    : `## Historical Context from Knowledge Graph\nNo direct precedents found in the knowledge base. Simulate using your general knowledge of Quezon City's governance history, Philippine urban policy patterns, and comparable cities in Southeast Asia. Lower your confidence score accordingly and note the lack of local precedents in confidence_reasoning.`;

  const prompt = `## Proposed Policy
${policy}

## Target Location
${location}, Quezon City, Metro Manila, Philippines
${weatherSection}
${historicalSection}

---

Simulate the full impact of the proposed policy. Return the complete simulation JSON — always return a valid simulation regardless of how much historical context is available.`;

  // 4. Run simulation via LLM
  const rawResult = await callLLM(env, prompt, SIMULATION_SYSTEM_PROMPT, {
    temperature: 0.6,
    format: 'json',
  });

  // 5. Parse and validate result
  let parsed: SimulationResult;
  try {
    const jsonStart = rawResult.indexOf('{');
    const jsonEnd = rawResult.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');
    const cleaned = rawResult.slice(jsonStart, jsonEnd + 1);
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse simulation output: ${rawResult.substring(0, 300)}`);
  }

  // If the LLM returned a bare error object, reject it — but accept any simulation-shaped JSON
  if ('error' in parsed && Object.keys(parsed).length === 1) {
    throw new Error(`LLM returned an error instead of a simulation: ${(parsed as Record<string, unknown>).error}`);
  }

  // 6. Return result directly — skip DB persistence to avoid D1 size limits
  const simId = crypto.randomUUID();
  return { simulation_id: simId, ...parsed };
}
