# sim.ula — Urban Policy Simulation Platform

An intelligence-driven platform for evaluating urban policy proposals against a curated knowledge graph of historical precedents. Powered by GraphRAG and large-language model simulation, it projects stakeholder impacts, environmental effects, and long-term sustainability scores.

## Features

- **Policy Simulation Engine** — Submit a policy proposal and receive a multi-dimensional analysis including impact scores, sustainability projections, stakeholder reactions, risk assessments, and feasibility evaluation.
- **GraphRAG Knowledge Graph** — Queries 10,000+ historical policy precedents across 94 cities worldwide to surface relevant context and real-world outcomes.
- **Interactive Map** — MapLibre-based map with live environmental overlays (heat index, air quality, flood risk) sourced from Open-Meteo. Click to select locations for context-aware simulations.
- **Feasibility Assessment** — Evaluates policy transferability using proximity-chain analysis between cities, stakeholder readiness, and precedent transfer chains.
- **Policy History** — Browse, review, and delete past simulations stored in Cloudflare D1 (metadata) and R2 (full results).
- **Document Ingestion** — Ingest policy documents, ordinances, and reports into the knowledge graph with LLM-powered entity and relationship extraction.
- **Web Scraping Pipeline** — Automated multi-ring scraping system that discovers and indexes urban policy data from cities worldwide.
- **Report Generation** — Export simulation results as Markdown or formatted PDF reports.
- **Policy Chat** — Context-aware chatbot for asking follow-up questions about simulation results.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Styling:** Tailwind CSS 4
- **Mapping:** MapLibre GL + react-map-gl
- **Graph Visualization:** react-force-graph-2d
- **Database:** Cloudflare D1 (SQLite) via Drizzle ORM
- **Storage:** Cloudflare R2 (S3-compatible object storage)
- **Cache:** Cloudflare KV
- **LLM:** Ollama (self-hosted) via configurable model endpoints
- **Deployment:** Cloudflare Workers via OpenNextJS

## Project Structure

```
src/
├── app/                    # Next.js pages & API routes
│   ├── page.tsx            # Landing page
│   ├── simulate/           # Simulation form + map
│   ├── results/[id]/       # Simulation result detail
│   ├── policies/           # Past simulations list
│   ├── knowledge/          # Knowledge graph explorer
│   ├── add-data/           # Document ingestion form
│   ├── scrape/             # Scraping dashboard
│   └── api/
│       ├── simulate/       # Run, save, get, list, delete simulations
│       ├── chat/           # Policy chatbot
│       ├── report/         # PDF/HTML report generation
│       ├── graph/          # Knowledge graph queries & stats
│       ├── ingest/         # Document ingestion pipeline
│       ├── scrape/         # Web scraping control
│       ├── weather/        # Live environmental data
│       ├── research/       # Auto-research & regeneration
│       └── docs/           # Document management
├── components/             # React UI components
│   ├── PolicyMap.tsx        # Interactive map with data overlays
│   ├── PolicyInput.tsx      # Simulation input form
│   ├── SimulationResults.tsx# Full result rendering
│   ├── SimulationLoading.tsx# Loading pipeline animation
│   ├── PolicyChat.tsx       # Chat interface
│   ├── PolicyHistory.tsx    # Past simulations browser
│   ├── GraphView.tsx        # Force-directed graph visualization
│   ├── IngestForm.tsx       # Document ingestion form
│   ├── ScrapePanel.tsx      # Scraping dashboard
│   └── Header.tsx           # Navigation header
├── lib/                    # Core logic & utilities
│   ├── simulate.ts          # LLM simulation pipeline
│   ├── feasibility.ts       # Feasibility & transfer chain analysis
│   ├── graph.ts             # Knowledge graph query layer
│   ├── llm.ts               # LLM client (Ollama)
│   ├── weather.ts           # Open-Meteo weather integration
│   ├── d1-rest.ts           # D1 + R2 REST API clients
│   ├── extract.ts           # Entity/relationship extraction
│   ├── scraper.ts           # Multi-ring web scraping engine
│   ├── report.ts            # Report template generation
│   ├── research.ts          # Auto-research pipeline
│   └── types.ts             # Shared TypeScript types
├── db/                     # Database schema (Drizzle ORM)
└── data/                   # Environmental data helpers
    └── openMeteo.ts         # Heat, AQI, flood grid fetchers
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Cloudflare account with D1, R2, and KV configured
- Ollama running locally (or remote LLM endpoint)

### Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Preview (Cloudflare runtime)

```bash
pnpm preview
```

### Deploy

```bash
pnpm deploy
```

## Cloudflare Bindings

Configured in `wrangler.jsonc`:

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 | Simulation metadata, knowledge graph, documents |
| `DOCS_BUCKET` | R2 | Full simulation results, raw documents |
| `CACHE` | KV | Simulation result caching (1h TTL) |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/simulate` | POST | Run a new policy simulation |
| `/api/simulate/get` | GET | Fetch a stored simulation by ID |
| `/api/simulate/list` | GET | List all past simulations |
| `/api/simulate/save` | POST | Persist simulation to D1 + R2 |
| `/api/simulate/delete` | DELETE | Delete simulation from D1 + R2 |
| `/api/chat` | POST | Context-aware policy chatbot |
| `/api/report` | POST | Generate HTML report from simulation |
| `/api/graph` | GET | Query the knowledge graph |
| `/api/graph/stats` | GET | Knowledge graph statistics |
| `/api/ingest` | POST | Ingest documents into knowledge graph |
| `/api/weather` | GET | Live weather data for a location |
| `/api/weather/grid` | GET | Grid-based environmental overlays |
| `/api/scrape` | POST | Start/stop web scraping pipeline |
| `/api/research` | POST | Auto-research for policy data |
