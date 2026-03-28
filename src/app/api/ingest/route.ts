// app/api/ingest/route.ts
import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { extractEntities } from '@/lib/extract';
import { getEmbedding } from '@/lib/llm';
import type { IngestRequest } from '@/lib/types';

export const runtime = 'edge';

export async function POST(request: Request) {
  const env = getEnv();
  const body = (await request.json()) as IngestRequest;

  if (!body.documents?.length) {
    return Response.json(
      { error: 'documents array is required and must not be empty' },
      { status: 400 }
    );
  }

  const db = getDb(env);
  const results = [];

  for (const doc of body.documents) {
    if (!doc.title || !doc.content || !doc.source_type) {
      results.push({ title: doc.title ?? 'unknown', error: 'title, content, and source_type are required' });
      continue;
    }

    const docId = doc.id ?? `doc-${crypto.randomUUID().substring(0, 8)}`;

    try {
      // 1. Store raw text in R2
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

      // 3. Extract entities via LLM (model override for phi4 support)
      const extracted = await extractEntities(env, doc.content, docId, doc.model);

      // 4. Insert nodes + embeddings
      let nodesInserted = 0;
      for (const node of extracted.nodes) {
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

        const textToEmbed = `${node.type}: ${node.name}. ${node.description ?? ''}`;
        const embedding = await getEmbedding(env, textToEmbed);

        await env.VECTOR_INDEX.upsert([{
          id: node.id,
          values: embedding,
          metadata: { type: node.type, name: node.name, doc_id: docId },
        }]);

        nodesInserted++;
      }

      // 5. Insert edges
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
        model_used: doc.model ?? env.OLLAMA_MODEL,
      });
    } catch (err) {
      results.push({ doc_id: docId, title: doc.title, status: 'error', error: String(err) });
    }
  }

  return Response.json({
    results,
    summary: {
      total: results.length,
      succeeded: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'error').length,
    },
  });
}
