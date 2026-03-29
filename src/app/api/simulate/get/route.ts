// app/api/simulate/get/route.ts
import { r2Get } from '@/lib/d1-rest';
import type { SimulationResult } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

/**
 * Normalize any R2 result shape to the current SimulationResult schema.
 *
 * Handles three known formats:
 *
 * 1. **Current schema** — has impact_scores as { economic: { score, reasoning } }, etc.
 *    Returned as-is (after minor fixups).
 *
 * 2. **Generated format** — has the right top-level keys but with structural mismatches:
 *    - impact_scores values are plain numbers (not { score, reasoning })
 *    - persona_reactions is an array of one object instead of a flat object
 *    - simulation_timeline[].events is string[] instead of string
 *
 * 3. **Legacy (pre-refactor)** — has result.simulation.impact.positive/negative instead
 *    of impact_scores at all.
 */
function normalizeResult(raw: AnyObj, envelope: AnyObj): AnyObj {
  // ── Format 3: Legacy shape with nested "simulation" key ──────────────────
  if (raw.simulation && !raw.impact_scores && !raw.sustainability_score) {
    return adaptFromLegacy(raw, envelope);
  }

  // ── Format 1 & 2: Has current top-level keys, but may need fixups ───────
  const out = { ...raw };

  // Fix impact_scores: plain number → { score, reasoning }
  if (out.impact_scores && typeof out.impact_scores === 'object') {
    const fixed: AnyObj = {};
    for (const [key, val] of Object.entries(out.impact_scores)) {
      if (typeof val === 'number') {
        fixed[key] = { score: val, reasoning: '' };
      } else if (val && typeof val === 'object' && 'score' in (val as AnyObj)) {
        fixed[key] = val;
      } else {
        fixed[key] = { score: 0, reasoning: '' };
      }
    }
    out.impact_scores = fixed;
  }

  // Fix persona_reactions: array → flat object
  if (Array.isArray(out.persona_reactions)) {
    const first = out.persona_reactions[0] ?? {};
    out.persona_reactions = {
      supporter: first.supporter ?? { profile: '', reaction: '' },
      opponent: first.opponent ?? { profile: '', reaction: '' },
      neutral: first.neutral ?? { profile: '', reaction: '' },
    };
  }

  // Fix simulation_timeline[].events: string[] → joined string
  if (Array.isArray(out.simulation_timeline)) {
    out.simulation_timeline = out.simulation_timeline.map((step: AnyObj) => ({
      ...step,
      events: Array.isArray(step.events) ? step.events.join(' ') : step.events,
    }));
  }

  return out;
}

/** Adapt the oldest legacy format (result.simulation.impact.positive/negative). */
function adaptFromLegacy(raw: AnyObj, envelope: AnyObj): AnyObj {
  const sim: AnyObj = raw.simulation;
  const positive: AnyObj[] = sim.impact?.positive ?? [];
  const negative: AnyObj[] = sim.impact?.negative ?? [];
  const feasibility: AnyObj | undefined = sim.feasibility;

  const categories = ['Economic', 'Environmental', 'Social', 'Human-Centered'];
  const keyMap: Record<string, string> = {
    'Economic': 'economic',
    'Environmental': 'environmental',
    'Social': 'social',
    'Human-Centered': 'human_centered',
  };

  const impact_scores: Record<string, { score: number; reasoning: string }> = {};
  for (const cat of categories) {
    const key = keyMap[cat];
    const pos = positive.find(p => p.category === cat);
    const neg = negative.find(p => p.category === cat);
    let score = 0;
    let reasoning = '';
    if (pos && neg) {
      score = 2;
      reasoning = `Positive: ${pos.description} Negative: ${neg.description}`;
    } else if (pos) {
      score = 4;
      reasoning = pos.description;
    } else if (neg) {
      score = -4;
      reasoning = neg.description;
    }
    impact_scores[key] = { score, reasoning };
  }

  const feasibilityStatusMap: Record<string, number> = {
    'High': 72, 'Medium': 55, 'Low': 35, 'Very Low': 18,
  };
  const afterScore = feasibilityStatusMap[feasibility?.status] ?? 40;

  const allGroups = [
    ...positive.flatMap(p => p.affected_groups ?? []),
    ...negative.flatMap(p => p.affected_groups ?? []),
  ];
  const uniqueGroups = [...new Set(allGroups)];

  const timeline = (feasibility?.mitigation_strategies ?? []).map((m: AnyObj, i: number) => ({
    period: `Phase ${i + 1}`,
    label: m.strategy ?? 'Implementation',
    events: m.description ?? '',
    sustainability_delta: Math.round((afterScore - 50) / ((feasibility?.mitigation_strategies?.length ?? 1) + 1)),
  }));

  if (timeline.length === 0) {
    timeline.push({
      period: 'Phase 1',
      label: 'Initial Implementation',
      events: `Implementation of "${sim.policy_name ?? envelope.policy ?? 'the policy'}" begins.`,
      sustainability_delta: 0,
    });
  }

  const risks = (feasibility?.reasons ?? []).map((reason: string) => ({
    risk: reason,
    likelihood: feasibility?.status === 'Low' ? 'high' as const : 'medium' as const,
    mitigation: (feasibility?.mitigation_strategies?.[0]?.description as string) ?? 'Further study recommended.',
  }));

  const adapted: SimulationResult & { simulation_id: string } = {
    simulation_id: raw.simulation_id ?? envelope.simulation_id,
    policy_summary: `${sim.policy_name ?? envelope.policy ?? 'Policy'}: ${positive[0]?.description ?? 'Urban policy simulation result.'}`,
    location_context: `Simulated for ${envelope.location ?? 'the target area'}. ${uniqueGroups.length ? `Key affected groups: ${uniqueGroups.join(', ')}.` : ''}`,
    historical_precedents: [],
    simulation_timeline: timeline,
    impact_scores: impact_scores as SimulationResult['impact_scores'],
    persona_reactions: {
      supporter: {
        profile: uniqueGroups[0] ?? 'Community members',
        reaction: positive[0]?.description ?? 'Supportive of the initiative.',
      },
      opponent: {
        profile: negative[0]?.affected_groups?.[0] ?? 'Budget oversight bodies',
        reaction: negative[0]?.description ?? 'Concerned about resource allocation.',
      },
      neutral: {
        profile: 'Policy analysts',
        reaction: `Feasibility assessed as ${feasibility?.status ?? 'uncertain'}. ${feasibility?.success_factors?.[0] ?? ''}`,
      },
    },
    sustainability_score: {
      before: 50,
      after: afterScore,
      breakdown: {
        energy_efficiency: Math.round(afterScore * 0.9),
        waste_reduction: Math.round(afterScore * 0.85),
        green_coverage: Math.round(afterScore * 0.8),
        community_resilience: Math.round(afterScore * 1.1),
        resource_circularity: Math.round(afterScore * 0.95),
      },
    },
    risks,
    recommendations: [
      ...(feasibility?.mitigation_strategies ?? []).map((m: AnyObj) => `${m.strategy}: ${m.description}`),
      ...(feasibility?.success_factors ?? []),
    ],
    confidence: feasibility?.status === 'High' ? 'high' : feasibility?.status === 'Low' ? 'low' : 'medium',
    confidence_reasoning: `Based on legacy simulation data. Feasibility was rated "${feasibility?.status ?? 'unknown'}". ${(feasibility?.reasons ?? []).join(' ')}`,
  };

  return adapted;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return Response.json({ error: '"id" query param is required' }, { status: 400 });
  }

  try {
    const data = await r2Get(`simulations/${id}.json`);
    if (!data) {
      return Response.json({ error: 'Simulation not found' }, { status: 404 });
    }

    const parsed = JSON.parse(data) as AnyObj;
    const result = parsed.result ?? parsed;

    // Normalize to current SimulationResult schema
    const adapted = normalizeResult(result, parsed);

    return Response.json({
      simulation_id: parsed.simulation_id ?? id,
      policy: parsed.policy ?? '',
      location: parsed.location ?? '',
      result: adapted,
    });
  } catch (err) {
    console.error('[simulate/get]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
