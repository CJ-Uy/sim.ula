// src/app/api/admin/reembed/route.ts
// One-shot admin endpoint: embeds all un-vectorized nodes from specific doc IDs
// and upserts them to Vectorize using the Worker binding.
//
// POST /api/admin/reembed
// Body (optional): { doc_ids: string[] }  — if omitted, embeds ALL nodes in D1
//
// Returns a streaming SSE log so you can watch progress.

import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { inArray, isNull } from 'drizzle-orm';
import { getEmbedding } from '@/lib/llm';

export const runtime = 'edge';

export async function POST(request: Request) {
  const env = await getEnv();
  const db = getDb(env);

  let docIds: string[] | null = null;
  try {
    const body = await request.json() as { doc_ids?: string[] };
    if (body.doc_ids?.length) docIds = body.doc_ids;
  } catch {}

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ msg })}\n\n`));
      };

      try {
        // Fetch target nodes
        let nodes;
        if (docIds) {
          nodes = await db.select().from(schema.nodes)
            .where(inArray(schema.nodes.source_doc_id, docIds))
            .all();
        } else {
          nodes = await db.select().from(schema.nodes).all();
        }

        send(`Found ${nodes.length} nodes to embed`);

        let success = 0;
        let failed = 0;

        for (const node of nodes) {
          const text = `${node.name}: ${node.description ?? ''}`;
          try {
            const embedding = await getEmbedding(env, text);
            await env.VECTOR_INDEX.upsert([{
              id: node.id,
              values: embedding,
              metadata: {
                type: node.type,
                name: node.name,
                doc_id: node.source_doc_id ?? '',
              },
            }]);
            success++;
            if (success % 10 === 0) {
              send(`Progress: ${success}/${nodes.length} embedded`);
            }
          } catch (err) {
            failed++;
            send(`WARN: failed to embed "${node.id}": ${err}`);
          }
        }

        send(`Done. ${success} succeeded, ${failed} failed.`);
      } catch (err) {
        send(`ERROR: ${err}`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
