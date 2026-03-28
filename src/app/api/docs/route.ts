// app/api/docs/route.ts
import { d1Query } from '@/lib/d1-rest';

interface DocRow {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  r2_key: string | null;
  summary: string | null;
  date_published: string | null;
  ingested_at: string | null;
}

interface NodeCount {
  source_doc_id: string | null;
  count: number;
}

export async function GET() {
  try {
    const docs = await d1Query<DocRow>(
      'SELECT id, title, source_type, source_url, r2_key, summary, date_published, ingested_at FROM documents ORDER BY ingested_at DESC'
    );

    const nodeCounts = await d1Query<NodeCount>(
      'SELECT source_doc_id, count(*) as count FROM nodes GROUP BY source_doc_id'
    );

    const nodeCountMap = Object.fromEntries(
      nodeCounts.map((r) => [r.source_doc_id, r.count])
    );

    return Response.json(
      docs.map((d) => ({
        ...d,
        node_count: nodeCountMap[d.id] ?? 0,
      }))
    );
  } catch (err) {
    console.error('[docs]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
