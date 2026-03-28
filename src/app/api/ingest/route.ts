// app/api/ingest/route.ts
import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { extractEntities, resolveEntities } from '@/lib/extract';
import { getEmbedding } from '@/lib/llm';
import type { IngestRequest } from '@/lib/types';

export const runtime = 'edge';

export async function POST(request: Request) {
  const env = await getEnv();
  const body = (await request.json()) as IngestRequest;

  if (!body.documents?.length) {
    return Response.json(
      { error: 'documents array is required and must not be empty' },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const db = getDb(env);
      const results = [];

      for (const doc of body.documents) {
        if (!doc.title || !doc.content || !doc.source_type) {
          results.push({ title: doc.title ?? 'unknown', error: 'title, content, and source_type are required' });
          continue;
        }

        const docId = doc.id ?? `doc-${crypto.randomUUID().substring(0, 8)}`;
        const modelLabel = doc.model ?? env.OLLAMA_MODEL;

        try {
          // 1. Store raw text in R2
          send({ step: 'storing', message: 'Storing document…' });
          const r2Key = `docs/${docId}.txt`;
          await env.DOCS_BUCKET.put(r2Key, doc.content);

          // 2. Store document metadata in D1 via Drizzle
          await db
            .insert(schema.documents)
            .values({
              id: docId,
              title: doc.title,
              source_type: doc.source_type,
              source_url: doc.source_url ?? null,
              r2_key: r2Key,
              date_published: doc.date_published ?? null,
            })
            .onConflictDoUpdate({
              target: schema.documents.id,
              set: { title: doc.title, source_url: doc.source_url ?? null },
            });

          // 3. Extract entities via LLM
          send({ step: 'extracting', message: `Extracting entities with ${modelLabel}…` });
          const extracted = await extractEntities(env, doc.content, docId, doc.model, body.disable_fallback);

          // 3.5 Resolve extracted entities against existing knowledge base nodes.
          // Nodes that are sufficiently similar to an existing node of the same type
          // are remapped to that node's canonical ID so both documents share it.
          // This also pre-computes embeddings so step 4 can reuse them.
          send({ step: 'resolving', message: `Resolving ${extracted.nodes.length} entities against knowledge base…` });
          const { nodes: resolvedNodes, edges: resolvedEdges, embeddingCache } =
            await resolveEntities(env, extracted.nodes, extracted.edges);
          extracted.nodes = resolvedNodes;
          extracted.edges = resolvedEdges;

          // 4. Insert nodes + embeddings
          let nodesInserted = 0;
          const totalNodes = extracted.nodes.length;
          for (const node of extracted.nodes) {
            send({ step: 'embedding', message: `Embedding node ${nodesInserted + 1} of ${totalNodes}…` });

            await db
              .insert(schema.nodes)
              .values({
                id: node.id,
                type: node.type as typeof schema.nodes.$inferInsert['type'],
                name: node.name,
                description: node.description ?? null,
                metadata: JSON.stringify(node.metadata ?? {}),
                source_doc_id: docId,
              })
              .onConflictDoUpdate({
                target: schema.nodes.id,
                set: {
                  name: node.name,
                  description: node.description ?? null,
                  metadata: JSON.stringify(node.metadata ?? {}),
                },
              });

            // Reuse the embedding computed during resolution — avoids a second LLM call
            const textToEmbed = `${node.type}: ${node.name}. ${node.description ?? ''}`;
            const embedding = embeddingCache.get(node.id) ?? await getEmbedding(env, textToEmbed);

            await env.VECTOR_INDEX.upsert([{
              id: node.id,
              values: embedding,
              metadata: { type: node.type, name: node.name, doc_id: docId },
            }]);

            nodesInserted++;
          }

          // 5. Insert edges
          send({ step: 'edges', message: `Saving ${extracted.edges.length} relationships…` });
          let edgesInserted = 0;
          for (const edge of extracted.edges) {
            await db.insert(schema.edges).values({
              source_id: edge.source_id,
              target_id: edge.target_id,
              relationship: edge.relationship as typeof schema.edges.$inferInsert['relationship'],
              metadata: JSON.stringify(edge.metadata ?? {}),
            });
            edgesInserted++;
          }

          results.push({
            doc_id: docId,
            title: doc.title,
            status: 'success',
            nodes_extracted: nodesInserted,
            edges_extracted: edgesInserted,
            model_used: modelLabel,
          });
        } catch (err) {
          results.push({ doc_id: docId, title: doc.title, status: 'error', error: String(err) });
        }
      }

      send({
        step: 'done',
        results,
        summary: {
          total: results.length,
          succeeded: results.filter((r) => r.status === 'success').length,
          failed: results.filter((r) => r.status === 'error').length,
        },
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
