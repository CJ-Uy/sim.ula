// app/api/simulate/save/route.ts
import { d1Query, r2Put } from '@/lib/d1-rest';

export async function POST(request: Request) {
  let body: {
    simulation_id: string;
    policy: string;
    location: string;
    result: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!body.simulation_id || !body.result) {
    return Response.json({ error: 'simulation_id and result required' }, { status: 400 });
  }

  const score = typeof body.result.sustainability_score === 'object' && body.result.sustainability_score !== null
    ? (body.result.sustainability_score as Record<string, unknown>).after ?? null
    : null;

  // Save metadata to D1
  try {
    await d1Query(
      `INSERT OR IGNORE INTO simulations (id, input_policy, input_location, sustainability_score, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [body.simulation_id, (body.policy ?? '').slice(0, 200), (body.location ?? '').slice(0, 100), score]
    );
  } catch (err) {
    console.error('[simulate/save] D1 error:', err);
  }

  // Save full result to R2
  try {
    await r2Put(
      `simulations/${body.simulation_id}.json`,
      JSON.stringify({
        simulation_id: body.simulation_id,
        policy: body.policy,
        location: body.location,
        result: body.result,
      })
    );
  } catch (err) {
    console.error('[simulate/save] R2 error:', err);
  }

  return Response.json({ saved: true });
}
