import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { eq, inArray } from 'drizzle-orm';
import type { Edge } from '@/db/schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get('doc_id') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '500', 10), 1000);

  const env = await getEnv();
  const db = getDb(env);

  const nodeRows = docId
    ? await db.select().from(schema.nodes).where(eq(schema.nodes.source_doc_id, docId)).limit(limit).all()
    : await db.select().from(schema.nodes).limit(limit).all();

  const nodeIds = nodeRows.map((n) => n.id);
  const truncated = nodeRows.length === limit;

  // D1 has a ~100 bound-parameter limit per statement — chunk the IN clause
  const edgeRows: Edge[] = [];
  if (nodeIds.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < nodeIds.length; i += 99) chunks.push(nodeIds.slice(i, i + 99));
    const results = await Promise.all(
      chunks.flatMap((chunk) => [
        db.select().from(schema.edges).where(inArray(schema.edges.source_id, chunk)).all(),
        db.select().from(schema.edges).where(inArray(schema.edges.target_id, chunk)).all(),
      ])
    );
    const seen = new Set<number>();
    for (const batch of results)
      for (const e of batch)
        if (!seen.has(e.id)) { seen.add(e.id); edgeRows.push(e); }
  }

  return Response.json({
    nodes: nodeRows,
    edges: edgeRows,
    truncated,
    total_nodes: nodeRows.length,
    total_edges: edgeRows.length,
  });
}
