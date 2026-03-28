// app/api/docs/[id]/route.ts
import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { eq } from 'drizzle-orm';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const env = await getEnv();
  const db = getDb(env);
  const { id } = await params;

  // Get the doc to find its r2_key
  const doc = await db.select().from(schema.documents).where(eq(schema.documents.id, id)).get();
  if (!doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }

  // Get all node IDs from this doc so we can delete their edges too
  const nodes = await db
    .select({ id: schema.nodes.id })
    .from(schema.nodes)
    .where(eq(schema.nodes.source_doc_id, id))
    .all();

  const nodeIds = nodes.map((n) => n.id);

  // Delete edges referencing these nodes
  for (const nodeId of nodeIds) {
    await db.delete(schema.edges).where(eq(schema.edges.source_id, nodeId));
    await db.delete(schema.edges).where(eq(schema.edges.target_id, nodeId));
  }

  // Delete nodes
  await db.delete(schema.nodes).where(eq(schema.nodes.source_doc_id, id));

  // Delete from Vectorize
  if (nodeIds.length > 0) {
    await env.VECTOR_INDEX.deleteByIds(nodeIds);
  }

  // Delete from R2
  if (doc.r2_key) {
    await env.DOCS_BUCKET.delete(doc.r2_key);
  }

  // Delete document record
  await db.delete(schema.documents).where(eq(schema.documents.id, id));

  return Response.json({ deleted: id, nodes_removed: nodeIds.length });
}
