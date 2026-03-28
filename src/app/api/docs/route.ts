// app/api/docs/route.ts
import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { sql } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET() {
  const env = await getEnv();
  const db = getDb(env);

  const docs = await db
    .select()
    .from(schema.documents)
    .orderBy(sql`ingested_at DESC`)
    .all();

  const nodeCounts = await db
    .select({
      source_doc_id: schema.nodes.source_doc_id,
      count: sql<number>`count(*)`,
    })
    .from(schema.nodes)
    .groupBy(schema.nodes.source_doc_id)
    .all();

  const nodeCountMap = Object.fromEntries(
    nodeCounts.map((r) => [r.source_doc_id, r.count])
  );

  return Response.json(
    docs.map((d) => ({
      ...d,
      node_count: nodeCountMap[d.id] ?? 0,
    }))
  );
}
