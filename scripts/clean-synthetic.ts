#!/usr/bin/env tsx
// scripts/clean-synthetic.ts
// Removes all synthetic documents and their associated nodes, edges, and Vectorize vectors.
//
// Usage: npx tsx scripts/clean-synthetic.ts

const ACCOUNT_ID = '8527ec1369d46f55304a6f59ab5356e4';
const DATABASE_ID = 'c401b2f1-a1d1-4b15-b714-e297ca7d5ddc';
const API_TOKEN = 'cfat_JJP1FBjbWrh3ubBX2YXAEHCCyvTO3fEJvDmG8y7E1599f1eb';
const VECTORIZE_INDEX = 'simula-embeddings';

const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
const VECTORIZE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX}`;

async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await fetch(D1_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { result: { results: T[] }[] };
  return json.result?.[0]?.results ?? [];
}

async function vectorizeDeleteByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // Vectorize accepts max 1000 per request
  for (let i = 0; i < ids.length; i += 1000) {
    const batch = ids.slice(i, i + 1000);
    const res = await fetch(`${VECTORIZE_URL}/delete-by-ids`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: batch }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`Vectorize delete warning (${res.status}): ${text.slice(0, 200)}`);
    } else {
      console.log(`  Deleted ${batch.length} vectors from Vectorize`);
    }
  }
}

async function main() {
  console.log('=== Synthetic Data Cleanup ===\n');

  // Step 1: Find synthetic documents
  const syntheticDocs = await d1Query<{ id: string }>(
    `SELECT id FROM documents WHERE source_type = 'synthetic'`,
  );

  if (syntheticDocs.length === 0) {
    console.log('No synthetic documents found — nothing to clean up.');
    return;
  }

  const docIds = syntheticDocs.map((d) => d.id);
  console.log(`Found ${docIds.length} synthetic document(s):\n  ${docIds.join('\n  ')}\n`);

  // Step 2: Find all nodes from those documents
  const placeholders = docIds.map(() => '?').join(', ');
  const orphanNodes = await d1Query<{ id: string }>(
    `SELECT id FROM nodes WHERE source_doc_id IN (${placeholders})`,
    docIds,
  );

  const nodeIds = orphanNodes.map((n) => n.id);
  console.log(`Found ${nodeIds.length} associated node(s) to remove`);

  if (nodeIds.length > 0) {
    const nodePh = nodeIds.map(() => '?').join(', ');

    // Step 3: Delete edges touching those nodes
    const edgeResult = await d1Query<{ changes: number }>(
      `DELETE FROM edges WHERE source_id IN (${nodePh}) OR target_id IN (${nodePh})`,
      [...nodeIds, ...nodeIds],
    );
    console.log(`  Deleted edges (changes: ${edgeResult[0]?.changes ?? '?'})`);

    // Step 4: Delete from Vectorize
    await vectorizeDeleteByIds(nodeIds);

    // Step 5: Delete nodes
    await d1Query(
      `DELETE FROM nodes WHERE id IN (${nodePh})`,
      nodeIds,
    );
    console.log(`  Deleted ${nodeIds.length} nodes`);
  }

  // Step 6: Delete documents
  await d1Query(
    `DELETE FROM documents WHERE source_type = 'synthetic'`,
  );
  console.log(`  Deleted ${docIds.length} synthetic document(s)\n`);

  // Verify
  const remaining = await d1Query<{ count: number }>(
    `SELECT COUNT(*) as count FROM documents WHERE source_type = 'synthetic'`,
  );
  console.log(`✓ Remaining synthetic documents: ${remaining[0]?.count ?? 0}`);
  console.log('Cleanup complete.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
