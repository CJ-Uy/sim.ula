// app/api/scrape/status/route.ts
import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { sql } from 'drizzle-orm';
import type { Env } from '@/lib/types';

/** Retry a D1 query up to 3 times with backoff (handles error 1031 rate limits). */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      // Wait 1s, 2s, 4s between retries
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error('withRetry: unreachable');
}

export async function GET() {
  try {
    const env = await getEnv() as Env;
    const db = getDb(env);

    const statusCounts = await withRetry(() =>
      db.all<{ status: string; cnt: number }>(sql`
        SELECT status, COUNT(*) as cnt FROM scrape_jobs GROUP BY status
      `)
    );

    const ringCounts = await withRetry(() =>
      db.all<{ ring: number; status: string; cnt: number }>(sql`
        SELECT ring, status, COUNT(*) as cnt FROM scrape_jobs GROUP BY ring, status
      `)
    );

    const lastCompleted = await withRetry(() =>
      db.all<{ completed_at: string }>(sql`
        SELECT completed_at FROM scrape_jobs
        WHERE status = 'done' AND completed_at IS NOT NULL
        ORDER BY completed_at DESC LIMIT 1
      `)
    );

    let cycleCount = 0;
    try {
      const cycleStr = await env.CACHE.get('scrape:cycle_count');
      cycleCount = cycleStr ? parseInt(cycleStr, 10) : 0;
    } catch { /* KV may be transiently unavailable */ }

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
  } catch {
    // D1 can return error 1031 when rate-limited — return empty status instead of 500
    return Response.json({
      total_jobs: 0,
      by_status: {},
      by_ring: {},
      cycle_count: 0,
      last_completed: null,
      error: 'Status temporarily unavailable',
    });
  }
}

/**
 * DELETE /api/scrape/status — Reset all scrape jobs and cycle count.
 * Clears the scrape_jobs table and resets the cycle counter so the
 * next scrape starts fresh.
 */
export async function DELETE() {
  try {
    const env = await getEnv() as Env;
    const db = getDb(env);

    const deleted = await withRetry(() => db.run(sql`DELETE FROM scrape_jobs`));
    try { await env.CACHE.delete('scrape:cycle_count'); } catch { /* ignore */ }
    try { await env.CACHE.delete('scrape:stop_requested'); } catch { /* ignore */ }

    return Response.json({
      status: 'reset',
      jobs_deleted: deleted.meta?.changes ?? 0,
    });
  } catch (err) {
    return Response.json(
      { error: `Reset failed (D1 may be rate-limited, try again in a few seconds): ${err}` },
      { status: 503 },
    );
  }
}
