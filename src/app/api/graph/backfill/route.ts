// app/api/graph/backfill/route.ts
import { getEnv } from '@/lib/env';
import { getDb, schema } from '@/db';
import { eq, sql } from 'drizzle-orm';

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

export async function POST() {
  const env = await getEnv();
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

        // ── Phase 7: Clean up orphan edges ──────────────────────────
        send({ step: 'cleaning', message: 'Removing orphan edges…', progress: 92 });

        const orphanEdgeResult = await db.run(sql`
          DELETE FROM edges
          WHERE source_id NOT IN (SELECT id FROM nodes)
             OR target_id NOT IN (SELECT id FROM nodes)
        `);
        const orphanEdgesRemoved = orphanEdgeResult.meta?.changes ?? 0;

        send({
          step: 'done',
          message: `Backfill complete: ${typesFixed} types fixed, ${edgesCreated} edges created, ${orphansFixed} orphans reconnected, ${orphanEdgesRemoved} dead edges removed`,
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
