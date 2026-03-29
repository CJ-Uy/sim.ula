// src/lib/types.ts

// ── Cloudflare bindings environment ──────────────────────────────────────────

export interface Env {
  DB: D1Database;
  VECTOR_INDEX: VectorizeIndex;
  DOCS_BUCKET: R2Bucket;
  CACHE: KVNamespace;
  AI: Ai;
  OLLAMA_URL: string;
  SEARXNG_URL: string;
  DEBERTA_URL: string;
  OLLAMA_MODEL: string;
  EMBED_MODEL: string;
  OLLAMA_TIMEOUT_MS: string;
}

// ── Graph types ───────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  type: 'policy' | 'location' | 'stakeholder' | 'outcome' | 'event' | 'metric';
  name: string;
  description: string | null;
  metadata: string | null; // JSON string
  source_doc_id: string | null;
}

export interface GraphEdge {
  id: number;
  source_id: string;
  target_id: string;
  relationship: string;
  weight: number;
  metadata: string | null;
}

export interface GraphAPIResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  total_nodes: number;
  total_edges: number;
}

export interface GraphEdgeWithNames extends GraphEdge {
  source_name: string;
  target_name: string;
}

export interface GraphContext {
  entry_nodes: GraphNode[];
  related_nodes: GraphNode[];
  edges: GraphEdgeWithNames[];
  context_text: string;
}

// ── Weather ───────────────────────────────────────────────────────────────────

export interface WeatherContext {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  usAqi: number | null;
  riverDischarge: number | null;
  season: string;        // "Wet Season (Habagat)" | "Dry Season (Amihan)"
  isRainySeason: boolean; // June–November in the Philippines
  floodRisk: 'low' | 'moderate' | 'high';
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

export interface IngestRequest {
  disable_fallback?: boolean;
  documents: Array<{
    id?: string;
    title: string;
    content: string;
    source_type: 'ordinance' | 'news' | 'report' | 'study' | 'synthetic';
    source_url?: string;
    date_published?: string;
    model?: 'qwen3:8b' | 'phi4:14b';
  }>;
}

// Structured form fields matching the researcher's data labels
export interface IngestFormRecord {
  title: string;
  date: string;
  policyType:
    | 'Ordinance'
    | 'Executive Order'
    | 'Plan'
    | 'Implementing Rules and Regulation'
    | 'Resolution'
    | 'Program';
  whatWasThePolicy: string;
  whereImplemented: string;
  whoWasAffected: string;
  whatHappened: string;
  whoSupportedOpposed: string;
  whatWentWrong: string;
  model: 'qwen3:8b' | 'phi4:14b';
}

export interface ExtractedGraph {
  nodes: Array<{
    id: string;
    type: string;
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }>;
  edges: Array<{
    source_id: string;
    target_id: string;
    relationship: string;
    metadata?: Record<string, unknown>;
  }>;
}

// ── Feasibility ───────────────────────────────────────────────────────────────

export interface FeasibilityPrecedentChain {
  city_name: string;
  city_id: string;
  policy_name: string;
  outcome_summary: string;
  chain: Array<{ from: string; to: string; weight: number; basis: string }>;
  transferability_score: number; // product of edge weights along chain
  key_adaptations: string[];     // what needs to change for QC context
}

export interface FeasibilityResult {
  overall_score: number;   // 0–100
  overall_label: string;   // "Not Feasible" | "Challenging" | "Feasible" | "Highly Feasible"
  reasoning: string;       // chain-of-thought narrative
  precedent_chains: FeasibilityPrecedentChain[];
  stakeholder_readiness: Array<{
    stakeholder: string;
    readiness: 'ready' | 'cautious' | 'resistant';
    key_concern: string;
  }>;
  critical_success_factors: string[];
  blocking_factors: string[];
  estimated_feasibility_horizon: string;
}

// ── Simulation ────────────────────────────────────────────────────────────────

export interface SimulateRequest {
  policy: string;
  location: string;
  lat?: number;
  lng?: number;
}

export interface ConsultRequest {
  goal: string;
  location?: string;
}

export interface ReportRequest {
  simulation_id: string;
}

export interface SimulationResult {
  policy_summary: string;
  location_context: string;

  historical_precedents: Array<{
    policy_name: string;
    relevance: string;
    outcome_summary: string;
  }>;

  simulation_timeline: Array<{
    period: string;
    label: string;
    events: string;
    sustainability_delta: number;
  }>;

  impact_scores: {
    economic: { score: number; reasoning: string };
    environmental: { score: number; reasoning: string };
    social: { score: number; reasoning: string };
    human_centered: { score: number; reasoning: string };
  };

  persona_reactions: {
    supporter: { profile: string; reaction: string };
    opponent: { profile: string; reaction: string };
    neutral: { profile: string; reaction: string };
  };

  sustainability_score: {
    before: number;
    after: number;
    breakdown: {
      energy_efficiency: number;
      waste_reduction: number;
      green_coverage: number;
      community_resilience: number;
      resource_circularity: number;
    };
  };

  risks: Array<{
    risk: string;
    likelihood: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;

  recommendations: string[];

  confidence: 'low' | 'medium' | 'high';
  confidence_reasoning: string;

  feasibility?: FeasibilityResult;
}

// ── Scraping ─────────────────────────────────────────────────────────────────

export interface CityConfig {
  id: string;           // kebab-case node ID (e.g. "singapore")
  name: string;         // display name
  country: string;
  region: string;       // "NCR" | "Southeast Asia" | "East Asia" | "Europe" etc.
  lat: number;
  lng: number;
  ring: number;         // 1-4
  queriesPerRun: number; // how many topics per scrape cycle
  everyNthCycle: number; // run every Nth cycle (1 = every cycle)
}

export interface ProximityChain {
  source: string;       // city node ID
  target: string;       // city node ID
  weight: number;       // 0-1 proximity strength
  basis: string;        // "geographic" | "national" | "cultural" | "economic" | "innovation"
}

export type ScrapeEventType =
  | 'session_start'
  | 'job_start'
  | 'search_done'
  | 'extract_done'
  | 'crosslink_done'
  | 'job_done'
  | 'job_error'
  | 'progress'
  | 'stopped'
  | 'cycle_done'
  | 'complete';

export interface ScrapeEvent {
  type: ScrapeEventType;
  city?: string;
  topic?: string;
  ring?: number;
  results_count?: number;
  policies_found?: number;
  edges_created?: number;
  cross_links?: number;
  completed?: number;
  total?: number;
  failed?: number;
  cycle?: number;
  by_ring?: Record<number, { done: number; total: number }>;
  message?: string;
  error?: string;
  duration_ms?: number;
  pages_fetched?: number;
  doc_length?: number;
}

export interface ScrapeRequest {
  action: 'start' | 'stop';
  rings?: number[];     // which rings to scrape (default: all)
  resume?: boolean;     // pick up stopped jobs
  city?: string;        // single city override
  topic?: string;       // single topic override
  limit?: number;       // max jobs per request
}

// ── Research / Auto-fill ──────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  url: string;
  content: string; // snippet
  engine: string;
}

export interface ClaimVerification {
  claim: string;
  verdict: 'entailed' | 'contradicted' | 'neutral';
  passed: boolean;
  entailment_score: number;
  contradiction_score: number;
  neutral_score: number;
}

export interface ResearchResult {
  query: string;
  results: SearchResult[];
  synthesized: Partial<IngestFormRecord>;
  source_text: string; // combined snippets passed to DeBERTa
  verification: {
    card_verified: boolean;
    threshold_used: number;
    claims: ClaimVerification[];
    summary: string;
    processing_time_ms: number;
  } | null; // null = DeBERTa unreachable
}
