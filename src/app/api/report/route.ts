// app/api/report/route.ts
import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { generateReportHTML } from '@/lib/report';
import type { ReportRequest, WeatherContext } from '@/lib/types';

export const runtime = 'edge';

export async function POST(request: Request) {
  const env = getEnv();
  const body = (await request.json()) as ReportRequest;

  if (!body.simulation_id) {
    return Response.json({ error: '"simulation_id" is required' }, { status: 400 });
  }

  const db = getDb(env);
  const sim = await db
    .select()
    .from(schema.simulations)
    .where(eq(schema.simulations.id, body.simulation_id))
    .get();

  if (!sim) {
    return Response.json({ error: 'Simulation not found' }, { status: 404 });
  }

  const simulationResult = JSON.parse(sim.simulation_result ?? '{}');
  const context = JSON.parse(sim.retrieved_context ?? '{}');
  const weatherContext: WeatherContext | null = sim.weather_context
    ? JSON.parse(sim.weather_context)
    : null;

  const reportHTML = generateReportHTML({
    simulationId: sim.id,
    policy: sim.input_policy,
    location: sim.input_location ?? '',
    simulation: simulationResult,
    context,
    weatherContext,
    date: sim.created_at ?? new Date().toISOString(),
  });

  return Response.json({
    simulation_id: sim.id,
    report_html: reportHTML,
    report_data: simulationResult,
  });
}
