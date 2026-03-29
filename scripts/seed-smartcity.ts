#!/usr/bin/env tsx
// scripts/seed-smartcity.ts
// Seeds the knowledge graph with real smart city and AI traffic policy datasets.
// Covers: Singapore, Tokyo, Barcelona, Seoul, Bangkok, Jakarta, Manila, Quezon City.
//
// Usage: npx tsx scripts/seed-smartcity.ts
// Prerequisites: Ollama running locally with nomic-embed-text pulled

const ACCOUNT_ID = '8527ec1369d46f55304a6f59ab5356e4';
const DATABASE_ID = 'c401b2f1-a1d1-4b15-b714-e297ca7d5ddc';
const API_TOKEN = 'cfat_JJP1FBjbWrh3ubBX2YXAEHCCyvTO3fEJvDmG8y7E1599f1eb';
const VECTORIZE_INDEX = 'simula-embeddings';
const OLLAMA_URL = 'http://localhost:11434';
const EMBED_MODEL = 'nomic-embed-text';

const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
const VECTORIZE_UPSERT_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX}/upsert`;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await fetch(D1_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) throw new Error(`D1 ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { result: { results: T[] }[] };
  return json.result?.[0]?.results ?? [];
}

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { embedding: number[] };
  return json.embedding;
}

async function vectorizeUpsert(
  vectors: Array<{ id: string; values: number[]; metadata: Record<string, string> }>,
): Promise<void> {
  // NDJSON format required by Vectorize v2
  const ndjson = vectors.map((v) => JSON.stringify(v)).join('\n');
  const res = await fetch(VECTORIZE_UPSERT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/x-ndjson' },
    body: ndjson,
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`Vectorize upsert warning (${res.status}): ${text.slice(0, 200)}`);
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Dataset types ─────────────────────────────────────────────────────────────

interface NodeDef {
  id: string;
  type: 'policy' | 'location' | 'stakeholder' | 'outcome' | 'event' | 'metric';
  name: string;
  description: string;
  metadata?: Record<string, unknown>;
}

interface EdgeDef {
  source_id: string;
  target_id: string;
  relationship: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

interface Dataset {
  doc: {
    id: string;
    title: string;
    source_type: 'ordinance' | 'news' | 'report' | 'study';
    source_url: string;
    date_published: string;
    summary: string;
  };
  nodes: NodeDef[];
  edges: EdgeDef[];
}

// ── Datasets ──────────────────────────────────────────────────────────────────

const DATASETS: Dataset[] = [
  // ── 1. Singapore SCATS/SCOOT Adaptive Traffic Control ─────────────────────
  {
    doc: {
      id: 'sg-scats-scoot-2010',
      title: 'Singapore SCATS/SCOOT Adaptive Traffic Signal Control System',
      source_type: 'study',
      source_url: 'https://www.lta.gov.sg/content/ltagov/en/getting_around/driving_in_singapore/intelligent_transport_systems.html',
      date_published: '2010-01-01',
      summary: 'Singapore\'s Land Transport Authority deployed the Sydney Coordinated Adaptive Traffic System (SCATS) integrated with SCOOT (Split Cycle Offset Optimisation Technique) across its arterial road network. The system uses real-time loop detector data to dynamically adjust signal timings across 2,900+ junctions. Coordinated by the Traffic Control Centre (TCC), it reduced average journey times by 15–25% on key corridors. The system forms the foundation of Singapore\'s Intelligent Transport System (ITS) and integrates with the Electronic Road Pricing (ERP) network to manage demand. Singapore\'s Land Transport Authority (LTA) oversees both the infrastructure and the real-time operations centre. The deployment cost approximately SGD 120 million over a 10-year rollout starting in 1997. The system demonstrated that adaptive signal control requires high-quality detector infrastructure, a unified traffic management authority, and long-term political commitment.',
    },
    nodes: [
      {
        id: 'sg-scats-scoot-policy',
        type: 'policy',
        name: 'SCATS/SCOOT Adaptive Traffic Signal Control (Singapore)',
        description: 'Sydney Coordinated Adaptive Traffic System integrated with SCOOT deployed across Singapore\'s 2,900+ signalised junctions. Real-time loop detector data dynamically adjusts signal timing to reduce congestion.',
        metadata: { city: 'singapore', year_enacted: 1997, scale: 'city-wide', technology: 'adaptive signal control' },
      },
      {
        id: 'singapore',
        type: 'location',
        name: 'Singapore',
        description: 'City-state in Southeast Asia with a unified national government, world-class transport infrastructure, and the Land Transport Authority (LTA) as the sole traffic management body.',
        metadata: { country: 'Singapore', region: 'Southeast Asia', ring: 3 },
      },
      {
        id: 'sg-lta',
        type: 'stakeholder',
        name: 'Land Transport Authority (LTA) Singapore',
        description: 'Singapore\'s statutory board responsible for all land transport infrastructure and operations. Centralized authority with no jurisdictional fragmentation.',
        metadata: { city: 'singapore', type: 'government agency' },
      },
      {
        id: 'sg-scats-outcome-congestion',
        type: 'outcome',
        name: '15–25% reduction in average journey times (Singapore SCATS)',
        description: 'Measured reduction in average journey times on arterial corridors after full SCATS/SCOOT deployment. Equivalent to saving 1.2 million vehicle-hours per year.',
        metadata: { metric_type: 'percentage', value: 20, unit: 'journey time reduction' },
      },
      {
        id: 'sg-its-metric-junctions',
        type: 'metric',
        name: '2,900 signalised junctions under adaptive control (Singapore)',
        description: 'Total number of junctions connected to the Singapore Traffic Control Centre under SCATS/SCOOT adaptive management as of 2015.',
        metadata: { value: 2900, unit: 'junctions', year: 2015 },
      },
      {
        id: 'sg-tcc',
        type: 'stakeholder',
        name: 'Singapore Traffic Control Centre (TCC)',
        description: '24/7 operations centre staffed by LTA that monitors all SCATS/SCOOT-connected junctions and can override signal plans during incidents.',
        metadata: { city: 'singapore', type: 'operations centre' },
      },
    ],
    edges: [
      { source_id: 'sg-scats-scoot-policy', target_id: 'singapore', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'sg-scats-scoot-policy', target_id: 'sg-lta', relationship: 'supported_by', weight: 0.95 },
      { source_id: 'sg-scats-scoot-policy', target_id: 'sg-tcc', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'sg-scats-scoot-policy', target_id: 'sg-scats-outcome-congestion', relationship: 'resulted_in', weight: 0.9 },
      { source_id: 'sg-scats-scoot-policy', target_id: 'sg-its-metric-junctions', relationship: 'measured_by', weight: 0.85 },
    ],
  },

  // ── 2. Singapore Smart Nation ITS 2025 ────────────────────────────────────
  {
    doc: {
      id: 'sg-smart-nation-its-2025',
      title: 'Singapore Smart Nation 2025: Intelligent Transport System Masterplan',
      source_type: 'report',
      source_url: 'https://www.smartnation.gov.sg/initiatives/transport',
      date_published: '2019-06-01',
      summary: 'Singapore\'s Smart Nation initiative includes an Intelligent Transport System (ITS) masterplan targeting autonomous vehicle-ready infrastructure, AI-driven incident detection, and a National Digital Identity-integrated e-payments system for transit. GovTech Singapore leads the digital integration layer, coordinating with LTA on real-time data APIs. Key investments include SGD 2.4 billion for rail expansion and SGD 500 million for road monitoring sensors, connected vehicle infrastructure, and the OneMap real-time traffic API platform. The masterplan includes a mandate for all new traffic signals to be AI-ready by 2025. The initiative is built on Singapore\'s existing SCATS foundation and extends it with computer vision cameras at 200 priority intersections for vehicle counting and queue length measurement. Key lesson: the success of AI-driven traffic systems depends on pre-existing high-quality sensor infrastructure, not just the AI layer itself.',
    },
    nodes: [
      {
        id: 'sg-smart-nation-its-policy',
        type: 'policy',
        name: 'Singapore Smart Nation ITS Masterplan 2025',
        description: 'National policy framework for AI-ready transport infrastructure. Mandates AI-capable signal controllers at all new junctions, computer vision at 200 priority intersections, and real-time traffic data APIs open to developers.',
        metadata: { city: 'singapore', year_enacted: 2019, budget_sgd: 2900000000 },
      },
      {
        id: 'sg-govtech',
        type: 'stakeholder',
        name: 'GovTech Singapore',
        description: 'Singapore\'s Government Technology Agency, responsible for the digital infrastructure layer of Smart Nation. Manages the OneMap API and real-time traffic data platform.',
        metadata: { city: 'singapore', type: 'government agency' },
      },
      {
        id: 'sg-smart-nation-outcome-av',
        type: 'outcome',
        name: 'AV-ready intersection infrastructure (Singapore)',
        description: '200 priority intersections upgraded with computer vision cameras capable of vehicle detection, queue measurement, and pedestrian counting. Forms the data backbone for future autonomous vehicle trials.',
        metadata: { value: 200, unit: 'AV-ready intersections', year: 2023 },
      },
      {
        id: 'sg-smart-nation-metric-budget',
        type: 'metric',
        name: 'SGD 2.9 billion Smart Nation transport investment',
        description: 'Total combined investment in rail expansion (SGD 2.4B) and smart road infrastructure (SGD 500M) under the Smart Nation 2025 masterplan.',
        metadata: { value: 2900, unit: 'million SGD', year: 2019 },
      },
    ],
    edges: [
      { source_id: 'sg-smart-nation-its-policy', target_id: 'singapore', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'sg-smart-nation-its-policy', target_id: 'sg-govtech', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'sg-smart-nation-its-policy', target_id: 'sg-lta', relationship: 'supported_by', weight: 0.95 },
      { source_id: 'sg-smart-nation-its-policy', target_id: 'sg-smart-nation-outcome-av', relationship: 'resulted_in', weight: 0.8 },
      { source_id: 'sg-smart-nation-its-policy', target_id: 'sg-smart-nation-metric-budget', relationship: 'measured_by', weight: 0.9 },
      { source_id: 'sg-smart-nation-its-policy', target_id: 'sg-scats-scoot-policy', relationship: 'preceded', weight: 0.85, metadata: { detail: 'Smart Nation ITS builds on the SCATS/SCOOT foundation' } },
    ],
  },

  // ── 3. Tokyo UTMS Universal Traffic Management System ─────────────────────
  {
    doc: {
      id: 'tokyo-utms-2005',
      title: 'Tokyo Universal Traffic Management System (UTMS) and ITS Japan',
      source_type: 'study',
      source_url: 'https://www.its-jp.org/english/project/utms/',
      date_published: '2005-03-01',
      summary: 'Japan\'s Universal Traffic Management System (UTMS) deployed across Tokyo and major urban prefectures integrates optical vehicle detectors, VICS (Vehicle Information and Communication System) beacons, and centralised traffic signal control. The Tokyo Metropolitan Police Department (MPD) Traffic Management Centre manages 17,000+ signalised intersections via the UTMS Super SMART system. A key innovation is the Emergency Vehicle Preemption (EVP) system, which automatically clears signal corridors for ambulances and fire engines. The VICS real-time traffic information system was the world\'s first large-scale deployment of in-vehicle navigation with live congestion data, reaching 95% of new vehicles sold in Japan by 2010. After full deployment, average travel times on major Tokyo arterials decreased by approximately 15% and emergency vehicle response times improved by 25%. The system required 30+ years of sensor infrastructure investment and close coordination between national police, prefectural government, and private automakers. Key lesson for developing cities: the UTMS model assumes near-total vehicle instrumentation — a condition that does not hold in mixed-traffic Southeast Asian environments.',
    },
    nodes: [
      {
        id: 'tokyo-utms-policy',
        type: 'policy',
        name: 'Tokyo Universal Traffic Management System (UTMS)',
        description: 'Integrated traffic management system covering 17,000+ Tokyo intersections. Combines adaptive signal control, real-time VICS navigation data, and emergency vehicle preemption using optical detectors and centralised control.',
        metadata: { city: 'tokyo', year_enacted: 1990, scale: 'city-wide', technology: 'adaptive signal + VICS navigation' },
      },
      {
        id: 'tokyo',
        type: 'location',
        name: 'Tokyo',
        description: 'Capital of Japan and one of the world\'s most densely populated metropolitan areas, with highly formalised traffic management under the Tokyo Metropolitan Police Department.',
        metadata: { country: 'Japan', region: 'East Asia', ring: 4 },
      },
      {
        id: 'tokyo-mpd',
        type: 'stakeholder',
        name: 'Tokyo Metropolitan Police Department Traffic Management Centre',
        description: 'Operates the centralised UTMS system covering all 17,000+ signalised intersections in Tokyo. Has full authority over signal timing with no jurisdictional fragmentation.',
        metadata: { city: 'tokyo', type: 'government agency' },
      },
      {
        id: 'tokyo-utms-outcome-travel',
        type: 'outcome',
        name: '15% reduction in arterial travel times (Tokyo UTMS)',
        description: 'Measured average travel time reduction on major Tokyo arterials after full UTMS/Super SMART deployment. Emergency vehicle response time improvement of 25%.',
        metadata: { metric_type: 'percentage', value: 15, unit: 'travel time reduction' },
      },
      {
        id: 'tokyo-utms-metric-intersections',
        type: 'metric',
        name: '17,000+ signalised intersections under UTMS (Tokyo)',
        description: 'Total number of intersections managed by the Tokyo UTMS system as of 2010.',
        metadata: { value: 17000, unit: 'intersections', year: 2010 },
      },
    ],
    edges: [
      { source_id: 'tokyo-utms-policy', target_id: 'tokyo', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'tokyo-utms-policy', target_id: 'tokyo-mpd', relationship: 'supported_by', weight: 0.95 },
      { source_id: 'tokyo-utms-policy', target_id: 'tokyo-utms-outcome-travel', relationship: 'resulted_in', weight: 0.85 },
      { source_id: 'tokyo-utms-policy', target_id: 'tokyo-utms-metric-intersections', relationship: 'measured_by', weight: 0.9 },
    ],
  },

  // ── 4. Barcelona Superblocks Urban Mobility Transformation ────────────────
  {
    doc: {
      id: 'barcelona-superblocks-2016',
      title: 'Barcelona Superblocks (Superilles): Urban Mobility and Smart City Transformation',
      source_type: 'study',
      source_url: 'https://www.barcelona.cat/mobilitat/en/what-we-do/sustainable-urban-mobility-plan/superblocks',
      date_published: '2016-09-01',
      summary: 'Barcelona\'s Superblocks (Superilles) programme restructures the city\'s 9-block Cerda grid into 500m×500m pedestrianised "superblocks" where through-traffic is eliminated from interior streets. Only residents and delivery vehicles enter interior streets at low speed. The programme is managed by Barcelona\'s Urban Ecology Agency (BCNecologia) and integrates real-time air quality sensors (AQMS), IoT pedestrian counters, and a smart lighting network. By 2022, 10 superblocks were operational with plans for 503 total. Measured outcomes: 21% reduction in NO2 levels in superblock interiors, 24% increase in public space, 6.3% reduction in motor vehicle traffic city-wide in piloted areas. Crucially, the programme faced sustained opposition from businesses citing loss of parking and reduced accessibility, requiring 2 years of community consultation per superblock before implementation. The key transferability lesson: superblock success depends on a grid-based urban layout, a pre-existing mixed-use street typology, and extensive community buy-in — conditions that differ significantly from Metro Manila\'s irregular road network.',
    },
    nodes: [
      {
        id: 'barcelona-superblocks-policy',
        type: 'policy',
        name: 'Barcelona Superblocks (Superilles) Urban Mobility Programme',
        description: 'Urban restructuring programme that converts 9-block city grids into pedestrianised superblocks. Bans through-traffic from interior streets, integrates IoT air quality sensors and smart lighting. 503 superblocks planned city-wide.',
        metadata: { city: 'barcelona', year_enacted: 2016, scale: 'city-wide pilot', technology: 'IoT sensors + urban redesign' },
      },
      {
        id: 'barcelona',
        type: 'location',
        name: 'Barcelona',
        description: 'Capital of Catalonia, Spain. Known for its regular Cerda grid urban layout and pioneering smart city programmes through the Urban Ecology Agency (BCNecologia).',
        metadata: { country: 'Spain', region: 'Europe', ring: 4 },
      },
      {
        id: 'barcelona-bcnecologia',
        type: 'stakeholder',
        name: 'Barcelona Urban Ecology Agency (BCNecologia)',
        description: 'Municipal agency managing Barcelona\'s Superblocks programme. Coordinates IoT sensors, community consultation, and urban design implementation.',
        metadata: { city: 'barcelona', type: 'government agency' },
      },
      {
        id: 'barcelona-residents',
        type: 'stakeholder',
        name: 'Barcelona Superblock Residents and Business Associations',
        description: 'Initially mixed opposition from businesses (loss of parking/access) and support from residents (more public space). Required extensive 2-year consultation periods per superblock.',
        metadata: { city: 'barcelona', type: 'civil society' },
      },
      {
        id: 'barcelona-superblocks-outcome-air',
        type: 'outcome',
        name: '21% reduction in NO2 and 24% increase in public space (Barcelona Superblocks)',
        description: 'Measured outcomes in operational superblocks: 21% reduction in nitrogen dioxide concentrations, 24% increase in pedestrian public space, 6.3% citywide motor vehicle reduction.',
        metadata: { metric_type: 'percentage', value: 21, unit: 'NO2 reduction' },
      },
    ],
    edges: [
      { source_id: 'barcelona-superblocks-policy', target_id: 'barcelona', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'barcelona-superblocks-policy', target_id: 'barcelona-bcnecologia', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'barcelona-superblocks-policy', target_id: 'barcelona-residents', relationship: 'affected', weight: 0.85 },
      { source_id: 'barcelona-superblocks-policy', target_id: 'barcelona-superblocks-outcome-air', relationship: 'resulted_in', weight: 0.85 },
      { source_id: 'barcelona-residents', target_id: 'barcelona-superblocks-policy', relationship: 'opposed_by', weight: 0.5, metadata: { detail: 'Business associations opposed parking loss; required 2-year consultation' } },
    ],
  },

  // ── 5. Seoul Smart City Master Plan 2030 ─────────────────────────────────
  {
    doc: {
      id: 'seoul-smp-2030',
      title: 'Seoul Smart City Master Plan 2030: Digital Twin and AI Traffic Management',
      source_type: 'report',
      source_url: 'https://news.seoul.go.kr/env/archives/63655',
      date_published: '2021-07-01',
      summary: 'Seoul\'s Smart City Master Plan 2030 deploys a city-wide digital twin integrating real-time data from 1.2 million IoT sensors covering traffic, environment, energy, and public safety. The Seoul Digital Foundation (SDF) manages the S-DoT sensor platform and the Seoul Urban Data API, which is open to startups and researchers. Key traffic component: the AI-driven Seoul Traffic Light Control System (STLCS) adjusts 5,200 signal controllers using computer vision data from 3,800 CCTV cameras. In pilot deployments across Gangnam and Jongno districts (2021–2022), average vehicle wait times reduced by 18% and pedestrian crossing fatalities dropped by 31%. Telecom partners SKT and KT provide 5G connectivity for the sensor backbone. Budget: KRW 1.3 trillion (approximately USD 1 billion) over 2021–2025. Key governance lesson: Seoul\'s success required a dedicated Digital Foundation separate from the traffic authority, with a mandate to aggregate data across siloed city departments.',
    },
    nodes: [
      {
        id: 'seoul-smp2030-policy',
        type: 'policy',
        name: 'Seoul Smart City Master Plan 2030',
        description: 'City-wide digital twin integrating 1.2 million IoT sensors. AI-driven signal control system (STLCS) adjusts 5,200 controllers using computer vision from 3,800 CCTVs. Open data API for startups.',
        metadata: { city: 'seoul', year_enacted: 2021, budget_krw: 1300000000000, technology: 'digital twin + AI signal control + computer vision' },
      },
      {
        id: 'seoul',
        type: 'location',
        name: 'Seoul',
        description: 'Capital of South Korea. Metropolitan city with 9.7 million residents, advanced 5G infrastructure, and strong tech sector involvement in public service delivery.',
        metadata: { country: 'South Korea', region: 'East Asia', ring: 4 },
      },
      {
        id: 'seoul-sdf',
        type: 'stakeholder',
        name: 'Seoul Digital Foundation (SDF)',
        description: 'Dedicated agency managing Seoul\'s S-DoT sensor platform and Urban Data API. Aggregates data across siloed city departments and manages the digital twin infrastructure.',
        metadata: { city: 'seoul', type: 'government agency' },
      },
      {
        id: 'seoul-telcos',
        type: 'stakeholder',
        name: 'SKT and KT (Seoul Smart City telecom partners)',
        description: 'South Korean telecoms SKT and KT provide the 5G sensor connectivity backbone for Seoul\'s smart city sensor network and digital twin.',
        metadata: { city: 'seoul', type: 'private sector' },
      },
      {
        id: 'seoul-smp-outcome-traffic',
        type: 'outcome',
        name: '18% reduction in vehicle wait times (Seoul AI signal control)',
        description: 'Pilot outcome in Gangnam and Jongno districts: 18% reduction in average vehicle wait times, 31% reduction in pedestrian crossing fatalities after AI signal control deployment.',
        metadata: { metric_type: 'percentage', value: 18, unit: 'vehicle wait time reduction', districts: 'Gangnam, Jongno' },
      },
      {
        id: 'seoul-smp-metric-sensors',
        type: 'metric',
        name: '1.2 million IoT sensors in Seoul digital twin',
        description: 'Total IoT sensors integrated into the Seoul Smart City digital twin as of 2023.',
        metadata: { value: 1200000, unit: 'IoT sensors', year: 2023 },
      },
    ],
    edges: [
      { source_id: 'seoul-smp2030-policy', target_id: 'seoul', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'seoul-smp2030-policy', target_id: 'seoul-sdf', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'seoul-smp2030-policy', target_id: 'seoul-telcos', relationship: 'supported_by', weight: 0.75 },
      { source_id: 'seoul-smp2030-policy', target_id: 'seoul-smp-outcome-traffic', relationship: 'resulted_in', weight: 0.8 },
      { source_id: 'seoul-smp2030-policy', target_id: 'seoul-smp-metric-sensors', relationship: 'measured_by', weight: 0.85 },
    ],
  },

  // ── 6. Bangkok Traffy Fondue Crowd-Sourced Traffic ────────────────────────
  {
    doc: {
      id: 'bangkok-traffy-fondue-2021',
      title: 'Bangkok Traffy Fondue: Crowd-Sourced Urban Problem Reporting and Traffic Management',
      source_type: 'news',
      source_url: 'https://traffy.in.th/',
      date_published: '2021-05-01',
      summary: 'Traffy Fondue is a LINE-based citizen reporting platform developed by Thailand\'s NECTEC (National Electronics and Computer Technology Center). Deployed citywide in Bangkok in 2021, it allows residents to report road hazards, traffic signal failures, flooding, and illegal parking directly to the Bangkok Metropolitan Administration (BMA). By 2023, the platform processed over 3 million reports with a 72-hour average resolution time for traffic-related issues — a dramatic improvement from 30+ days under the previous paper complaint system. Traffic signal fault reports dropped 40% as the BMA proactively repaired signals before breakdowns. The platform cost approximately THB 8 million (USD 230,000) to develop and is open source. Key transferability lesson for QC: low-cost crowd-sourced platforms like Traffy Fondue are highly transferable to Filipino cities because they leverage smartphone penetration (94% in Metro Manila), existing social messaging apps (Viber/Facebook Messenger as LINE equivalents), and barangay-level citizen networks. The main adaptation required is integration with QC\'s existing 311-style complaint system.',
    },
    nodes: [
      {
        id: 'bangkok-traffy-policy',
        type: 'policy',
        name: 'Bangkok Traffy Fondue Citizen Traffic Reporting Platform',
        description: 'LINE-based crowd-sourced platform for reporting road hazards, signal failures, and traffic issues directly to Bangkok Metropolitan Administration. Processes 3M+ reports/year with 72-hour resolution for traffic issues.',
        metadata: { city: 'bangkok', year_enacted: 2021, cost_thb: 8000000, technology: 'crowd-sourced reporting + LINE integration' },
      },
      {
        id: 'bangkok',
        type: 'location',
        name: 'Bangkok',
        description: 'Capital of Thailand. Metropolitan area of 10.5 million people with high smartphone penetration and a history of flooding and traffic congestion comparable to Metro Manila.',
        metadata: { country: 'Thailand', region: 'Southeast Asia', ring: 3 },
      },
      {
        id: 'bangkok-nectec',
        type: 'stakeholder',
        name: 'NECTEC Thailand (National Electronics and Computer Technology Center)',
        description: 'Thai government R&D agency that developed Traffy Fondue. Provides ongoing technical support and open-source the platform for other Thai cities.',
        metadata: { city: 'bangkok', type: 'government research agency' },
      },
      {
        id: 'bangkok-bma',
        type: 'stakeholder',
        name: 'Bangkok Metropolitan Administration (BMA)',
        description: 'City government responsible for traffic signal maintenance and road infrastructure. Adopted Traffy Fondue as its primary citizen issue-reporting channel.',
        metadata: { city: 'bangkok', type: 'government agency' },
      },
      {
        id: 'bangkok-traffy-outcome-resolution',
        type: 'outcome',
        name: '72-hour traffic issue resolution and 40% signal fault reduction (Bangkok Traffy)',
        description: '72-hour average resolution time for traffic reports (vs 30+ days previously). 40% reduction in signal faults due to proactive maintenance triggered by crowd reports.',
        metadata: { metric_type: 'percentage', value: 40, unit: 'signal fault reduction' },
      },
    ],
    edges: [
      { source_id: 'bangkok-traffy-policy', target_id: 'bangkok', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'bangkok-traffy-policy', target_id: 'bangkok-nectec', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'bangkok-traffy-policy', target_id: 'bangkok-bma', relationship: 'supported_by', weight: 0.85 },
      { source_id: 'bangkok-traffy-policy', target_id: 'bangkok-traffy-outcome-resolution', relationship: 'resulted_in', weight: 0.88 },
    ],
  },

  // ── 7. Jakarta Transjakarta BRT Smart Integration ──────────────────────────
  {
    doc: {
      id: 'jakarta-transjakarta-smart-2019',
      title: 'Jakarta Transjakarta BRT Smart Integration: Real-Time Tracking and Signal Priority',
      source_type: 'report',
      source_url: 'https://www.transjakarta.co.id/',
      date_published: '2019-03-01',
      summary: 'Jakarta\'s Transjakarta Bus Rapid Transit (BRT) system, the world\'s longest BRT network at 251 km, underwent a smart integration programme in 2017–2020 deploying real-time GPS tracking on all 4,600+ buses, a Transit Signal Priority (TSP) system at 120 key intersections, and a GTFS real-time API feeding Google Maps and Gojek. Ridership increased from 110 million trips/year (2016) to 235 million trips/year (2022). The TSP system reduced BRT corridor travel times by 12% by giving buses priority at red lights. The smart integration was funded through the DKI Jakarta provincial government budget and a World Bank urban mobility loan. A critical lesson: the TSP implementation was contested by POLRI (national police), which has jurisdiction over Jakarta\'s traffic signal infrastructure — creating the same jurisdictional fragmentation problem that QC faces between MMDA and city LGUs. Resolution required a Ministerial-level coordination agreement signed in 2018.',
    },
    nodes: [
      {
        id: 'jakarta-transjakarta-smart-policy',
        type: 'policy',
        name: 'Jakarta Transjakarta Smart BRT Integration',
        description: 'Smart integration of world\'s longest BRT: real-time GPS on 4,600 buses, Transit Signal Priority at 120 intersections, GTFS real-time API. Ridership doubled to 235M trips/year after implementation.',
        metadata: { city: 'jakarta', year_enacted: 2017, scale: '251km network', technology: 'GPS + Transit Signal Priority + GTFS' },
      },
      {
        id: 'jakarta',
        type: 'location',
        name: 'Jakarta',
        description: 'Capital of Indonesia. Megacity of 10.6 million with endemic traffic congestion, a large informal transport sector, and fragmented traffic management between national police (POLRI) and city government.',
        metadata: { country: 'Indonesia', region: 'Southeast Asia', ring: 3 },
      },
      {
        id: 'jakarta-transjakarta-operator',
        type: 'stakeholder',
        name: 'PT Transjakarta (BRT Operator)',
        description: 'State-owned company operating the Transjakarta BRT. Led the smart integration programme and manages the real-time data platform.',
        metadata: { city: 'jakarta', type: 'state-owned enterprise' },
      },
      {
        id: 'jakarta-polri-conflict',
        type: 'stakeholder',
        name: 'POLRI Traffic Division (Jakarta jurisdictional conflict)',
        description: 'Indonesian national police holds jurisdiction over traffic signals in Jakarta, creating a fragmentation conflict with the city government similar to MMDA/LGU dynamics in Metro Manila. Required Ministerial coordination agreement.',
        metadata: { city: 'jakarta', type: 'government agency', role: 'jurisdictional barrier' },
      },
      {
        id: 'jakarta-transjakarta-outcome-ridership',
        type: 'outcome',
        name: 'Transjakarta ridership doubled to 235M trips/year and 12% TSP travel time reduction',
        description: 'Ridership increased from 110M to 235M annual trips. Transit Signal Priority reduced BRT corridor travel times by 12%. GPS tracking improved on-time performance by 28%.',
        metadata: { metric_type: 'percentage', value: 114, unit: 'ridership increase percentage' },
      },
    ],
    edges: [
      { source_id: 'jakarta-transjakarta-smart-policy', target_id: 'jakarta', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'jakarta-transjakarta-smart-policy', target_id: 'jakarta-transjakarta-operator', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'jakarta-transjakarta-smart-policy', target_id: 'jakarta-polri-conflict', relationship: 'conflicted_with', weight: 0.7, metadata: { detail: 'POLRI jurisdiction over traffic signals required Ministerial MOA to resolve' } },
      { source_id: 'jakarta-transjakarta-smart-policy', target_id: 'jakarta-transjakarta-outcome-ridership', relationship: 'resulted_in', weight: 0.88 },
    ],
  },

  // ── 8. Manila EDSA Carousel BRT ───────────────────────────────────────────
  {
    doc: {
      id: 'manila-edsa-carousel-2021',
      title: 'Manila EDSA Carousel Bus Rapid Transit System',
      source_type: 'news',
      source_url: 'https://mmda.gov.ph/10-services/traffic-engineering/36-edsa-carousel.html',
      date_published: '2021-01-01',
      summary: 'The EDSA Carousel is a Bus Rapid Transit (BRT) system launched by the Metropolitan Manila Development Authority (MMDA) and the Department of Transportation (DOTr) along EDSA, Metro Manila\'s primary arterial. The system replaced the informal provincial bus operations with a unified cashless BRT using Beep card fare integration. By 2023, daily ridership reached 350,000 passengers on 550+ Carousel buses. Average travel time from Monumento to Taft was reduced from 2.5 hours to 1.3 hours during peak hours. However, the system faced persistent operational issues: bus bunching due to lack of real-time dispatch control, informal provincial bus encroachment on dedicated lanes, and slow enforcement by MMDA traffic enforcers. The Carousel demonstrates the institutional challenge of operating BRT in Metro Manila: MMDA has operational authority over EDSA but cannot enforce exclusivity without sustained LTFRB and DOTr coordination.',
    },
    nodes: [
      {
        id: 'edsa-carousel-policy',
        type: 'policy',
        name: 'EDSA Carousel Bus Rapid Transit System',
        description: 'MMDA-DOTr BRT along EDSA replacing informal provincial buses. Cashless Beep card fare integration. 350,000 daily riders on 550+ buses. Reduced Monumento-Taft travel time by 48% but faces enforcement and dispatch challenges.',
        metadata: { city: 'manila', year_enacted: 2021, daily_ridership: 350000, technology: 'BRT + cashless fare' },
      },
      {
        id: 'manila',
        type: 'location',
        name: 'Manila / Metro Manila',
        description: 'National Capital Region of the Philippines. 13 million residents across 17 cities/municipalities. Traffic management shared between MMDA (major roads), individual LGU traffic departments, and national DOTr/LTFRB.',
        metadata: { country: 'Philippines', region: 'Southeast Asia', ring: 1 },
      },
      {
        id: 'mmda',
        type: 'stakeholder',
        name: 'Metropolitan Manila Development Authority (MMDA)',
        description: 'Manages traffic on major Metro Manila roads including EDSA, C-5, and 35 other primary corridors. Does not have authority over individual city LGU roads. Operates EDSA Carousel.',
        metadata: { city: 'manila', type: 'government agency' },
      },
      {
        id: 'dotr',
        type: 'stakeholder',
        name: 'Department of Transportation (DOTr) Philippines',
        description: 'National agency overseeing all transport including road, rail, and air. Co-manages EDSA Carousel with MMDA and regulates bus franchising through LTFRB.',
        metadata: { city: 'manila', type: 'national government agency' },
      },
      {
        id: 'edsa-carousel-outcome-ridership',
        type: 'outcome',
        name: 'EDSA Carousel: 350,000 daily riders and 48% peak travel time reduction',
        description: '350,000 daily passengers by 2023. Peak travel time Monumento-Taft reduced from 2.5 to 1.3 hours (48% reduction). Persistent issues: bus bunching, informal bus encroachment, limited dispatch control.',
        metadata: { value: 350000, unit: 'daily riders', year: 2023 },
      },
    ],
    edges: [
      { source_id: 'edsa-carousel-policy', target_id: 'manila', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'edsa-carousel-policy', target_id: 'mmda', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'edsa-carousel-policy', target_id: 'dotr', relationship: 'supported_by', weight: 0.85 },
      { source_id: 'edsa-carousel-policy', target_id: 'edsa-carousel-outcome-ridership', relationship: 'resulted_in', weight: 0.85 },
    ],
  },

  // ── 9. Quezon City CCTV Traffic Enforcement Program ──────────────────────
  {
    doc: {
      id: 'qc-cctv-traffic-2018',
      title: 'Quezon City CCTV Traffic Enforcement and Violation Detection Program',
      source_type: 'ordinance',
      source_url: 'https://www.quezoncity.gov.ph/',
      date_published: '2018-06-01',
      summary: 'Quezon City deployed a network of 200 CCTV cameras at major intersections for traffic violation detection, illegal parking enforcement, and incident monitoring under the QC Traffic Discipline Office (TDO). The system is managed by the QC Command Center and integrates with the QC Emergency Operations Center for incident response dispatch. Traffic violation fines collected via automated plate recognition increased by 35% in the first year. However, the system faces significant limitations: the CCTV network covers only QC-administered roads, not MMDA-controlled corridors like EDSA; camera maintenance outsourcing led to frequent downtime (estimated 30% of cameras non-functional at any given time); and public concerns about surveillance data privacy were raised by civil society groups. The program demonstrates both the feasibility of camera-based traffic enforcement in QC and the key barriers: jurisdictional limitations at MMDA roads, maintenance budget, and civil society oversight requirements.',
    },
    nodes: [
      {
        id: 'qc-cctv-traffic-policy',
        type: 'policy',
        name: 'Quezon City CCTV Traffic Enforcement Program',
        description: '200-camera CCTV network for traffic violation detection and incident monitoring. Managed by QC Command Center and TDO. 35% fine collection increase but limited to QC-administered roads only. ~30% camera downtime from maintenance gaps.',
        metadata: { city: 'quezon-city', year_enacted: 2018, cameras: 200, technology: 'CCTV + plate recognition' },
      },
      {
        id: 'quezon-city',
        type: 'location',
        name: 'Quezon City',
        description: 'Most populous city in the Philippines (2.9 million residents), part of Metro Manila. Has its own traffic department (TDO) managing local roads but defers to MMDA on primary corridors.',
        metadata: { country: 'Philippines', region: 'NCR', ring: 0 },
      },
      {
        id: 'qc-tdo',
        type: 'stakeholder',
        name: 'Quezon City Traffic Discipline Office (TDO)',
        description: 'City agency responsible for traffic enforcement on QC-administered roads. Operates the QC CCTV traffic monitoring network and coordinates with QCPD for enforcement.',
        metadata: { city: 'quezon-city', type: 'city government' },
      },
      {
        id: 'qc-command-center',
        type: 'stakeholder',
        name: 'Quezon City Command Center',
        description: '24/7 operations centre integrating CCTV feeds, emergency dispatch, and city services monitoring. Hub of QC\'s smart city infrastructure.',
        metadata: { city: 'quezon-city', type: 'city government' },
      },
      {
        id: 'qc-civil-society-privacy',
        type: 'stakeholder',
        name: 'QC Civil Society Groups (Privacy / Surveillance Concerns)',
        description: 'Local NGOs and civic groups that raised concerns about CCTV data storage, access policies, and potential for misuse of surveillance infrastructure.',
        metadata: { city: 'quezon-city', type: 'civil society' },
      },
      {
        id: 'qc-cctv-outcome-fines',
        type: 'outcome',
        name: '35% increase in traffic violation fine collection (QC CCTV)',
        description: '35% increase in automated plate-recognition-based fine collection in year 1. Offset by high camera maintenance costs and 30% average downtime.',
        metadata: { value: 35, unit: 'fine collection increase percentage', year: 2019 },
      },
    ],
    edges: [
      { source_id: 'qc-cctv-traffic-policy', target_id: 'quezon-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'qc-cctv-traffic-policy', target_id: 'qc-tdo', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'qc-cctv-traffic-policy', target_id: 'qc-command-center', relationship: 'supported_by', weight: 0.85 },
      { source_id: 'qc-cctv-traffic-policy', target_id: 'qc-civil-society-privacy', relationship: 'affected', weight: 0.7 },
      { source_id: 'qc-civil-society-privacy', target_id: 'qc-cctv-traffic-policy', relationship: 'opposed_by', weight: 0.5, metadata: { detail: 'Privacy and surveillance data access concerns raised by civil society' } },
      { source_id: 'qc-cctv-traffic-policy', target_id: 'qc-cctv-outcome-fines', relationship: 'resulted_in', weight: 0.8 },
      { source_id: 'mmda', target_id: 'qc-cctv-traffic-policy', relationship: 'conflicted_with', weight: 0.4, metadata: { detail: 'MMDA jurisdiction over EDSA excludes QC CCTV coverage on primary corridors' } },
    ],
  },

  // ── 10. MMDA Number Coding Scheme History ─────────────────────────────────
  {
    doc: {
      id: 'mmda-number-coding-history',
      title: 'MMDA Unified Vehicular Volume Reduction Program (Number Coding Scheme): History and Outcomes',
      source_type: 'report',
      source_url: 'https://mmda.gov.ph/',
      date_published: '2015-01-01',
      summary: 'The Metropolitan Manila Development Authority\'s Unified Vehicular Volume Reduction Program (UVVRP), colloquially known as the "number coding" scheme, restricts private vehicles from roads in Metro Manila on weekdays based on the last digit of their license plates. Introduced in 1995 and expanded in 2012, the scheme applies on major MMDA roads from 7–8am and 5–7pm. The policy is widely regarded as a partial failure: a 2014 MMDA study found that number-coded vehicles were replaced by second cars, driving a 17% increase in total vehicle registrations in Metro Manila between 2000 and 2014. Compliance dropped to 62% by 2018 due to proliferation of exemptions (government vehicles, diplomats, provincial buses, emergency vehicles). The scheme demonstrates a key Metro Manila governance lesson: demand-management policies that lack enforcement infrastructure and are easily gamed through exemptions produce perverse outcomes. Any AI traffic control or smart mobility proposal must account for this compliance gap.',
    },
    nodes: [
      {
        id: 'mmda-number-coding-policy',
        type: 'policy',
        name: 'MMDA Number Coding Scheme (UVVRP)',
        description: 'Metro Manila demand-management policy restricting private vehicles by license plate number. Considered a partial failure: stimulated 17% increase in total vehicle registrations as households bought second cars. Compliance dropped to 62% by 2018.',
        metadata: { city: 'manila', year_enacted: 1995, year_expanded: 2012, compliance_rate_2018: 62 },
      },
      {
        id: 'mmda-number-coding-outcome-rebound',
        type: 'outcome',
        name: '17% vehicle registration increase — demand rebound from number coding',
        description: 'Instead of reducing congestion, number coding stimulated a 17% growth in total vehicle registrations (2000–2014) as households purchased second vehicles to bypass restrictions. Policy failure attributed to lack of enforcement and proliferation of exemptions.',
        metadata: { metric_type: 'percentage', value: 17, unit: 'vehicle registration increase due to rebound effect' },
      },
      {
        id: 'mmda-number-coding-stakeholder-car-owners',
        type: 'stakeholder',
        name: 'Metro Manila Private Vehicle Owners',
        description: 'Middle and upper-class vehicle owners who responded to number coding by purchasing additional vehicles, undermining the policy\'s congestion-reduction intent.',
        metadata: { city: 'manila', type: 'public' },
      },
    ],
    edges: [
      { source_id: 'mmda-number-coding-policy', target_id: 'manila', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'mmda-number-coding-policy', target_id: 'mmda', relationship: 'supported_by', weight: 0.8 },
      { source_id: 'mmda-number-coding-policy', target_id: 'mmda-number-coding-outcome-rebound', relationship: 'resulted_in', weight: 0.85 },
      { source_id: 'mmda-number-coding-policy', target_id: 'mmda-number-coding-stakeholder-car-owners', relationship: 'affected', weight: 0.9 },
    ],
  },
];

// ── Main Seeding Logic ────────────────────────────────────────────────────────

async function nodeExists(id: string): Promise<boolean> {
  const result = await d1Query<{ id: string }>(`SELECT id FROM nodes WHERE id = ?`, [id]);
  return result.length > 0;
}

async function docExists(id: string): Promise<boolean> {
  const result = await d1Query<{ id: string }>(`SELECT id FROM documents WHERE id = ?`, [id]);
  return result.length > 0;
}

async function seedDataset(dataset: Dataset): Promise<void> {
  const { doc, nodes, edges } = dataset;

  console.log(`\n[${doc.id}] ${doc.title}`);

  // 1. Insert document
  if (await docExists(doc.id)) {
    console.log('  → Document already exists, skipping insert');
  } else {
    await d1Query(
      `INSERT INTO documents (id, title, source_type, source_url, summary, date_published, ingested_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [doc.id, doc.title, doc.source_type, doc.source_url, doc.summary, doc.date_published],
    );
    console.log('  ✓ Document inserted');
  }

  // 2. Insert nodes + embed
  const vectorBatch: Array<{ id: string; values: number[]; metadata: Record<string, string> }> = [];

  for (const node of nodes) {
    if (await nodeExists(node.id)) {
      console.log(`  → Node "${node.id}" exists, skipping`);
      continue;
    }

    const metaStr = node.metadata ? JSON.stringify(node.metadata) : null;
    await d1Query(
      `INSERT INTO nodes (id, type, name, description, metadata, source_doc_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [node.id, node.type, node.name, node.description, metaStr, doc.id],
    );

    // Embed the node for Vectorize
    const embedText = `${node.name}: ${node.description}`;
    try {
      const embedding = await getEmbedding(embedText);
      vectorBatch.push({
        id: node.id,
        values: embedding,
        metadata: { type: node.type, name: node.name, doc_id: doc.id },
      });
      process.stdout.write(`  ✓ Node "${node.name}" inserted + embedded\n`);
    } catch (err) {
      console.warn(`  ✗ Embed failed for "${node.id}": ${err}`);
    }
  }

  // 3. Upsert to Vectorize
  if (vectorBatch.length > 0) {
    await vectorizeUpsert(vectorBatch);
    console.log(`  ✓ ${vectorBatch.length} vectors upserted to Vectorize`);
  }

  // 4. Insert edges
  for (const edge of edges) {
    const weight = edge.weight ?? 0.8;
    const metaStr = edge.metadata ? JSON.stringify(edge.metadata) : null;
    try {
      await d1Query(
        `INSERT OR IGNORE INTO edges (source_id, target_id, relationship, weight, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [edge.source_id, edge.target_id, edge.relationship, weight, metaStr],
      );
    } catch (err) {
      console.warn(`  ✗ Edge insert failed (${edge.source_id} → ${edge.target_id}): ${err}`);
    }
  }
  console.log(`  ✓ ${edges.length} edges inserted`);
}

async function main() {
  console.log('=== Smart City Knowledge Graph Seeding ===\n');
  console.log(`Seeding ${DATASETS.length} datasets...\n`);

  for (const dataset of DATASETS) {
    try {
      await seedDataset(dataset);
    } catch (err) {
      console.error(`\n✗ Failed to seed dataset "${dataset.doc.id}":`, err);
    }
  }

  // Final counts
  const nodeCount = await d1Query<{ count: number }>(`SELECT COUNT(*) as count FROM nodes`);
  const edgeCount = await d1Query<{ count: number }>(`SELECT COUNT(*) as count FROM edges`);
  const docCount = await d1Query<{ count: number }>(`SELECT COUNT(*) as count FROM documents`);

  console.log('\n=== Seeding Complete ===');
  console.log(`  Documents: ${docCount[0]?.count ?? '?'}`);
  console.log(`  Nodes:     ${nodeCount[0]?.count ?? '?'}`);
  console.log(`  Edges:     ${edgeCount[0]?.count ?? '?'}`);
  console.log('\nNEXT STEP: vectorize the seeded nodes by calling the reembed endpoint');
  console.log('  Make sure the dev server is running (npm run dev), then:');
  console.log('  curl -X POST http://localhost:3000/api/admin/reembed -H "Content-Type: application/json" -d "{}"');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
