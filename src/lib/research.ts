// src/lib/research.ts
import { callLLM } from './llm';
import type { Env, SearchResult, ResearchResult, IngestFormRecord, ClaimVerification } from './types';

const RESEARCH_SYNTHESIS_PROMPT = `You are a policy research assistant specializing in Philippine urban governance (Quezon City, Metro Manila).

Given a set of web search results about a local government policy, extract and structure the following fields into JSON:

{
  "title": "Full name/number of the policy (e.g. 'QC Ordinance SP-2356: Mandatory Waste Segregation at Source')",
  "date": "Year or date (e.g. '2017' or '2017-03-15'). Use just the year if the exact date is unknown.",
  "policyType": "Ordinance|Executive Order|Plan|Implementing Rules and Regulation|Resolution|Program",
  "whatWasThePolicy": "Clear 2-4 sentence description: what it mandated or incentivized, its official number/name, and scope.",
  "whereImplemented": "Specific barangays, districts, or city-wide scope.",
  "whoWasAffected": "All stakeholder groups mentioned: residents, informal workers, businesses, NGOs, transport operators, LGU offices, etc.",
  "whatHappened": "Measurable outcomes, budget figures (in PHP), compliance rates, statistics, timeline of effects. Be specific with numbers.",
  "whoSupportedOpposed": "Named groups that publicly supported or opposed the policy and their stated reasons.",
  "whatWentWrong": "Negative outcomes, unintended consequences, resistance, implementation failures, gaps."
}

RULES:
- Return ONLY valid JSON, no markdown, no explanation.
- Only include information that appears in the provided search results. Do not fabricate.
- If a field has no information in the sources, set it to an empty string "".
- Prefer specific numbers, names, and dates over vague descriptions.
- Include Philippine-specific details: barangay names, ordinance numbers, PHP amounts, LGU office names.`;

const FIELD_SYNTHESIS_PROMPTS: Record<keyof Omit<IngestFormRecord, 'model'>, string> = {
  title: 'Extract the full official name/number of the policy.',
  date: 'Extract the year or date the policy was enacted (just the year if uncertain, e.g. "2017").',
  policyType: 'Classify as exactly one of: Ordinance, Executive Order, Plan, Implementing Rules and Regulation, Resolution, Program.',
  whatWasThePolicy: 'Describe what the policy mandated or incentivized in 2-4 sentences.',
  whereImplemented: 'List the specific barangays, districts, or areas where the policy was implemented.',
  whoWasAffected: 'List all stakeholder groups affected by the policy.',
  whatHappened: 'Describe measurable outcomes with specific numbers, budgets (PHP), compliance rates, and timelines.',
  whoSupportedOpposed: 'List groups that supported or opposed the policy and their stated reasons.',
  whatWentWrong: 'Describe negative outcomes, unintended consequences, resistance, or implementation gaps.',
};

// ── SearXNG Search ───────────────────────────────────────────────────────────

export async function searchSearXNG(env: Env, query: string): Promise<SearchResult[]> {
  if (!env.SEARXNG_URL) throw new Error('SEARXNG_URL is not configured');

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    engines: 'google,bing,wikipedia,google scholar',
    lang: 'en',
    time_range: '',
    safesearch: '0',
  });

  const res = await fetch(`${env.SEARXNG_URL}/search?${params}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) throw new Error(`SearXNG returned ${res.status}`);

  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; engine?: string }>;
  };

  return (data.results ?? [])
    .slice(0, 15)
    .map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: r.content ?? '',
      engine: r.engine ?? '',
    }))
    .filter((r) => r.content.length > 20);
}

// ── LLM Synthesis ────────────────────────────────────────────────────────────

export async function synthesizeFormFields(
  env: Env,
  query: string,
  results: SearchResult[]
): Promise<Partial<IngestFormRecord>> {
  const sourceText = results
    .map((r) => `[${r.engine}] ${r.title}\n${r.content}`)
    .join('\n\n---\n\n')
    .substring(0, 6000); // stay within context limits

  const prompt = `Search query: "${query}"

Search results:
${sourceText}

---

Based ONLY on the search results above, fill in the structured policy form for Quezon City.`;

  const raw = await callLLM(env, prompt, RESEARCH_SYNTHESIS_PROMPT, {
    temperature: 0.2,
    format: 'json',
  });

  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as Partial<IngestFormRecord>;
  } catch {
    console.error('Failed to parse synthesis result:', raw.substring(0, 300));
    return {};
  }
}

/** Re-synthesize a single field — used by the Regenerate button in the UI */
export async function synthesizeSingleField(
  env: Env,
  field: keyof Omit<IngestFormRecord, 'model'>,
  sources: SearchResult[]
): Promise<string> {
  const sourceText = sources
    .map((r) => `[${r.engine}] ${r.title}\n${r.content}`)
    .join('\n\n---\n\n')
    .substring(0, 4000);

  const instruction = FIELD_SYNTHESIS_PROMPTS[field] ?? `Extract the "${field}" field from the search results.`;

  const prompt = `Search results:
${sourceText}

---

Task: ${instruction}

Return ONLY the value as a plain string (no JSON, no explanation, no markdown).`;

  const result = await callLLM(env, prompt, 'You are a concise policy data extractor. Return only the requested value.', {
    temperature: 0.2,
  });

  return result.trim();
}

// ── DeBERTa Verification ──────────────────────────────────────────────────────

export async function verifyWithDeBERTa(
  env: Env,
  sourceText: string,
  synthesis: string,
  threshold = 0.75
): Promise<ResearchResult['verification']> {
  if (!env.DEBERTA_URL) return null;

  try {
    const res = await fetch(`${env.DEBERTA_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_text: sourceText, synthesis, threshold }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      card_verified: boolean;
      threshold_used: number;
      claims: Array<{
        claim: string;
        verdict: string;
        passed: boolean;
        entailment_score: number;
        contradiction_score: number;
        neutral_score: number;
      }>;
      summary: string;
      processing_time_ms: number;
    };

    return {
      card_verified: data.card_verified,
      threshold_used: data.threshold_used,
      claims: data.claims as ClaimVerification[],
      summary: data.summary,
      processing_time_ms: data.processing_time_ms,
    };
  } catch {
    return null; // graceful fallback — DeBERTa is optional
  }
}

// ── Main research pipeline ────────────────────────────────────────────────────

export async function runResearch(
  env: Env,
  query: string,
  location?: string,
  city?: string,
): Promise<ResearchResult> {
  const cityContext = city ?? 'Quezon City Philippines';
  const fullQuery = location ? `${query} ${location} ${cityContext}` : `${query} ${cityContext}`;

  // Check KV cache first (24h TTL — same query = same research)
  const cacheKey = `research:${fullQuery.toLowerCase().trim()}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached) return JSON.parse(cached) as ResearchResult;

  // 1. Search
  const results = await searchSearXNG(env, fullQuery);

  if (results.length === 0) {
    return {
      query: fullQuery,
      results: [],
      synthesized: {},
      source_text: '',
      verification: null,
    };
  }

  // 2. Synthesize structured form fields
  const synthesized = await synthesizeFormFields(env, fullQuery, results);

  // 3. Build source text for DeBERTa (combined snippets, max 3000 chars)
  const source_text = results
    .map((r) => r.content)
    .join(' ')
    .substring(0, 3000);

  // 4. Verify synthesis against sources (graceful fallback if DeBERTa down)
  const synthesisText = Object.values(synthesized).filter(Boolean).join(' ');
  const verification = synthesisText
    ? await verifyWithDeBERTa(env, source_text, synthesisText)
    : null;

  const researchResult: ResearchResult = {
    query: fullQuery,
    results,
    synthesized,
    source_text,
    verification,
  };

  // Cache for 24 hours
  await env.CACHE.put(cacheKey, JSON.stringify(researchResult), {
    expirationTtl: 86_400,
  });

  return researchResult;
}
