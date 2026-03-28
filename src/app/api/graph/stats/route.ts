// app/api/graph/stats/route.ts
import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { sql, count } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET() {
  const env = await getEnv();
  const db = getDb(env);

  const [nodeCount, edgeCount, docCount, simCount, nodesByType, edgesByType] =
    await Promise.all([
      db.select({ count: count() }).from(schema.nodes).get(),
      db.select({ count: count() }).from(schema.edges).get(),
      db.select({ count: count() }).from(schema.documents).get(),
      db.select({ count: count() }).from(schema.simulations).get(),
      db
        .select({ type: schema.nodes.type, count: count() })
        .from(schema.nodes)
        .groupBy(schema.nodes.type)
        .all(),
      db
        .select({ relationship: schema.edges.relationship, count: count() })
        .from(schema.edges)
        .groupBy(schema.edges.relationship)
        .orderBy(sql`count(*) DESC`)
        .all(),
    ]);

  return Response.json({
    nodes: nodeCount?.count ?? 0,
    edges: edgeCount?.count ?? 0,
    documents: docCount?.count ?? 0,
    simulations: simCount?.count ?? 0,
    nodes_by_type: nodesByType,
    edges_by_type: edgesByType,
  });
}
