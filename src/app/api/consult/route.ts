// app/api/consult/route.ts
import { getEnv } from '@/lib/env';
import { callLLM } from '@/lib/llm';
import { queryGraph } from '@/lib/graph';
import type { ConsultRequest } from '@/lib/types';

export const runtime = 'edge';

const CONSULT_SYSTEM_PROMPT = `You are Simula's policy consultation engine for Quezon City, Philippines. Given a desired outcome or goal, suggest specific implementable policies based on historical precedents in the knowledge base.

Return ONLY valid JSON (no markdown, no explanation):

{
  "goal_summary": "Restated user goal in clear terms",
  "suggested_policies": [
    {
      "policy": "Specific, concrete policy recommendation (not vague)",
      "rationale": "Why this would work — reference specific historical precedents from the context",
      "precedent": "Name of a similar past policy that succeeded or provides lessons",
      "estimated_impact": "Expected measurable outcome",
      "difficulty": "low|medium|high",
      "timeline": "Expected time to see measurable results",
      "stakeholders_to_engage": "Which groups need to be involved for success"
    }
  ],
  "implementation_order": "Recommended sequence if multiple policies are suggested",
  "combined_sustainability_impact": "How these policies together affect the sustainability index",
  "warnings": ["Any historical lessons about what NOT to do"]
}

Be specific to Quezon City. Reference actual governance structures (barangay system, city council). Suggest policies that are realistically implementable at the local government level.`;

export async function POST(request: Request) {
  const env = getEnv();
  const body = (await request.json()) as ConsultRequest;

  if (!body.goal) {
    return Response.json({ error: '"goal" field is required' }, { status: 400 });
  }

  const location = body.location ?? 'Quezon City';

  try {
    const graphContext = await queryGraph(env, `${body.goal} ${location}`, 2, 8);

    const prompt = `## Desired Outcome
${body.goal}

## Target Location
${location}, Metro Manila, Philippines

## Historical Policy Context from Knowledge Graph
${graphContext.context_text}

---

Based on what has worked (and failed) before according to the historical context above, suggest specific policies to achieve this goal. Reference precedents by name.`;

    const result = await callLLM(env, prompt, CONSULT_SYSTEM_PROMPT, {
      temperature: 0.7,
      format: 'json',
    });

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    return new Response(cleaned, { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return Response.json({ error: `Consultation failed: ${err}` }, { status: 500 });
  }
}
