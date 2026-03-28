// app/api/report/route.ts
import { d1Query, r2Get } from '@/lib/d1-rest';
import { generateReportHTML } from '@/lib/report';
import type { ReportRequest, SimulationResult, WeatherContext } from '@/lib/types';

interface SimRow {
  id: string;
  input_policy: string;
  input_location: string | null;
  retrieved_context: string | null;
  simulation_result: string | null;
  weather_context: string | null;
  created_at: string | null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ReportRequest;

  if (!body.simulation_id) {
    return Response.json({ error: '"simulation_id" is required' }, { status: 400 });
  }

  try {
    const rows = await d1Query<SimRow>(
      'SELECT id, input_policy, input_location, retrieved_context, simulation_result, weather_context, created_at FROM simulations WHERE id = ?',
      [body.simulation_id]
    );

    const sim = rows[0];
    if (!sim) {
      return Response.json({ error: 'Simulation not found' }, { status: 404 });
    }

    // Try R2 first (full payload), fall back to D1 columns for older records
    let simulationResult: SimulationResult;
    let context: unknown = {};
    let weatherContext: WeatherContext | null = null;

    try {
      const r2Key = `simulations/${sim.id}.json`;
      const r2Data = await r2Get(r2Key);
      if (r2Data) {
        const full = JSON.parse(r2Data);
        simulationResult = full.simulation_result;
        context = full.retrieved_context ?? {};
        weatherContext = full.weather_context ?? null;
      } else {
        simulationResult = JSON.parse(sim.simulation_result ?? '{}');
        context = JSON.parse(sim.retrieved_context ?? '{}');
        weatherContext = sim.weather_context ? JSON.parse(sim.weather_context) : null;
      }
    } catch {
      // R2 unavailable — fall back to D1
      simulationResult = JSON.parse(sim.simulation_result ?? '{}');
      context = JSON.parse(sim.retrieved_context ?? '{}');
      weatherContext = sim.weather_context ? JSON.parse(sim.weather_context) : null;
    }

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
  } catch (err) {
    console.error('[report]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
