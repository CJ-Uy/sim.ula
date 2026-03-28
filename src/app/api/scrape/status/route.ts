// app/api/scrape/status/route.ts
import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { sql } from 'drizzle-orm';
import type { Env } from '@/lib/types';

export async function GET() {
  const env = await getEnv() as Env;
  const db = getDb(env);

  const statusCounts = await db.all<{ status: string; cnt: number }>(sql`
    SELECT status, COUNT(*) as cnt FROM scrape_jobs GROUP BY status
  `);

  const ringCounts = await db.all<{ ring: number; status: string; cnt: number }>(sql`
    SELECT ring, status, COUNT(*) as cnt FROM scrape_jobs GROUP BY ring, status
  `);

  const lastCompleted = await db.all<{ completed_at: string }>(sql`
    SELECT completed_at FROM scrape_jobs
    WHERE status = 'done' AND completed_at IS NOT NULL
    ORDER BY completed_at DESC LIMIT 1
  `);

  const cycleStr = await env.CACHE.get('scrape:cycle_count');
  const cycleCount = cycleStr ? parseInt(cycleStr, 10) : 0;

  // Aggregate
  const byStatus: Record<string, number> = {};
  for (const row of statusCounts) byStatus[row.status] = row.cnt;

  const byRing: Record<number, Record<string, number>> = {};
  for (const row of ringCounts) {
    byRing[row.ring] ??= {};
    byRing[row.ring][row.status] = row.cnt;
  }

  return Response.json({
    total_jobs: Object.values(byStatus).reduce((a, b) => a + b, 0),
    by_status: byStatus,
    by_ring: byRing,
    cycle_count: cycleCount,
    last_completed: lastCompleted[0]?.completed_at ?? null,
  });
}
