import { d1Query } from '@/lib/d1-rest';

interface NodeRow {
  id: string;
  type: string;
  name: string;
  description: string | null;
  metadata: string | null;
  source_doc_id: string | null;
  created_at: string | null;
}

interface EdgeRow {
  id: number;
  source_id: string;
  target_id: string;
  relationship: string;
  weight: number;
  metadata: string | null;
  created_at: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get('doc_id') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '500', 10), 1000);

  try {
    const nodeRows = docId
      ? await d1Query<NodeRow>(
          'SELECT id, type, name, description, metadata, source_doc_id, created_at FROM nodes WHERE source_doc_id = ? LIMIT ?',
          [docId, limit]
        )
      : await d1Query<NodeRow>(
          'SELECT id, type, name, description, metadata, source_doc_id, created_at FROM nodes LIMIT ?',
          [limit]
        );

    const nodeIds = nodeRows.map((n) => n.id);
    const truncated = nodeRows.length === limit;

    // Fetch edges connected to any of the returned nodes
    // D1 REST API has a ~100 bound-parameter limit — chunk the IN clause
    const edgeRows: EdgeRow[] = [];
    if (nodeIds.length > 0) {
      const seen = new Set<number>();
      const chunks: string[][] = [];
      for (let i = 0; i < nodeIds.length; i += 49) chunks.push(nodeIds.slice(i, i + 49));

      for (const chunk of chunks) {
        const placeholders = chunk.map(() => '?').join(',');
        const batch = await d1Query<EdgeRow>(
          `SELECT id, source_id, target_id, relationship, weight, metadata, created_at FROM edges WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})`,
          [...chunk, ...chunk]
        );
        for (const e of batch) {
          if (!seen.has(e.id)) { seen.add(e.id); edgeRows.push(e); }
        }
      }
    }

    return Response.json({
      nodes: nodeRows,
      edges: edgeRows,
      truncated,
      total_nodes: nodeRows.length,
      total_edges: edgeRows.length,
    });
  } catch (err) {
    console.error('[graph]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
