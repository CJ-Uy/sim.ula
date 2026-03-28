// app/api/simulate/route.ts
import { getEnv } from '@/lib/env';
import { runSimulation } from '@/lib/simulate';
import type { SimulateRequest } from '@/lib/types';

export async function POST(request: Request) {
  const env = await getEnv();

  let body: SimulateRequest;
  try {
    body = (await request.json()) as SimulateRequest;
  } catch {
    return Response.json(
      { error: 'Invalid or empty request body — expected JSON with "policy" and "location"' },
      { status: 400 }
    );
  }

  if (!body.policy || !body.location) {
    return Response.json(
      { error: 'Both "policy" and "location" fields are required' },
      { status: 400 }
    );
  }

  // Check KV cache
  const cacheKey = `sim:${body.policy.toLowerCase().trim()}:${body.location.toLowerCase().trim()}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  try {
    const result = await runSimulation(
      env,
      body.policy,
      body.location,
      body.lat,
      body.lng
    );

    const responseBody = JSON.stringify(result);
    await env.CACHE.put(cacheKey, responseBody, { expirationTtl: 3600 });

    return new Response(responseBody, {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  } catch (err) {
    return Response.json({ error: `Simulation failed: ${err}` }, { status: 500 });
  }
}
