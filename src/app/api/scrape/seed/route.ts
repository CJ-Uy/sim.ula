// app/api/scrape/seed/route.ts
import { getEnv } from '@/lib/env';
import { seedCityGraph } from '@/lib/scraper';
import type { Env } from '@/lib/types';

export async function POST() {
  const env = await getEnv() as Env;

  try {
    const result = await seedCityGraph(env);
    return Response.json({
      status: 'seeded',
      nodes_created: result.nodesCreated,
      edges_created: result.edgesCreated,
    });
  } catch (err) {
    return Response.json({ error: `Seed failed: ${err}` }, { status: 500 });
  }
}
