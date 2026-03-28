// app/api/graph/backfill/route.ts
import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { getEmbeddings } from '@/lib/llm';
import type { Env } from '@/lib/types';

/**
 * Map invalid/non-standard node types to the 6 valid enum values.
 * SQLite doesn't enforce the enum so these slipped in from LLM output.
 */
const TYPE_REMAP: Record<string, string> = {
  // Capitalized variants
  'Policy': 'policy',
  'Location': 'location',
  'Stakeholder': 'stakeholder',
  'Outcome': 'outcome',
  'Event': 'event',
  'Metric': 'metric',
  'Risk': 'outcome',
  // Non-standard types → closest valid type
  'risk': 'outcome',
  'program': 'policy',
  'law': 'policy',
  'supporter': 'stakeholder',
  'opposition': 'stakeholder',
  'support-opposition': 'stakeholder',
  'Support/Opposition': 'stakeholder',
};

const VALID_TYPES = new Set(['policy', 'location', 'stakeholder', 'outcome', 'event', 'metric']);

// Similarity threshold for cross-linking: lower than the 0.87 merge threshold
// so we connect related-but-distinct nodes without collapsing them.
const CROSS_LINK_THRESHOLD = 0.82;
// Node types eligible for cross-linking (skip policy — too broad, creates noise)
const CROSSLINK_TYPES = new Set(['stakeholder', 'outcome', 'event', 'metric']);

export async function POST() {
  const env = await getEnv() as Env;
  const db = getDb(env);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // ── Phase 1: Fix invalid node types ─────────────────────────
        send({ step: 'fixing-types', message: 'Fixing invalid node types…', progress: 0 });

        const allNodesRaw = await db
          .select({ id: schema.nodes.id, type: schema.nodes.type, name: schema.nodes.name, source_doc_id: schema.nodes.source_doc_id })
          .from(schema.nodes)
          .all();
        // Use a mutable type field since we may remap invalid types
        const allNodes = allNodesRaw.map((n) => ({ ...n, type: n.type as string }));

        const nodeNameById = new Map<string, string>();
        for (const n of allNodes) nodeNameById.set(n.id, n.name);

        let typesFixed = 0;
        for (const node of allNodes) {
          const remapped = TYPE_REMAP[node.type];
          if (remapped) {
            await db.update(schema.nodes)
              .set({ type: remapped as typeof schema.nodes.$inferInsert['type'] })
              .where(eq(schema.nodes.id, node.id));
            node.type = remapped; // update in-memory too
            typesFixed++;
          }
        }

        send({
          step: 'fixing-types',
          message: `Fixed ${typesFixed} nodes with invalid types`,
          progress: 10,
          types_fixed: typesFixed,
        });

        // ── Phase 2: Ensure quezon-city node exists ─────────────────
        const qcExists = await db
          .select({ id: schema.nodes.id })
          .from(schema.nodes)
          .where(eq(schema.nodes.id, 'quezon-city'))
          .get();

        if (!qcExists) {
          await db.insert(schema.nodes).values({
            id: 'quezon-city',
            type: 'location',
            name: 'Quezon City',
            description: 'Quezon City, the largest city in Metro Manila, Philippines.',
            metadata: JSON.stringify({ region: 'NCR', district_count: 6, barangay_count: 142 }),
            source_doc_id: null,
          }).onConflictDoNothing();
        }

        // ── Phase 3: Connect ALL locations to quezon-city ───────────
        // Since the entire dataset is QC-specific, every location that
        // isn't quezon-city itself should have a located_in edge to it.
        send({ step: 'locations', message: 'Connecting locations to Quezon City…', progress: 15 });

        const locationNodes = allNodes.filter(
          (n) => n.type === 'location' && n.id !== 'quezon-city'
        );

        let edgesCreated = 0;

        for (const loc of locationNodes) {
          const existing = await db
            .select({ id: schema.edges.id })
            .from(schema.edges)
            .where(
              sql`${schema.edges.source_id} = ${loc.id}
                AND ${schema.edges.target_id} = 'quezon-city'
                AND ${schema.edges.relationship} = 'located_in'`
            )
            .get();

          if (!existing) {
            await db.insert(schema.edges).values({
              source_id: loc.id,
              target_id: 'quezon-city',
              relationship: 'located_in',
              metadata: JSON.stringify({ detail: `${loc.name} is a location within Quezon City` }),
            });
            edgesCreated++;
          }
        }

        send({
          step: 'locations',
          message: `Connected ${edgesCreated} locations to Quezon City`,
          progress: 40,
          edges_created: edgesCreated,
        });

        // ── Phase 4: Connect all policies to quezon-city ────────────
        send({ step: 'policies', message: 'Connecting policies to Quezon City…', progress: 45 });

        const policyNodes = allNodes.filter((n) => n.type === 'policy');

        for (const policy of policyNodes) {
          const existing = await db
            .select({ id: schema.edges.id })
            .from(schema.edges)
            .where(
              sql`${schema.edges.source_id} = ${policy.id}
                AND ${schema.edges.target_id} = 'quezon-city'
                AND ${schema.edges.relationship} = 'enacted_in'`
            )
            .get();

          if (!existing) {
            await db.insert(schema.edges).values({
              source_id: policy.id,
              target_id: 'quezon-city',
              relationship: 'enacted_in',
              metadata: JSON.stringify({ detail: `${nodeNameById.get(policy.id) ?? policy.id} is enacted in Quezon City` }),
            });
            edgesCreated++;
          }
        }

        send({
          step: 'policies',
          message: `Policies linked. Total edges created: ${edgesCreated}`,
          progress: 60,
          edges_created: edgesCreated,
        });

        // ── Phase 5: Connect orphan nodes to source document policies ──
        // Nodes that still have 0 edges get connected to policies from
        // the same source document via related_to edges.
        send({ step: 'orphans', message: 'Connecting remaining orphan nodes…', progress: 65 });

        // Refresh edge counts
        const edgeCounts = await db.all<{ node_id: string; cnt: number }>(sql`
          SELECT node_id, COUNT(*) as cnt FROM (
            SELECT source_id as node_id FROM edges
            UNION ALL
            SELECT target_id as node_id FROM edges
          ) GROUP BY node_id
        `);
        const edgeCountMap = new Map(edgeCounts.map((r) => [r.node_id, r.cnt]));

        const orphans = allNodes.filter(
          (n) => !edgeCountMap.has(n.id) && n.id !== 'quezon-city'
        );

        // Build a map of source_doc_id → policy node IDs
        const docToPolicies = new Map<string, string[]>();
        for (const n of allNodes) {
          if (n.type === 'policy' && n.source_doc_id) {
            const list = docToPolicies.get(n.source_doc_id) ?? [];
            list.push(n.id);
            docToPolicies.set(n.source_doc_id, list);
          }
        }

        // Generate a human-readable detail based on the relationship type
        function describeEdge(rel: string, policyName: string, orphanName: string): string {
          switch (rel) {
            case 'affected': return `${policyName} impacts ${orphanName}`;
            case 'resulted_in': return `${policyName} produced this outcome`;
            case 'measured_by': return `Quantitative indicator for ${policyName}`;
            case 'enacted_in': return `${policyName} is implemented in ${orphanName}`;
            default: return `Connected to ${policyName} from the same policy document`;
          }
        }

        let orphansFixed = 0;
        for (const orphan of orphans) {
          // Try to connect to a policy from the same source document
          const policies = orphan.source_doc_id
            ? docToPolicies.get(orphan.source_doc_id)
            : undefined;

          if (policies && policies.length > 0) {
            // Pick the appropriate relationship based on type
            const rel = orphan.type === 'stakeholder' ? 'affected'
              : orphan.type === 'outcome' ? 'resulted_in'
              : orphan.type === 'metric' ? 'measured_by'
              : orphan.type === 'event' ? 'related_to'
              : orphan.type === 'location' ? 'enacted_in'
              : 'related_to';

            const sourceId = policies[0];
            const targetId = orphan.id;
            const detail = describeEdge(rel, nodeNameById.get(sourceId) ?? sourceId, orphan.name);

            await db.insert(schema.edges).values({
              source_id: sourceId,
              target_id: targetId,
              relationship: rel as typeof schema.edges.$inferInsert['relationship'],
              metadata: JSON.stringify({ detail }),
            });
            edgesCreated++;
            orphansFixed++;
          } else {
            // No source doc policy found — connect to quezon-city via related_to
            await db.insert(schema.edges).values({
              source_id: orphan.id,
              target_id: 'quezon-city',
              relationship: 'related_to',
              metadata: JSON.stringify({ detail: `${orphan.name} is related to Quezon City governance` }),
            });
            edgesCreated++;
            orphansFixed++;
          }
        }

        send({
          step: 'orphans',
          message: `Fixed ${orphansFixed} orphan nodes. Total edges: ${edgesCreated}`,
          progress: 85,
          edges_created: edgesCreated,
          orphans_fixed: orphansFixed,
        });

        // ── Phase 6: Rewrite generic backfill metadata on existing edges ──
        send({ step: 'rewriting', message: 'Rewriting generic edge descriptions…', progress: 85 });

        const GENERIC_PATTERNS = [
          'Backfill:',
          'Auto-enriched:',
          'Auto-enriched during ingestion',
        ];

        const allEdges = await db
          .select({
            id: schema.edges.id,
            source_id: schema.edges.source_id,
            target_id: schema.edges.target_id,
            relationship: schema.edges.relationship,
            metadata: schema.edges.metadata,
          })
          .from(schema.edges)
          .all();

        let edgesRewritten = 0;
        for (const edge of allEdges) {
          let meta: Record<string, unknown> = {};
          try { if (edge.metadata) meta = JSON.parse(edge.metadata); } catch { /* skip */ }
          const detail = typeof meta.detail === 'string' ? meta.detail : '';

          if (!GENERIC_PATTERNS.some((p) => detail.startsWith(p))) continue;

          const srcName = nodeNameById.get(edge.source_id) ?? edge.source_id;
          const tgtName = nodeNameById.get(edge.target_id) ?? edge.target_id;

          let newDetail: string;
          switch (edge.relationship) {
            case 'located_in':
              newDetail = `${srcName} is a location within ${tgtName}`;
              break;
            case 'enacted_in':
              newDetail = `${srcName} is enacted in ${tgtName}`;
              break;
            case 'affected':
              newDetail = `${srcName} impacts ${tgtName}`;
              break;
            case 'resulted_in':
              newDetail = `${srcName} produced this outcome`;
              break;
            case 'measured_by':
              newDetail = `Quantitative indicator for ${srcName}`;
              break;
            case 'related_to':
              newDetail = `${srcName} is related to ${tgtName}`;
              break;
            default:
              newDetail = `${srcName} → ${edge.relationship.replace(/_/g, ' ')} → ${tgtName}`;
          }

          await db.update(schema.edges)
            .set({ metadata: JSON.stringify({ ...meta, detail: newDetail }) })
            .where(eq(schema.edges.id, edge.id));
          edgesRewritten++;
        }

        send({
          step: 'rewriting',
          message: `Rewrote ${edgesRewritten} generic edge descriptions`,
          progress: 90,
          edges_rewritten: edgesRewritten,
        });

        // ── Phase 7: Cross-link similar non-policy nodes ────────────
        // Leaf nodes (outcomes, stakeholders, events, metrics) connected to
        // different policies may be semantically related. We embed them and
        // use Vectorize to find close pairs, then add related_to edges so
        // the graph can be traversed across document boundaries.
        send({ step: 'crosslinking', message: 'Cross-linking similar nodes across documents…', progress: 92 });

        const crosslinkCandidates = allNodes.filter(
          (n) => CROSSLINK_TYPES.has(n.type) && n.id !== 'quezon-city'
        );

        // Build texts to embed in batch
        const texts = crosslinkCandidates.map((n) => `${n.type}: ${n.name}`);
        let crossLinksCreated = 0;

        if (crosslinkCandidates.length > 0) {
          // Embed in batches of 20 to avoid timeout
          const BATCH = 20;
          const embeddings: number[][] = [];
          for (let i = 0; i < texts.length; i += BATCH) {
            const batch = await getEmbeddings(env, texts.slice(i, i + BATCH));
            embeddings.push(...batch);
          }

          // Build a set of existing edges to avoid duplicates
          const existingPairs = new Set<string>();
          for (const edge of allEdges) {
            existingPairs.add(`${edge.source_id}|${edge.target_id}`);
            existingPairs.add(`${edge.target_id}|${edge.source_id}`);
          }

          for (let i = 0; i < crosslinkCandidates.length; i++) {
            const node = crosslinkCandidates[i];
            const embedding = embeddings[i];
            if (!embedding) continue;

            // Query Vectorize for similar nodes
            const results = await env.VECTOR_INDEX.query(embedding, {
              topK: 5,
              returnMetadata: 'all',
            });

            for (const match of results.matches) {
              if (match.score < CROSS_LINK_THRESHOLD) continue;
              if (match.id === node.id) continue;
              // Only link same-type nodes to keep edges semantically clean
              const matchType = (match.metadata as Record<string, string> | null)?.type;
              if (matchType !== node.type) continue;
              // Skip if pair already connected in either direction
              if (existingPairs.has(`${node.id}|${match.id}`)) continue;

              const matchName = nodeNameById.get(match.id) ?? match.id;
              await db.insert(schema.edges).values({
                source_id: node.id,
                target_id: match.id,
                relationship: 'related_to',
                weight: match.score,
                metadata: JSON.stringify({
                  detail: `${node.name} and ${matchName} are semantically related (similarity ${match.score.toFixed(2)})`,
                  similarity: match.score,
                  cross_link: true,
                }),
              });
              // Track both directions so we don't add reverse edge
              existingPairs.add(`${node.id}|${match.id}`);
              existingPairs.add(`${match.id}|${node.id}`);
              crossLinksCreated++;
              edgesCreated++;
            }
          }
        }

        send({
          step: 'crosslinking',
          message: `Created ${crossLinksCreated} cross-document links`,
          progress: 95,
          edges_created: edgesCreated,
          cross_links: crossLinksCreated,
        });

        // ── Phase 8: Clean up orphan edges ──────────────────────────
        send({ step: 'cleaning', message: 'Removing orphan edges…', progress: 97 });

        const orphanEdgeResult = await db.run(sql`
          DELETE FROM edges
          WHERE source_id NOT IN (SELECT id FROM nodes)
             OR target_id NOT IN (SELECT id FROM nodes)
        `);
        const orphanEdgesRemoved = orphanEdgeResult.meta?.changes ?? 0;

        send({
          step: 'done',
          message: `Backfill complete: ${typesFixed} types fixed, ${edgesCreated} edges created (${crossLinksCreated} cross-links), ${orphanEdgesRemoved} dead edges removed`,
          progress: 100,
          types_fixed: typesFixed,
          edges_created: edgesCreated,
          orphans_fixed: orphansFixed,
          orphan_edges_removed: orphanEdgesRemoved,
        });
      } catch (err) {
        send({ step: 'error', message: String(err) });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
