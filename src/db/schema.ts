import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── Nodes ────────────────────────────────────────────────────────────────────
// Policies, locations, stakeholders, outcomes, events, metrics

export const nodes = sqliteTable(
  'nodes',
  {
    id: text('id').primaryKey(),
    type: text('type', {
      enum: ['policy', 'location', 'stakeholder', 'outcome', 'event', 'metric'],
    }).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    metadata: text('metadata'), // JSON blob
    source_doc_id: text('source_doc_id'),
    created_at: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => [
    index('idx_nodes_type').on(t.type),
    index('idx_nodes_name').on(t.name),
    index('idx_nodes_source').on(t.source_doc_id),
  ]
);

// ── Edges ────────────────────────────────────────────────────────────────────
// Directed relationships between nodes

export const edges = sqliteTable(
  'edges',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source_id: text('source_id').notNull(),
    target_id: text('target_id').notNull(),
    relationship: text('relationship', {
      enum: [
        'enacted_in',
        'affected',
        'resulted_in',
        'conflicted_with',
        'supported_by',
        'opposed_by',
        'measured_by',
        'located_in',
        'preceded',
        'related_to',
      ],
    }).notNull(),
    weight: real('weight').default(1.0),
    metadata: text('metadata'), // JSON blob
    created_at: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => [
    index('idx_edges_source').on(t.source_id),
    index('idx_edges_target').on(t.target_id),
    index('idx_edges_rel').on(t.relationship),
    index('idx_edges_pair').on(t.source_id, t.target_id),
  ]
);

// ── Documents ────────────────────────────────────────────────────────────────
// Metadata for ingested policy texts

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  source_type: text('source_type', {
    enum: ['ordinance', 'news', 'report', 'study', 'synthetic'],
  }).notNull(),
  source_url: text('source_url'),
  r2_key: text('r2_key'),
  summary: text('summary'),
  date_published: text('date_published'),
  ingested_at: text('ingested_at').default(sql`(datetime('now'))`),
});

// ── Simulations ──────────────────────────────────────────────────────────────
// Full simulation results, stored for report generation

export const simulations = sqliteTable(
  'simulations',
  {
    id: text('id').primaryKey(),
    input_policy: text('input_policy').notNull(),
    input_location: text('input_location'),
    retrieved_context: text('retrieved_context'), // JSON: nodes + edges used
    simulation_result: text('simulation_result'), // JSON: full LLM output
    sustainability_score: real('sustainability_score'),
    weather_context: text('weather_context'), // JSON: WeatherContext snapshot
    created_at: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => [index('idx_simulations_date').on(t.created_at)]
);

// ── Weather Cache ────────────────────────────────────────────────────────────
// Prevents repeated Open-Meteo API calls for the same coordinates

export const weatherCache = sqliteTable(
  'weather_cache',
  {
    cache_key: text('cache_key').primaryKey(), // e.g. "heat:14.68:121.04"
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    data_type: text('data_type', { enum: ['heat', 'aqi', 'flood'] }).notNull(),
    data: text('data').notNull(), // JSON from Open-Meteo
    fetched_at: text('fetched_at').default(sql`(datetime('now'))`),
    expires_at: text('expires_at').notNull(),
  },
  (t) => [
    index('idx_weather_expires').on(t.expires_at),
    index('idx_weather_coords').on(t.lat, t.lng, t.data_type),
  ]
);

// ── Type exports (inferred from schema) ──────────────────────────────────────
export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
export type Edge = typeof edges.$inferSelect;
export type NewEdge = typeof edges.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Simulation = typeof simulations.$inferSelect;
export type NewSimulation = typeof simulations.$inferInsert;
export type WeatherCacheRow = typeof weatherCache.$inferSelect;
export type NewWeatherCacheRow = typeof weatherCache.$inferInsert;
