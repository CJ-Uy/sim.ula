// src/lib/scraper.ts
// Core scraping logic: city registry, proximity chains, orchestration

import type { Env, CityConfig, ProximityChain, ScrapeEvent } from './types';
import { getDb, schema } from '@/db';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { searchSearXNG } from './research';
import { extractEntities, resolveEntities, enrichLocationEdges, fixOrphanNodes, crossLinkNewNodes } from './extract';
import { getEmbedding } from './llm';
import type { CityContext } from './extract';

// ── City Registry ───────────────────────────────────────────────────────────

export const CITY_REGISTRY: CityConfig[] = [
  // Ring 0 — Quezon City itself (6 topics/run, every cycle)
  { id: 'quezon-city', name: 'Quezon City', country: 'Philippines', region: 'NCR', lat: 14.676, lng: 121.0437, ring: 0, queriesPerRun: 6, everyNthCycle: 1 },

  // Ring 1 — Metro Manila (5 topics/run, every cycle)
  { id: 'manila', name: 'Manila', country: 'Philippines', region: 'NCR', lat: 14.5995, lng: 120.9842, ring: 1, queriesPerRun: 5, everyNthCycle: 1 },
  { id: 'makati', name: 'Makati', country: 'Philippines', region: 'NCR', lat: 14.5547, lng: 121.0244, ring: 1, queriesPerRun: 5, everyNthCycle: 1 },
  { id: 'pasig', name: 'Pasig', country: 'Philippines', region: 'NCR', lat: 14.5764, lng: 121.0851, ring: 1, queriesPerRun: 5, everyNthCycle: 1 },
  { id: 'caloocan', name: 'Caloocan', country: 'Philippines', region: 'NCR', lat: 14.6500, lng: 120.9667, ring: 1, queriesPerRun: 5, everyNthCycle: 1 },
  { id: 'taguig', name: 'Taguig', country: 'Philippines', region: 'NCR', lat: 14.5176, lng: 121.0509, ring: 1, queriesPerRun: 4, everyNthCycle: 1 },
  { id: 'marikina', name: 'Marikina', country: 'Philippines', region: 'NCR', lat: 14.6507, lng: 121.1029, ring: 1, queriesPerRun: 4, everyNthCycle: 1 },
  { id: 'mandaluyong', name: 'Mandaluyong', country: 'Philippines', region: 'NCR', lat: 14.5794, lng: 121.0359, ring: 1, queriesPerRun: 4, everyNthCycle: 1 },
  { id: 'san-juan', name: 'San Juan', country: 'Philippines', region: 'NCR', lat: 14.6019, lng: 121.0355, ring: 1, queriesPerRun: 3, everyNthCycle: 1 },
  { id: 'paranaque', name: 'Parañaque', country: 'Philippines', region: 'NCR', lat: 14.4793, lng: 121.0198, ring: 1, queriesPerRun: 3, everyNthCycle: 1 },
  { id: 'las-pinas', name: 'Las Piñas', country: 'Philippines', region: 'NCR', lat: 14.4445, lng: 120.9939, ring: 1, queriesPerRun: 3, everyNthCycle: 1 },
  { id: 'muntinlupa', name: 'Muntinlupa', country: 'Philippines', region: 'NCR', lat: 14.4081, lng: 121.0415, ring: 1, queriesPerRun: 3, everyNthCycle: 1 },
  { id: 'valenzuela', name: 'Valenzuela', country: 'Philippines', region: 'NCR', lat: 14.6942, lng: 120.9840, ring: 1, queriesPerRun: 3, everyNthCycle: 1 },

  // Ring 2 — Philippine cities (3 topics/run, every cycle)
  { id: 'cebu-city', name: 'Cebu City', country: 'Philippines', region: 'Central Visayas', lat: 10.3157, lng: 123.8854, ring: 2, queriesPerRun: 3, everyNthCycle: 1 },
  { id: 'davao-city', name: 'Davao City', country: 'Philippines', region: 'Davao Region', lat: 7.1907, lng: 125.4553, ring: 2, queriesPerRun: 3, everyNthCycle: 1 },
  { id: 'baguio', name: 'Baguio', country: 'Philippines', region: 'Cordillera', lat: 16.4023, lng: 120.5960, ring: 2, queriesPerRun: 3, everyNthCycle: 1 },
  { id: 'iloilo-city', name: 'Iloilo City', country: 'Philippines', region: 'Western Visayas', lat: 10.7202, lng: 122.5621, ring: 2, queriesPerRun: 3, everyNthCycle: 1 },
  { id: 'zamboanga', name: 'Zamboanga', country: 'Philippines', region: 'Zamboanga Peninsula', lat: 6.9214, lng: 122.0790, ring: 2, queriesPerRun: 2, everyNthCycle: 1 },
  { id: 'cagayan-de-oro', name: 'Cagayan de Oro', country: 'Philippines', region: 'Northern Mindanao', lat: 8.4542, lng: 124.6319, ring: 2, queriesPerRun: 2, everyNthCycle: 1 },
  { id: 'general-santos', name: 'General Santos', country: 'Philippines', region: 'SOCCSKSARGEN', lat: 6.1164, lng: 125.1716, ring: 2, queriesPerRun: 2, everyNthCycle: 1 },
  { id: 'angeles-city', name: 'Angeles City', country: 'Philippines', region: 'Central Luzon', lat: 15.1450, lng: 120.5887, ring: 2, queriesPerRun: 2, everyNthCycle: 1 },

  // Ring 3 — ASEAN cities (Singapore prioritized: 4 topics, every cycle; others: 2, every 3rd)
  { id: 'singapore', name: 'Singapore', country: 'Singapore', region: 'Southeast Asia', lat: 1.3521, lng: 103.8198, ring: 3, queriesPerRun: 4, everyNthCycle: 1 },
  { id: 'kuala-lumpur', name: 'Kuala Lumpur', country: 'Malaysia', region: 'Southeast Asia', lat: 3.1390, lng: 101.6869, ring: 3, queriesPerRun: 2, everyNthCycle: 3 },
  { id: 'jakarta', name: 'Jakarta', country: 'Indonesia', region: 'Southeast Asia', lat: -6.2088, lng: 106.8456, ring: 3, queriesPerRun: 2, everyNthCycle: 3 },
  { id: 'bangkok', name: 'Bangkok', country: 'Thailand', region: 'Southeast Asia', lat: 13.7563, lng: 100.5018, ring: 3, queriesPerRun: 2, everyNthCycle: 3 },
  { id: 'ho-chi-minh', name: 'Ho Chi Minh City', country: 'Vietnam', region: 'Southeast Asia', lat: 10.8231, lng: 106.6297, ring: 3, queriesPerRun: 2, everyNthCycle: 3 },
  { id: 'hanoi', name: 'Hanoi', country: 'Vietnam', region: 'Southeast Asia', lat: 21.0285, lng: 105.8542, ring: 3, queriesPerRun: 2, everyNthCycle: 3 },

  // Ring 4 — Global innovation cities (1 topic/run, every 5th cycle)
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', region: 'East Asia', lat: 35.6762, lng: 139.6503, ring: 4, queriesPerRun: 1, everyNthCycle: 5 },
  { id: 'seoul', name: 'Seoul', country: 'South Korea', region: 'East Asia', lat: 37.5665, lng: 126.9780, ring: 4, queriesPerRun: 1, everyNthCycle: 5 },
  { id: 'amsterdam', name: 'Amsterdam', country: 'Netherlands', region: 'Europe', lat: 52.3676, lng: 4.9041, ring: 4, queriesPerRun: 1, everyNthCycle: 5 },
  { id: 'copenhagen', name: 'Copenhagen', country: 'Denmark', region: 'Europe', lat: 55.6761, lng: 12.5683, ring: 4, queriesPerRun: 1, everyNthCycle: 5 },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', region: 'Europe', lat: 41.3874, lng: 2.1686, ring: 4, queriesPerRun: 1, everyNthCycle: 5 },
  { id: 'bogota', name: 'Bogotá', country: 'Colombia', region: 'Latin America', lat: 4.7110, lng: -74.0721, ring: 4, queriesPerRun: 1, everyNthCycle: 5 },
  { id: 'medellin', name: 'Medellín', country: 'Colombia', region: 'Latin America', lat: 6.2476, lng: -75.5658, ring: 4, queriesPerRun: 1, everyNthCycle: 5 },
  { id: 'curitiba', name: 'Curitiba', country: 'Brazil', region: 'Latin America', lat: -25.4284, lng: -49.2733, ring: 4, queriesPerRun: 1, everyNthCycle: 5 },
];

// ── Proximity Chains ────────────────────────────────────────────────────────

export const PROXIMITY_CHAINS: ProximityChain[] = [
  // Ring 1: Metro Manila → QC (geographic)
  { source: 'manila', target: 'quezon-city', weight: 0.95, basis: 'geographic' },
  { source: 'makati', target: 'quezon-city', weight: 0.93, basis: 'geographic' },
  { source: 'pasig', target: 'quezon-city', weight: 0.92, basis: 'geographic' },
  { source: 'caloocan', target: 'quezon-city', weight: 0.94, basis: 'geographic' },
  { source: 'taguig', target: 'quezon-city', weight: 0.90, basis: 'geographic' },
  { source: 'marikina', target: 'quezon-city', weight: 0.93, basis: 'geographic' },
  { source: 'mandaluyong', target: 'quezon-city', weight: 0.91, basis: 'geographic' },
  { source: 'san-juan', target: 'quezon-city', weight: 0.95, basis: 'geographic' },
  { source: 'paranaque', target: 'quezon-city', weight: 0.88, basis: 'geographic' },
  { source: 'las-pinas', target: 'quezon-city', weight: 0.87, basis: 'geographic' },
  { source: 'muntinlupa', target: 'quezon-city', weight: 0.86, basis: 'geographic' },
  { source: 'valenzuela', target: 'quezon-city', weight: 0.90, basis: 'geographic' },

  // Ring 2: PH cities → Manila hub (national)
  { source: 'cebu-city', target: 'manila', weight: 0.80, basis: 'national' },
  { source: 'davao-city', target: 'manila', weight: 0.78, basis: 'national' },
  { source: 'baguio', target: 'manila', weight: 0.82, basis: 'national' },
  { source: 'iloilo-city', target: 'manila', weight: 0.77, basis: 'national' },
  { source: 'zamboanga', target: 'manila', weight: 0.72, basis: 'national' },
  { source: 'cagayan-de-oro', target: 'manila', weight: 0.75, basis: 'national' },
  { source: 'general-santos', target: 'manila', weight: 0.70, basis: 'national' },
  { source: 'angeles-city', target: 'manila', weight: 0.85, basis: 'national' },

  // Ring 3: ASEAN → Manila (Singapore prioritized)
  { source: 'singapore', target: 'manila', weight: 0.75, basis: 'economic' },
  { source: 'singapore', target: 'kuala-lumpur', weight: 0.85, basis: 'geographic' },
  { source: 'kuala-lumpur', target: 'manila', weight: 0.70, basis: 'cultural' },
  { source: 'jakarta', target: 'manila', weight: 0.65, basis: 'cultural' },
  { source: 'bangkok', target: 'manila', weight: 0.60, basis: 'economic' },
  { source: 'ho-chi-minh', target: 'manila', weight: 0.58, basis: 'economic' },
  { source: 'hanoi', target: 'manila', weight: 0.55, basis: 'cultural' },

  // Ring 4: Global → ASEAN hubs (innovation corridors)
  { source: 'tokyo', target: 'singapore', weight: 0.55, basis: 'innovation' },
  { source: 'seoul', target: 'singapore', weight: 0.50, basis: 'innovation' },
  { source: 'amsterdam', target: 'singapore', weight: 0.45, basis: 'economic' },
  { source: 'copenhagen', target: 'tokyo', weight: 0.40, basis: 'innovation' },
  { source: 'barcelona', target: 'singapore', weight: 0.42, basis: 'innovation' },
  { source: 'bogota', target: 'manila', weight: 0.38, basis: 'economic' },
  { source: 'medellin', target: 'manila', weight: 0.35, basis: 'innovation' },
  { source: 'curitiba', target: 'singapore', weight: 0.37, basis: 'innovation' },
];

// ── Policy Topics ───────────────────────────────────────────────────────────

export const POLICY_TOPICS = [
  'urban planning policy',
  'traffic management smart city',
  'waste management segregation',
  'affordable housing program',
  'green spaces urban park',
  'flood control drainage',
  'air quality emission standards',
  'public transport modernization',
  'bicycle lane infrastructure',
  'water supply management',
  'renewable energy policy',
  'informal sector regulation',
  'digital governance e-government',
  'disaster resilience climate adaptation',
];

// ── Seed Functions ──────────────────────────────────────────────────────────

/**
 * Create all city location nodes and proximity_chain edges. Idempotent.
 */
export async function seedCityGraph(env: Env): Promise<{ nodesCreated: number; edgesCreated: number }> {
  const db = getDb(env);
  let nodesCreated = 0;
  let edgesCreated = 0;

  // Force-fix all city nodes via direct UPDATE (handles corruption from extraction)
  // Then INSERT OR IGNORE to create any missing ones.

  // Fix QC
  await db.run(sql`UPDATE nodes SET name = 'Quezon City', description = 'Quezon City, the largest city in Metro Manila, Philippines.', metadata = ${JSON.stringify({ level: 'city', region: 'NCR', country: 'Philippines', ring: 0, lat: 14.676, lng: 121.0437 })} WHERE id = 'quezon-city'`);
  await db.insert(schema.nodes).values({
    id: 'quezon-city',
    type: 'location',
    name: 'Quezon City',
    description: 'Quezon City, the largest city in Metro Manila, Philippines.',
    metadata: JSON.stringify({ level: 'city', region: 'NCR', country: 'Philippines', ring: 0, lat: 14.676, lng: 121.0437 }),
    source_doc_id: null,
  }).onConflictDoNothing();

  // Fix Manila
  await db.run(sql`UPDATE nodes SET name = 'Manila', description = 'Manila, the capital of the Philippines.', metadata = ${JSON.stringify({ level: 'city', region: 'NCR', country: 'Philippines', ring: 1, lat: 14.5995, lng: 120.9842 })} WHERE id = 'manila'`);
  await db.insert(schema.nodes).values({
    id: 'manila',
    type: 'location',
    name: 'Manila',
    description: 'Manila, the capital of the Philippines.',
    metadata: JSON.stringify({ level: 'city', region: 'NCR', country: 'Philippines', ring: 1, lat: 14.5995, lng: 120.9842 }),
    source_doc_id: null,
  }).onConflictDoNothing();

  // Fix all registry city nodes
  for (const city of CITY_REGISTRY) {
    const cityMeta = JSON.stringify({
      level: 'city',
      country: city.country,
      region: city.region,
      ring: city.ring,
      lat: city.lat,
      lng: city.lng,
    });
    const cityDesc = `${city.name}, ${city.country} — policy data for cross-city analysis.`;

    // Force UPDATE first to fix any corruption
    await db.run(sql`UPDATE nodes SET name = ${city.name}, description = ${cityDesc}, metadata = ${cityMeta} WHERE id = ${city.id}`);

    // Then INSERT if it doesn't exist yet
    const result = await db.insert(schema.nodes).values({
      id: city.id,
      type: 'location',
      name: city.name,
      description: cityDesc,
      metadata: cityMeta,
      source_doc_id: null,
    }).onConflictDoNothing();
    if (result.meta?.changes ?? 0 > 0) nodesCreated++;
  }

  // Embed and upsert city nodes into Vectorize
  for (const city of [{ id: 'quezon-city', name: 'Quezon City' }, ...CITY_REGISTRY]) {
    const textToEmbed = `location: ${city.name}`;
    const embedding = await getEmbedding(env, textToEmbed);
    await env.VECTOR_INDEX.upsert([{
      id: city.id,
      values: embedding,
      metadata: { type: 'location', name: city.name },
    }]);
  }

  // Create proximity chain edges
  for (const chain of PROXIMITY_CHAINS) {
    const existing = await db
      .select({ id: schema.edges.id })
      .from(schema.edges)
      .where(
        sql`${schema.edges.source_id} = ${chain.source}
          AND ${schema.edges.target_id} = ${chain.target}
          AND ${schema.edges.relationship} = 'proximity_chain'`
      )
      .get();

    if (!existing) {
      await db.insert(schema.edges).values({
        source_id: chain.source,
        target_id: chain.target,
        relationship: 'proximity_chain',
        weight: chain.weight,
        metadata: JSON.stringify({
          detail: `${chain.source} → ${chain.target} proximity (${chain.basis})`,
          basis: chain.basis,
        }),
      });
      edgesCreated++;
    }
  }

  return { nodesCreated, edgesCreated };
}

// ── Full Page Fetching ─────────────────────────────────────────────────────

/**
 * Fetch a web page and extract its text content.
 * Strips HTML tags, scripts, styles, nav, and returns clean text.
 * Returns empty string on failure (timeout, blocked, etc).
 */
async function fetchPageText(url: string, timeoutMs = 15000): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return '';
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return '';

    const html = await res.text();

    // Strip scripts, styles, nav, header, footer, and HTML tags
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')               // strip remaining tags
      .replace(/&[a-z]+;/gi, ' ')              // strip HTML entities
      .replace(/\s+/g, ' ')                    // collapse whitespace
      .trim();

    // Cap at ~8000 chars per page to stay within context budget
    if (text.length > 8000) text = text.substring(0, 8000);

    return text;
  } catch {
    return '';
  }
}

/**
 * Enrich search results by fetching full page content for the top URLs.
 * Fetches pages in parallel (up to 5 at a time) and replaces the snippet
 * with full page text when available.
 */
async function enrichWithFullPages(
  results: Array<{ title: string; url: string; content: string; engine: string }>,
  maxPages = 5,
): Promise<Array<{ title: string; url: string; content: string; engine: string }>> {
  const toFetch = results.slice(0, maxPages);
  const rest = results.slice(maxPages);

  const pageTexts = await Promise.all(
    toFetch.map((r) => fetchPageText(r.url))
  );

  const enriched = toFetch.map((r, i) => {
    const pageText = pageTexts[i];
    // Use full page text if we got meaningful content (>200 chars), otherwise keep snippet
    if (pageText.length > 200) {
      return { ...r, content: pageText };
    }
    return r;
  });

  return [...enriched, ...rest];
}

// ── Scrape Orchestration ────────────────────────────────────────────────────

function generateSearchQuery(city: CityConfig, topic: string): string {
  return `${city.name} ${city.country} ${topic} policy ordinance program results`;
}

/**
 * Pick which topics to scrape for a given city this cycle.
 * Rotates through POLICY_TOPICS so each cycle covers different topics.
 */
function pickTopics(city: CityConfig, cycleCount: number): string[] {
  const offset = (cycleCount * city.queriesPerRun) % POLICY_TOPICS.length;
  const topics: string[] = [];
  for (let i = 0; i < city.queriesPerRun; i++) {
    topics.push(POLICY_TOPICS[(offset + i) % POLICY_TOPICS.length]);
  }
  return topics;
}

/**
 * Process a single city+topic scrape job. Atomic: either completes fully or fails.
 */
async function scrapeCityTopic(
  env: Env,
  city: CityConfig,
  topic: string,
  jobId: string,
  send: (event: ScrapeEvent) => void,
): Promise<{ policiesFound: number; edgesCreated: number; crossLinks: number }> {
  const db = getDb(env);
  const searchQuery = generateSearchQuery(city, topic);

  // Update job status
  await db.update(schema.scrapeJobs)
    .set({ status: 'searching', search_query: searchQuery, started_at: new Date().toISOString() })
    .where(eq(schema.scrapeJobs.id, jobId));

  // 1. Search SearXNG
  const results = await searchSearXNG(env, searchQuery);
  send({ type: 'search_done', city: city.name, topic, results_count: results.length });

  await db.update(schema.scrapeJobs)
    .set({ results_found: results.length })
    .where(eq(schema.scrapeJobs.id, jobId));

  if (results.length === 0) {
    await db.update(schema.scrapeJobs)
      .set({ status: 'done', completed_at: new Date().toISOString() })
      .where(eq(schema.scrapeJobs.id, jobId));
    return { policiesFound: 0, edgesCreated: 0, crossLinks: 0 };
  }

  // 2. Fetch full page content from top URLs, then build document text
  await db.update(schema.scrapeJobs)
    .set({ status: 'extracting' })
    .where(eq(schema.scrapeJobs.id, jobId));

  const enrichedResults = await enrichWithFullPages(results, 5);
  const docText = buildDocumentText(city, topic, enrichedResults);

  // 3. Run through ingest pipeline
  const docId = `scrape-${city.id}-${topic.replace(/\s+/g, '-').substring(0, 30)}-${Date.now()}`;
  // QC (ring 0) uses the default extraction prompt which is already QC-specialized
  const cityCtx: CityContext | undefined = city.id === 'quezon-city'
    ? undefined
    : { id: city.id, name: city.name, country: city.country };

  // Store raw text in R2
  const r2Key = `docs/${docId}.txt`;
  await env.DOCS_BUCKET.put(r2Key, docText);

  // Store document metadata
  await db.insert(schema.documents).values({
    id: docId,
    title: `${city.name} - ${topic}`,
    source_type: 'synthetic',
    source_url: results[0]?.url ?? null,
    r2_key: r2Key,
    date_published: null,
  }).onConflictDoNothing();

  // Extract entities with city context
  const extracted = await extractEntities(env, docText, docId, 'qwen3:8b', false, cityCtx);

  // If no meaningful entities extracted, skip this job (don't pollute the graph)
  const hasPolicies = extracted.nodes.some((n) => n.type === 'policy');
  if (!hasPolicies && extracted.nodes.length <= 1) {
    // Clean up the empty document
    await env.DOCS_BUCKET.delete(r2Key);
    await db.delete(schema.documents).where(eq(schema.documents.id, docId));
    await db.update(schema.scrapeJobs)
      .set({ status: 'done', policies_ingested: 0, completed_at: new Date().toISOString() })
      .where(eq(schema.scrapeJobs.id, jobId));
    send({ type: 'extract_done', city: city.name, topic, policies_found: 0, edges_created: 0 });
    return { policiesFound: 0, edgesCreated: 0, crossLinks: 0 };
  }

  // Resolve against existing knowledge base
  const { nodes: resolvedNodes, edges: resolvedEdges, embeddingCache } =
    await resolveEntities(env, extracted.nodes, extracted.edges);
  extracted.nodes = resolvedNodes;
  extracted.edges = resolvedEdges;

  // Collect seeded city node IDs so we never overwrite them
  const seededCityIds = new Set(CITY_REGISTRY.map((c) => c.id));
  seededCityIds.add('quezon-city');
  seededCityIds.add('manila');

  // Insert nodes + embeddings
  let nodesInserted = 0;
  for (const node of extracted.nodes) {
    // Never overwrite seeded city nodes — their name/description/metadata are canonical
    if (seededCityIds.has(node.id)) {
      await db.insert(schema.nodes).values({
        id: node.id,
        type: node.type as typeof schema.nodes.$inferInsert['type'],
        name: node.name,
        description: node.description ?? null,
        metadata: JSON.stringify(node.metadata ?? {}),
        source_doc_id: docId,
      }).onConflictDoNothing();
    } else {
      await db.insert(schema.nodes).values({
        id: node.id,
        type: node.type as typeof schema.nodes.$inferInsert['type'],
        name: node.name,
        description: node.description ?? null,
        metadata: JSON.stringify(node.metadata ?? {}),
        source_doc_id: docId,
      }).onConflictDoUpdate({
        target: schema.nodes.id,
        set: {
          name: node.name,
          description: node.description ?? null,
          metadata: JSON.stringify(node.metadata ?? {}),
        },
      });
    }

    const textToEmbed = `${node.type}: ${node.name}. ${node.description ?? ''}`;
    const embedding = embeddingCache.get(node.id) ?? await getEmbedding(env, textToEmbed);
    await env.VECTOR_INDEX.upsert([{
      id: node.id,
      values: embedding,
      metadata: { type: node.type, name: node.name, doc_id: docId },
    }]);
    nodesInserted++;
  }

  // Insert edges
  let edgesCreated = 0;
  for (const edge of extracted.edges) {
    const existing = await db
      .select({ id: schema.edges.id })
      .from(schema.edges)
      .where(
        sql`${schema.edges.source_id} = ${edge.source_id}
          AND ${schema.edges.target_id} = ${edge.target_id}
          AND ${schema.edges.relationship} = ${edge.relationship}`
      )
      .get();

    if (!existing) {
      await db.insert(schema.edges).values({
        source_id: edge.source_id,
        target_id: edge.target_id,
        relationship: edge.relationship as typeof schema.edges.$inferInsert['relationship'],
        metadata: JSON.stringify(edge.metadata ?? {}),
      });
      edgesCreated++;
    }
  }

  // Enrich location hierarchy (links to the city, not QC)
  await enrichLocationEdges(env, extracted.nodes, city.id, city.name);

  // Fix orphan nodes
  await fixOrphanNodes(env, docId, extracted.nodes);

  // Cross-link similar nodes
  const crossLinks = await crossLinkNewNodes(env, extracted.nodes, embeddingCache);

  const policiesFound = extracted.nodes.filter((n) => n.type === 'policy').length;

  send({
    type: 'extract_done',
    city: city.name,
    topic,
    policies_found: policiesFound,
    edges_created: edgesCreated,
  });
  send({ type: 'crosslink_done', city: city.name, cross_links: crossLinks });

  // Create similar_policy edges to QC policies
  await linkSimilarPoliciesAcrossCities(env, extracted.nodes, embeddingCache);

  // Update job
  await db.update(schema.scrapeJobs)
    .set({
      status: 'done',
      policies_ingested: policiesFound,
      completed_at: new Date().toISOString(),
    })
    .where(eq(schema.scrapeJobs.id, jobId));

  return { policiesFound, edgesCreated, crossLinks };
}

/**
 * Find similar policies across cities and create similar_policy edges.
 * For each new policy node, search Vectorize for policy nodes in other cities.
 */
async function linkSimilarPoliciesAcrossCities(
  env: Env,
  nodes: Array<{ id: string; type: string; name?: string }>,
  embeddingCache: Map<string, number[]>,
): Promise<number> {
  const db = getDb(env);
  const policyNodes = nodes.filter((n) => n.type === 'policy');
  if (policyNodes.length === 0) return 0;

  let linksCreated = 0;
  for (const policy of policyNodes) {
    const embedding = embeddingCache.get(policy.id);
    if (!embedding) continue;

    const results = await env.VECTOR_INDEX.query(embedding, {
      topK: 5,
      returnMetadata: 'all',
    });

    for (const match of results.matches) {
      if (match.score < 0.78) continue; // Lower threshold for cross-city similarity
      if (match.id === policy.id) continue;
      const matchType = (match.metadata as Record<string, string> | null)?.type;
      if (matchType !== 'policy') continue;

      // Check if edge already exists
      const existing = await db
        .select({ id: schema.edges.id })
        .from(schema.edges)
        .where(
          sql`((${schema.edges.source_id} = ${policy.id} AND ${schema.edges.target_id} = ${match.id})
            OR (${schema.edges.source_id} = ${match.id} AND ${schema.edges.target_id} = ${policy.id}))
            AND ${schema.edges.relationship} = 'similar_policy'`
        )
        .get();

      if (!existing) {
        const matchName = (match.metadata as Record<string, string> | null)?.name ?? match.id;
        await db.insert(schema.edges).values({
          source_id: policy.id,
          target_id: match.id,
          relationship: 'similar_policy',
          weight: match.score,
          metadata: JSON.stringify({
            detail: `${policy.name ?? policy.id} and ${matchName} address similar policy areas (similarity ${match.score.toFixed(2)})`,
            similarity: match.score,
          }),
        });
        linksCreated++;
      }
    }
  }

  return linksCreated;
}

/**
 * Build a document text from synthesized search results for ingestion.
 * Builds document text directly from raw search snippets.
 * Skips the synthesis LLM call — feeds rich source material straight
 * to the entity extractor so it can find real policies.
 */
function buildDocumentText(
  city: CityConfig,
  topic: string,
  sources: Array<{ title: string; content: string; url: string }>,
): string {
  const parts = [
    `Policy Research: ${topic} in ${city.name}, ${city.country}`,
    `Location: ${city.name}, ${city.country}`,
    `Topic: ${topic}`,
    '',
    `The following are search results about policies, programs, ordinances, and regulations`,
    `related to ${topic} in ${city.name}, ${city.country}.`,
    `Extract all concrete policies, their effects, and stakeholders.`,
    '',
  ];

  for (const s of sources.slice(0, 10)) {
    parts.push(`--- ${s.title} ---`);
    if (s.url) parts.push(`Source: ${s.url}`);
    if (s.content) parts.push(s.content);
    parts.push('');
  }

  return parts.join('\n');
}

// ── Main Orchestrator ───────────────────────────────────────────────────────

const STOP_FLAG_KEY = 'scrape:stop_requested';
const CYCLE_COUNT_KEY = 'scrape:cycle_count';
const OLLAMA_CONCURRENCY = 1;

export interface ScrapeOptions {
  rings?: number[];
  resume?: boolean;
  city?: string;
  topic?: string;
  limit?: number;
}

/**
 * Run a scraping session. Streams ScrapeEvent via the send callback.
 * Checks for stop flag between each job for safe cancellation.
 */
export async function runScrapeSession(
  env: Env,
  options: ScrapeOptions,
  send: (event: ScrapeEvent) => void,
): Promise<void> {
  const db = getDb(env);

  // Clear any previous stop flag
  await env.CACHE.delete(STOP_FLAG_KEY);

  // Get current cycle count
  const cycleStr = await env.CACHE.get(CYCLE_COUNT_KEY);
  const cycleCount = cycleStr ? parseInt(cycleStr, 10) : 0;

  send({ type: 'session_start', cycle: cycleCount, message: `Starting scrape cycle ${cycleCount + 1}` });

  // Determine which cities/topics to scrape
  let cities = CITY_REGISTRY;
  if (options.rings?.length) {
    cities = cities.filter((c) => options.rings!.includes(c.ring));
  }
  if (options.city) {
    cities = cities.filter((c) => c.id === options.city);
  }

  // Filter by cycle frequency
  cities = cities.filter((c) => cycleCount % c.everyNthCycle === 0);

  // Build job list
  interface JobEntry { city: CityConfig; topic: string; jobId: string }
  const jobs: JobEntry[] = [];

  if (options.resume) {
    // Resume stopped jobs
    const stoppedJobs = await db
      .select()
      .from(schema.scrapeJobs)
      .where(eq(schema.scrapeJobs.status, 'stopped'))
      .all();

    for (const sj of stoppedJobs) {
      const city = CITY_REGISTRY.find((c) => c.id === sj.city_node_id);
      if (city) {
        jobs.push({ city, topic: sj.topic, jobId: sj.id });
      }
    }
  } else {
    for (const city of cities) {
      const topics = options.topic ? [options.topic] : pickTopics(city, cycleCount);
      for (const topic of topics) {
        const jobId = `scrape-${city.id}-${topic.replace(/\s+/g, '-').substring(0, 20)}-${Date.now()}`;

        // Check if this city+topic was already done recently (last 24h)
        const recent = await db
          .select({ id: schema.scrapeJobs.id })
          .from(schema.scrapeJobs)
          .where(
            sql`${schema.scrapeJobs.city_node_id} = ${city.id}
              AND ${schema.scrapeJobs.topic} = ${topic}
              AND ${schema.scrapeJobs.status} = 'done'
              AND ${schema.scrapeJobs.completed_at} > datetime('now', '-24 hours')`
          )
          .get();

        if (!recent) {
          // Create job record
          await db.insert(schema.scrapeJobs).values({
            id: jobId,
            city_node_id: city.id,
            topic,
            ring: city.ring,
            status: 'pending',
          });
          jobs.push({ city, topic, jobId });
        }
      }
    }
  }

  if (options.limit && jobs.length > options.limit) {
    jobs.length = options.limit;
  }

  const totalJobs = jobs.length;
  let completedJobs = 0;
  let failedJobs = 0;

  send({ type: 'progress', completed: 0, total: totalJobs, failed: 0 });

  // Process jobs with Ollama concurrency=2 pipeline
  // We batch SearXNG searches in parallel, then extract sequentially with 2 concurrent slots
  const SEARCH_BATCH = 4;

  for (let i = 0; i < jobs.length; i += OLLAMA_CONCURRENCY) {
    // Check stop flag
    const stopRequested = await env.CACHE.get(STOP_FLAG_KEY);
    if (stopRequested === 'true') {
      // Mark remaining jobs as stopped
      for (let j = i; j < jobs.length; j++) {
        await db.update(schema.scrapeJobs)
          .set({ status: 'stopped' })
          .where(eq(schema.scrapeJobs.id, jobs[j].jobId));
      }
      send({
        type: 'stopped',
        message: `Safely stopped after completing ${completedJobs} jobs. ${jobs.length - i} jobs saved for resume.`,
        completed: completedJobs,
        total: totalJobs,
      });
      return;
    }

    // Process up to OLLAMA_CONCURRENCY jobs in parallel
    const batch = jobs.slice(i, i + OLLAMA_CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(({ city, topic, jobId }) =>
        scrapeCityTopic(env, city, topic, jobId, send).catch(async (err) => {
          await db.update(schema.scrapeJobs)
            .set({ status: 'failed', error: String(err), completed_at: new Date().toISOString() })
            .where(eq(schema.scrapeJobs.id, jobId));
          send({ type: 'job_error', city: city.name, topic, error: String(err) });
          throw err;
        })
      )
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        completedJobs++;
      } else {
        failedJobs++;
      }
    }

    // Send progress
    const byRing: Record<number, { done: number; total: number }> = {};
    for (const job of jobs) {
      const ring = job.city.ring;
      byRing[ring] ??= { done: 0, total: 0 };
      byRing[ring].total++;
    }
    for (const job of jobs.slice(0, i + OLLAMA_CONCURRENCY)) {
      const ring = job.city.ring;
      byRing[ring].done++;
    }

    send({
      type: 'progress',
      completed: completedJobs,
      total: totalJobs,
      failed: failedJobs,
      by_ring: byRing,
    });

    // Brief delay between batches
    if (i + OLLAMA_CONCURRENCY < jobs.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Increment cycle count
  await env.CACHE.put(CYCLE_COUNT_KEY, String(cycleCount + 1));

  send({
    type: 'complete',
    completed: completedJobs,
    total: totalJobs,
    failed: failedJobs,
    cycle: cycleCount + 1,
    message: `Cycle ${cycleCount + 1} complete. ${completedJobs} jobs done, ${failedJobs} failed.`,
  });
}

/**
 * Signal the scrape session to stop after the current job(s) finish.
 */
export async function requestScrapeStop(env: Env): Promise<void> {
  await env.CACHE.put(STOP_FLAG_KEY, 'true', { expirationTtl: 3600 });
}
