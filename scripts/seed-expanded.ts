#!/usr/bin/env node --experimental-strip-types
// scripts/seed-expanded.ts
// Expanded knowledge graph seeding:
//   - Ring 1: Metro Manila cities around Quezon City (local outcomes + stakeholders)
//   - Ring 2: Major Philippine cities (Cebu, Davao, Baguio, Iloilo, etc.)
//   - Ring 3: ASEAN cities (KL, HCMC, Hanoi, Yangon, Phnom Penh)
//   - Ring 4: International smart city leaders (Vienna, Curitiba, Medellín, Taipei, Shenzhen, Amsterdam)
//   - QC-specific: barangay governance, informal economy, flood outcomes, housing
//
// Usage: node --experimental-strip-types scripts/seed-expanded.ts

const ACCOUNT_ID = '8527ec1369d46f55304a6f59ab5356e4';
const DATABASE_ID = 'c401b2f1-a1d1-4b15-b714-e297ca7d5ddc';
const API_TOKEN = 'cfat_JJP1FBjbWrh3ubBX2YXAEHCCyvTO3fEJvDmG8y7E1599f1eb';
const OLLAMA_URL = 'http://localhost:11434';
const EMBED_MODEL = 'nomic-embed-text';

const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

async function d1Query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
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
  if (!res.ok) throw new Error(`Ollama embed ${res.status}`);
  return ((await res.json()) as { embedding: number[] }).embedding;
}

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
  doc: { id: string; title: string; source_type: 'ordinance' | 'news' | 'report' | 'study'; source_url: string; date_published: string; summary: string };
  nodes: NodeDef[];
  edges: EdgeDef[];
}

// ── DATASETS ──────────────────────────────────────────────────────────────────

const DATASETS: Dataset[] = [

  // ═══════════════════════════════════════════════════════════════
  // RING 1 — METRO MANILA CITIES AROUND QUEZON CITY
  // ═══════════════════════════════════════════════════════════════

  // ── Marikina Flood Resilience Program ─────────────────────────
  {
    doc: {
      id: 'marikina-flood-resilience-2020',
      title: 'Marikina City Flood Resilience and Early Warning System',
      source_type: 'report',
      source_url: 'https://www.marikina.gov.ph/',
      date_published: '2020-10-01',
      summary: 'Marikina City developed one of Southeast Asia\'s most sophisticated urban flood early warning systems after Typhoon Ondoy (Ketsana) in 2009 caused catastrophic flooding that killed 464 people city-wide and displaced 300,000 residents. The Marikina River Basin Monitoring System deploys water level sensors every 500m along the Marikina River, feeding real-time data to the City Disaster Risk Reduction and Management Office (CDRRMO) and broadcasting evacuation alerts via SMS, sirens, and social media. Pre-emptive evacuation protocols were established based on river level thresholds (Alert 1-3 and Red Alert). By 2019, zero flood-related fatalities were recorded despite Typhoon Quiel causing similar rainfall levels as Ondoy. The system cost PHP 80 million and is maintained in partnership with PAGASA (Philippine Atmospheric, Geophysical and Astronomical Services Administration). Key transferability: Marikina\'s system is the most directly relevant flood management precedent for QC because both cities share the Marikina River basin and face identical flood dynamics. QC has already adopted similar protocols with the Katipunan Creek system, but lacks the sensor density.',
    },
    nodes: [
      { id: 'marikina-flood-ews-policy', type: 'policy', name: 'Marikina Flood Early Warning System', description: 'Water level sensor network along Marikina River with SMS/siren evacuation alerts. Zero flood fatalities in 2019 despite Typhoon Quiel. PHP 80M investment, maintained with PAGASA.', metadata: { city: 'marikina', year_enacted: 2010, cost_php: 80000000 } },
      { id: 'marikina', type: 'location', name: 'Marikina City', description: 'City in Metro Manila bordering Quezon City to the east. Located along Marikina River, the primary flood risk corridor for eastern Metro Manila. Known for flood-resilience innovation after Typhoon Ondoy 2009.', metadata: { country: 'Philippines', region: 'NCR', ring: 1 } },
      { id: 'marikina-cdrrmo', type: 'stakeholder', name: 'Marikina City DRRMO', description: 'City Disaster Risk Reduction and Management Office that operates the flood early warning system and coordinates pre-emptive evacuation.', metadata: { city: 'marikina', type: 'city government' } },
      { id: 'marikina-flood-outcome-ondoy', type: 'event', name: 'Typhoon Ondoy 2009 Marikina Flood Disaster', description: '464 deaths, 300,000 displaced in Marikina from Typhoon Ondoy (Ketsana). Catalysed development of the city\'s flood EWS. Marikina River reached 23m depth.', metadata: { year: 2009, deaths: 464, displaced: 300000 } },
      { id: 'marikina-flood-outcome-quiel', type: 'outcome', name: 'Zero fatalities during Typhoon Quiel 2019 (Marikina EWS success)', description: 'Typhoon Quiel produced similar rainfall to Ondoy but caused zero flood fatalities in Marikina due to pre-emptive evacuation triggered by EWS sensor thresholds.', metadata: { year: 2019, fatalities: 0 } },
    ],
    edges: [
      { source_id: 'marikina-flood-ews-policy', target_id: 'marikina', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'marikina-flood-ews-policy', target_id: 'marikina-cdrrmo', relationship: 'supported_by', weight: 0.95 },
      { source_id: 'marikina-flood-outcome-ondoy', target_id: 'marikina-flood-ews-policy', relationship: 'preceded', weight: 0.9, metadata: { detail: 'Ondoy disaster directly caused development of Marikina EWS' } },
      { source_id: 'marikina-flood-ews-policy', target_id: 'marikina-flood-outcome-quiel', relationship: 'resulted_in', weight: 0.9 },
      { source_id: 'marikina', target_id: 'quezon-city', relationship: 'proximity_chain', weight: 0.92, metadata: { basis: 'geographic' } },
    ],
  },

  // ── Pasig Smart Water and Flood Management ─────────────────────
  {
    doc: {
      id: 'pasig-river-rehab-2022',
      title: 'Pasig City River Rehabilitation and Smart Water Quality Monitoring',
      source_type: 'report',
      source_url: 'https://www.pasigcity.gov.ph/',
      date_published: '2022-01-01',
      summary: 'Pasig City leads Metro Manila\'s effort to rehabilitate the Pasig River, once declared "biologically dead" in the 1990s. Under Mayor Vico Sotto\'s administration (2019–present), the city deployed real-time water quality sensors at 8 points along the Pasig River and Manggahan Floodway, established a riverside estero (canal) cleanup program engaging informal settlers, and launched a strict zero-discharge policy for city-owned establishments. By 2023, dissolved oxygen levels rose from 0.1 mg/L to 3.2 mg/L (threshold for aquatic life). The program also includes relocation of 8,000+ informal settler families from riverbanks to mid-rise social housing — the largest voluntary resettlement in NCR history. Key lesson: the Pasig River rehabilitation shows that incremental, community-engaged cleanup is more sustainable than forced demolition. The zero-discharge enforcement mechanism, tied to business permit renewals, achieved 87% compliance without a single court case.',
    },
    nodes: [
      { id: 'pasig-river-rehab-policy', type: 'policy', name: 'Pasig City River Rehabilitation and Zero-Discharge Policy', description: 'Real-time water quality sensors on Pasig River, voluntary ISF relocation to social housing, zero-discharge enforcement via business permits. DO levels rose from 0.1 to 3.2 mg/L.', metadata: { city: 'pasig', year_enacted: 2019 } },
      { id: 'pasig', type: 'location', name: 'Pasig City', description: 'City in Metro Manila traversed by the Pasig River. Borders Quezon City, Marikina, and Makati. Under reform-oriented Mayor Vico Sotto since 2019.', metadata: { country: 'Philippines', region: 'NCR', ring: 1 } },
      { id: 'pasig-mayor-sotto', type: 'stakeholder', name: 'Pasig Mayor Vico Sotto', description: 'Reform-oriented mayor who prioritised river rehabilitation, e-governance, and informal settler resettlement. Strong social media presence used for policy transparency.', metadata: { city: 'pasig', type: 'elected official' } },
      { id: 'pasig-isf-stakeholder', type: 'stakeholder', name: 'Pasig Riverbank Informal Settler Families (ISF)', description: '8,000+ families voluntarily relocated from Pasig riverbanks to social housing under the rehabilitation programme. Community engagement approach avoided forced demolition.', metadata: { city: 'pasig', type: 'affected community' } },
      { id: 'pasig-river-outcome-do', type: 'outcome', name: 'Pasig River dissolved oxygen recovery: 0.1 to 3.2 mg/L', description: 'Dissolved oxygen levels in Pasig River rose from 0.1 mg/L (biologically dead) to 3.2 mg/L (threshold for aquatic life) between 2019 and 2023.', metadata: { value_before: 0.1, value_after: 3.2, unit: 'mg/L dissolved oxygen' } },
      { id: 'pasig-river-outcome-compliance', type: 'outcome', name: '87% zero-discharge compliance via business permit enforcement', description: 'Business establishments achieved 87% compliance with zero-discharge order through permit renewal linkage — without court cases.', metadata: { value: 87, unit: 'percent compliance' } },
    ],
    edges: [
      { source_id: 'pasig-river-rehab-policy', target_id: 'pasig', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'pasig-river-rehab-policy', target_id: 'pasig-mayor-sotto', relationship: 'supported_by', weight: 0.95 },
      { source_id: 'pasig-river-rehab-policy', target_id: 'pasig-isf-stakeholder', relationship: 'affected', weight: 0.9 },
      { source_id: 'pasig-river-rehab-policy', target_id: 'pasig-river-outcome-do', relationship: 'resulted_in', weight: 0.85 },
      { source_id: 'pasig-river-rehab-policy', target_id: 'pasig-river-outcome-compliance', relationship: 'resulted_in', weight: 0.82 },
      { source_id: 'pasig', target_id: 'quezon-city', relationship: 'proximity_chain', weight: 0.90, metadata: { basis: 'geographic' } },
    ],
  },

  // ── Caloocan Anti-Informal Settlement Policy ───────────────────
  {
    doc: {
      id: 'caloocan-isf-housing-2019',
      title: 'Caloocan City Informal Settler Families Housing and Relocation Program',
      source_type: 'report',
      source_url: 'https://www.caloocan.gov.ph/',
      date_published: '2019-04-01',
      summary: 'Caloocan City houses one of Metro Manila\'s largest populations of informal settler families (ISFs), estimated at 350,000 residents in 2018. The city\'s ISF Relocation Program targets households in danger zones (flood-prone areas, railway easements, estero banks) for relocation to in-city medium-rise socialized housing. Between 2016 and 2022, 12,000 families were relocated. Key challenges: (1) socialized housing units were located in North Caloocan (away from livelihood sources in Tondo/Malabon), causing high return rates of 35%; (2) informal economy workers (vendors, tricycle drivers) who relocated faced loss of income due to distance from markets. The program demonstrates that livelihood continuity must be built into any resettlement plan — a critical lesson for QC\'s own Balintawak and Baesa ISF communities. Caloocan\'s return rate is comparable to QC\'s Commonwealth Avenue ISF relocation experience.',
    },
    nodes: [
      { id: 'caloocan-isf-relocation-policy', type: 'policy', name: 'Caloocan ISF Relocation to In-City Medium-Rise Housing', description: '12,000 families relocated from danger zones to socialized housing 2016–2022. 35% return rate due to distance from livelihood. Lessons: livelihood continuity critical for resettlement success.', metadata: { city: 'caloocan', year_enacted: 2016, families_relocated: 12000 } },
      { id: 'caloocan', type: 'location', name: 'Caloocan City', description: 'Densely populated city in northern Metro Manila bordering Quezon City. Has one of the largest ISF populations in the NCR (est. 350,000). Bisected by NLEX and major commuter rail lines.', metadata: { country: 'Philippines', region: 'NCR', ring: 1 } },
      { id: 'caloocan-isf-stakeholder', type: 'stakeholder', name: 'Caloocan Informal Settler Families (ISF)', description: 'Est. 350,000 informal settlers in Caloocan, concentrated along esteros, railway easements, and Tullahan River banks. Heavily reliant on nearby markets and informal economy for livelihood.', metadata: { city: 'caloocan', type: 'affected community' } },
      { id: 'caloocan-isf-outcome-return', type: 'outcome', name: '35% return rate from Caloocan ISF relocation', description: '35% of relocated families returned to informal settlements within 2 years due to distance from livelihood opportunities. Relocation to North Caloocan sites cut access to Tondo and Malabon markets.', metadata: { value: 35, unit: 'return rate percentage' } },
    ],
    edges: [
      { source_id: 'caloocan-isf-relocation-policy', target_id: 'caloocan', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'caloocan-isf-relocation-policy', target_id: 'caloocan-isf-stakeholder', relationship: 'affected', weight: 0.92 },
      { source_id: 'caloocan-isf-relocation-policy', target_id: 'caloocan-isf-outcome-return', relationship: 'resulted_in', weight: 0.85 },
      { source_id: 'caloocan', target_id: 'quezon-city', relationship: 'proximity_chain', weight: 0.91, metadata: { basis: 'geographic' } },
    ],
  },

  // ── Mandaluyong Bike Lane Network ──────────────────────────────
  {
    doc: {
      id: 'mandaluyong-bike-lanes-2021',
      title: 'Mandaluyong City Active Transport and Protected Bike Lane Network',
      source_type: 'news',
      source_url: 'https://www.mandaluyong.gov.ph/',
      date_published: '2021-07-01',
      summary: 'Mandaluyong City built 14km of protected bike lanes along Edsa-Shaw corridor and secondary streets as part of the DOTr\'s Active Transport programme post-COVID. The lanes are physically separated from traffic by flexiposts and pavement markings. By mid-2022, MMDA counts showed 3,500 daily bicycle commuters using Mandaluyong\'s network — a 400% increase from 2019 pre-pandemic levels. However, the network faces discontinuity issues at EDSA intersections where MMDA authority overrides city authority, creating dangerous gaps. Mandaluyong\'s experience is the closest precedent for QC\'s Commonwealth-Katipunan active transport plans. Key finding: protected bike lanes in mixed Metro Manila traffic require physical separation (not just paint) to be used — flexible posts reduced conflicts by 60% compared to painted-only sections.',
    },
    nodes: [
      { id: 'mandaluyong-bike-lanes-policy', type: 'policy', name: 'Mandaluyong Protected Bike Lane Network', description: '14km protected bike lanes with flexipost separation. 3,500 daily cyclists by 2022 (400% increase). Physical separation reduced traffic conflicts by 60%. Network discontinuity at MMDA-controlled EDSA intersections.', metadata: { city: 'mandaluyong', year_enacted: 2021, length_km: 14 } },
      { id: 'mandaluyong', type: 'location', name: 'Mandaluyong City', description: 'City in Metro Manila along the EDSA corridor, bordering Quezon City, Pasig, and Makati. Commercial and mixed-use density comparable to Cubao and Quezon Ave areas of QC.', metadata: { country: 'Philippines', region: 'NCR', ring: 1 } },
      { id: 'mandaluyong-cyclists', type: 'stakeholder', name: 'Mandaluyong Bicycle Commuters', description: 'Daily bicycle commuters using the Mandaluyong network, primarily workers commuting to Ortigas and Makati CBDs. Membership in PH cycling advocacy groups (Firefly Brigade, Cycling Cebu).', metadata: { city: 'mandaluyong', type: 'public' } },
      { id: 'mandaluyong-bike-outcome-ridership', type: 'outcome', name: '3,500 daily cyclists on Mandaluyong network (400% increase)', description: '3,500 daily bicycle commuters by 2022, up from 700 in 2019. Physical separation (flexiposts) reduced cyclist-vehicle conflicts by 60% vs painted-only lanes.', metadata: { value: 3500, unit: 'daily cyclists', year: 2022 } },
    ],
    edges: [
      { source_id: 'mandaluyong-bike-lanes-policy', target_id: 'mandaluyong', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'mandaluyong-bike-lanes-policy', target_id: 'mandaluyong-cyclists', relationship: 'affected', weight: 0.85 },
      { source_id: 'mandaluyong-bike-lanes-policy', target_id: 'mandaluyong-bike-outcome-ridership', relationship: 'resulted_in', weight: 0.88 },
      { source_id: 'mandaluyong', target_id: 'quezon-city', relationship: 'proximity_chain', weight: 0.88, metadata: { basis: 'geographic' } },
    ],
  },

  // ── QC Barangay Governance and Informal Economy ───────────────
  {
    doc: {
      id: 'qc-barangay-governance-informal-economy',
      title: 'Quezon City Barangay Governance Structure and Informal Economy Stakeholders',
      source_type: 'study',
      source_url: 'https://www.quezoncity.gov.ph/',
      date_published: '2020-01-01',
      summary: 'Quezon City is governed through 142 barangays organized into 6 congressional districts. Each barangay has an elected Barangay Captain, Barangay Council (Kagawad), Barangay Tanod (peacekeepers), and Barangay Health Workers (BHWs). The barangay system is both the strength and weakness of QC governance: it enables hyper-local implementation but creates political fragmentation, with barangay captains sometimes aligned with competing city council factions. QC\'s informal economy employs an estimated 340,000 workers: 42,000 registered street vendors (Sampaloc, Novaliches, Cubao, Commonwealth markets), 18,500 tricycle operators across 117 TODA (Tricycle Operators and Drivers Associations), 8,400 jeepney operators, and approximately 120,000 home-based workers. Any policy affecting street access, zoning, or transport routes directly impacts this constituency. QC has a Tricycle Regulatory Office (TRO) managing TODA permits and a Flea Market and Vendor Management Office for vending site allocation.',
    },
    nodes: [
      { id: 'qc-barangay-system', type: 'stakeholder', name: 'Quezon City Barangay Captains Network (142 barangays)', description: '142 elected barangay captains managing QC\'s 6 districts. Key implementation partners for any city policy. Can facilitate or obstruct depending on political alignment with mayor\'s office.', metadata: { city: 'quezon-city', type: 'elected officials', count: 142 } },
      { id: 'qc-toda-operators', type: 'stakeholder', name: 'QC Tricycle Operators and Drivers Associations (TODA)', description: '117 registered TODAs with 18,500 tricycle operators in Quezon City. Politically organized and vocal opponents of any policy that restricts route access or displaces tricycles from public roads.', metadata: { city: 'quezon-city', type: 'transport operators', count: 18500 } },
      { id: 'qc-street-vendors', type: 'stakeholder', name: 'QC Registered Street Vendors', description: '42,000 registered street vendors in QC concentrated in Sampaloc, Novaliches, Cubao, and Commonwealth. Managed by the Flea Market and Vendor Management Office. Oppose any zoning or sidewalk policies that reduce vending space.', metadata: { city: 'quezon-city', type: 'informal economy', count: 42000 } },
      { id: 'qc-jeepney-operators', type: 'stakeholder', name: 'QC Jeepney Operators (PISTON / ACTO)', description: '8,400 jeepney operators in QC affiliated with PISTON and ACTO. Strong opponents of fleet modernization and route consolidation. Led transport strikes in 2018 and 2023 against DOTr\'s PUV Modernization Program.', metadata: { city: 'quezon-city', type: 'transport operators', count: 8400 } },
      { id: 'qc-bhw-tanod', type: 'stakeholder', name: 'Barangay Health Workers (BHW) and Tanods', description: 'Frontline barangay workers: BHWs handle health monitoring and community outreach; Tanods handle local security. Both are critical intermediaries for any community-level policy enforcement.', metadata: { city: 'quezon-city', type: 'barangay workers' } },
      { id: 'qc-informal-economy-metric', type: 'metric', name: 'QC informal economy: 340,000 workers', description: 'Estimated 340,000 informal economy workers in QC: street vendors (42K), tricycle operators (18.5K), jeepney operators (8.4K), home-based workers (120K), and other informal workers.', metadata: { value: 340000, unit: 'informal workers', year: 2020 } },
    ],
    edges: [
      { source_id: 'qc-barangay-system', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-toda-operators', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-street-vendors', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-jeepney-operators', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-bhw-tanod', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-informal-economy-metric', target_id: 'quezon-city', relationship: 'measured_by', weight: 0.9 },
      { source_id: 'qc-toda-operators', target_id: 'qc-barangay-system', relationship: 'related_to', weight: 0.6 },
    ],
  },

  // ── QC Commonwealth Avenue Pedestrian Safety ──────────────────
  {
    doc: {
      id: 'qc-commonwealth-pedestrian-2023',
      title: 'Quezon City Commonwealth Avenue Pedestrian Safety and Overpass Utilization Study',
      source_type: 'study',
      source_url: 'https://www.quezoncity.gov.ph/',
      date_published: '2023-03-01',
      summary: 'Commonwealth Avenue in Quezon City has been called "the killing fields" due to its high pedestrian fatality rate — 47 deaths in 2022 alone, making it one of the deadliest roads in the Philippines. The DPWH-built pedestrian overpasses along Commonwealth are used by less than 30% of pedestrians; the majority jaywalk due to overpass inaccessibility (no elevators, poorly lit stairs). A 2023 QC-MMDA joint study found that: (1) overpass utilization jumps to 85% when elevators are installed; (2) flashing amber warning lights at pedestrian crossings reduced vehicle-pedestrian conflicts by 44%; (3) physical barriers at mid-block crossing points reduced jaywalking by 38% but displaced crossing behavior to further-away points. The study recommends a hybrid solution: overpass retrofits with elevators + painted zebra crossings at every 300m with push-button signals. Any smart traffic control system on Commonwealth must integrate pedestrian signal phases as a primary safety feature.',
    },
    nodes: [
      { id: 'qc-commonwealth-pedestrian-study', type: 'policy', name: 'QC-MMDA Commonwealth Avenue Pedestrian Safety Study and Recommendations', description: 'Joint study on Commonwealth Ave pedestrian fatalities (47 deaths 2022). Overpasses used by <30% pedestrians. Elevators raise usage to 85%. Flashing amber lights reduce conflicts 44%. Recommends elevator retrofits + 300m zebra crossings.', metadata: { city: 'quezon-city', year: 2023, road: 'Commonwealth Avenue' } },
      { id: 'qc-commonwealth-ave', type: 'location', name: 'Commonwealth Avenue, Quezon City', description: 'Major 8-lane arterial in QC running from Elliptical Road to Fairview. 47 pedestrian fatalities in 2022. MMDA-managed road. Key corridor for QC transit and AI traffic control proposals.', metadata: { city: 'quezon-city', type: 'road', lanes: 8 } },
      { id: 'qc-commonwealth-pedestrian-fatalities', type: 'metric', name: '47 pedestrian deaths on Commonwealth Avenue (2022)', description: '47 pedestrian fatalities on Commonwealth Avenue in 2022. Overpass utilization only 30% due to poor accessibility. Ranks among deadliest urban roads in the Philippines.', metadata: { value: 47, unit: 'pedestrian deaths', year: 2022, road: 'Commonwealth Avenue' } },
      { id: 'qc-pedestrian-outcome-elevator', type: 'outcome', name: 'Overpass elevator installation raised utilization from 30% to 85%', description: 'Installing elevators at pedestrian overpasses on Commonwealth raised utilization from 30% to 85%. Flashing amber crossing lights reduced vehicle-pedestrian conflicts by 44%.', metadata: { value_before: 30, value_after: 85, unit: 'overpass utilization percentage' } },
    ],
    edges: [
      { source_id: 'qc-commonwealth-pedestrian-study', target_id: 'quezon-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'qc-commonwealth-pedestrian-study', target_id: 'qc-commonwealth-ave', relationship: 'affected', weight: 1.0 },
      { source_id: 'qc-commonwealth-ave', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-commonwealth-pedestrian-study', target_id: 'qc-commonwealth-pedestrian-fatalities', relationship: 'measured_by', weight: 0.95 },
      { source_id: 'qc-commonwealth-pedestrian-study', target_id: 'qc-pedestrian-outcome-elevator', relationship: 'resulted_in', weight: 0.85 },
      { source_id: 'mmda', target_id: 'qc-commonwealth-ave', relationship: 'located_in', weight: 0.8, metadata: { detail: 'MMDA has jurisdiction over Commonwealth Avenue' } },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // RING 2 — MAJOR PHILIPPINE CITIES
  // ═══════════════════════════════════════════════════════════════

  // ── Cebu City BRT and Traffic Management ──────────────────────
  {
    doc: {
      id: 'cebu-brt-traffic-2022',
      title: 'Cebu City Bus Rapid Transit Project and Traffic Signal Modernization',
      source_type: 'report',
      source_url: 'https://www.cebucity.gov.ph/',
      date_published: '2022-06-01',
      summary: 'Cebu City has been developing a Bus Rapid Transit (BRT) system since 2012, with the World Bank-funded Phase 1 (Cebu South Road to Ayala Center, 12.6km) facing repeated delays due to right-of-way acquisition challenges. By 2023, only partial operations began on the Cebu BRT after 11 years of planning. The traffic signal modernization component deployed 62 new adaptive signal controllers on Osmeña Boulevard with real-time traffic counting cameras. Travel time on Osmeña Boulevard decreased by 22% in the initial corridor. The Cebu experience demonstrates that Philippine LGU BRT projects require national government support (DOTC/DOTr) for right-of-way acquisition — a lesson relevant to any QC rapid transit proposal on EDSA or C-5. Cebu\'s traffic management is complicated by its unique grid-triangle road network, which differs from Manila\'s radial layout.',
    },
    nodes: [
      { id: 'cebu-brt-policy', type: 'policy', name: 'Cebu City Bus Rapid Transit System', description: 'World Bank-funded 12.6km BRT from South Road to Ayala Center. 11-year planning period due to right-of-way delays. 62 adaptive signal controllers on Osmeña Blvd. 22% travel time reduction on pilot corridor.', metadata: { city: 'cebu', year_planned: 2012, year_partial_ops: 2023, length_km: 12.6 } },
      { id: 'cebu-city', type: 'location', name: 'Cebu City', description: 'Second largest city in the Philippines. Central Visayas regional capital. Commercial hub with unique grid-triangle road network and heavy traffic from tourism and trade.', metadata: { country: 'Philippines', region: 'Central Visayas', ring: 2 } },
      { id: 'cebu-dotc-conflict', type: 'stakeholder', name: 'DOTr/DOTC and LGU Right-of-Way Conflict (Cebu BRT)', description: 'National-LGU coordination failure on Cebu BRT right-of-way acquisition caused 11-year delay. National government controls ROW acquisition process; city cannot accelerate without DOTr support.', metadata: { city: 'cebu', type: 'coordination barrier' } },
      { id: 'cebu-brt-outcome-signal', type: 'outcome', name: '22% travel time reduction from Cebu adaptive signal modernization', description: '62 adaptive signal controllers on Osmeña Boulevard reduced travel times by 22% on the pilot corridor. National government ROW support required for BRT expansion.', metadata: { value: 22, unit: 'travel time reduction percentage' } },
    ],
    edges: [
      { source_id: 'cebu-brt-policy', target_id: 'cebu-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'cebu-brt-policy', target_id: 'cebu-dotc-conflict', relationship: 'conflicted_with', weight: 0.75 },
      { source_id: 'cebu-brt-policy', target_id: 'cebu-brt-outcome-signal', relationship: 'resulted_in', weight: 0.8 },
      { source_id: 'cebu-city', target_id: 'manila', relationship: 'proximity_chain', weight: 0.72, metadata: { basis: 'national' } },
    ],
  },

  // ── Davao City CCTV Surveillance and Public Safety ────────────
  {
    doc: {
      id: 'davao-cctv-safe-city-2018',
      title: 'Davao City Safe City CCTV Network and Automated Traffic Enforcement',
      source_type: 'report',
      source_url: 'https://www.davaocity.gov.ph/',
      date_published: '2018-09-01',
      summary: 'Davao City under Mayor Sara Duterte (2013–2019, 2022–present) deployed one of the Philippines\' most extensive CCTV-based safe city systems: 2,000+ cameras integrated with the Davao City Police Office and the City Traffic Operations Center (CTOC). The system includes automated license plate recognition (LPR) at 45 key intersections, a real-time command dashboard, and integration with the Davao Rescue 911 emergency dispatch. Crime index dropped 47% between 2013 and 2018. Traffic violations detected by LPR increased enforcement revenues by 58%. Key transferability lesson: Davao\'s system succeeded because it was paired with a strong political mandate and community trust in the local government (high satisfaction ratings). Civil society resistance was minimal. In contrast, QC\'s CCTV system faces more civil society scrutiny because of Manila\'s larger and more politically active urban population.',
    },
    nodes: [
      { id: 'davao-safe-city-policy', type: 'policy', name: 'Davao City Safe City CCTV and LPR System', description: '2,000+ cameras with LPR at 45 intersections. Crime index -47% (2013–2018). Traffic enforcement revenue +58%. High community trust reduced civil society resistance to surveillance.', metadata: { city: 'davao', year_enacted: 2013, cameras: 2000 } },
      { id: 'davao-city', type: 'location', name: 'Davao City', description: 'Largest city by area in the Philippines (Mindanao). Known for strong local governance and low crime rates under the Duterte administration. Different political culture from NCR.', metadata: { country: 'Philippines', region: 'Davao Region', ring: 2 } },
      { id: 'davao-ctoc', type: 'stakeholder', name: 'Davao City Traffic Operations Center (CTOC)', description: 'Centralized command center managing Davao\'s CCTV network, LPR enforcement, and emergency dispatch integration. Operates 24/7 with direct DCPO coordination.', metadata: { city: 'davao', type: 'city government' } },
      { id: 'davao-safe-city-outcome-crime', type: 'outcome', name: '47% crime index reduction in Davao (2013–2018 CCTV programme)', description: 'Crime index dropped 47% in Davao City from 2013 to 2018, attributed to CCTV network and police visibility programme. LPR enforcement revenue increased 58%.', metadata: { value: 47, unit: 'crime index reduction percentage' } },
    ],
    edges: [
      { source_id: 'davao-safe-city-policy', target_id: 'davao-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'davao-safe-city-policy', target_id: 'davao-ctoc', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'davao-safe-city-policy', target_id: 'davao-safe-city-outcome-crime', relationship: 'resulted_in', weight: 0.8 },
      { source_id: 'davao-city', target_id: 'manila', relationship: 'proximity_chain', weight: 0.65, metadata: { basis: 'national' } },
      { source_id: 'davao-safe-city-policy', target_id: 'qc-cctv-traffic-policy', relationship: 'related_to', weight: 0.75, metadata: { detail: 'Similar CCTV enforcement approach; Davao had stronger political mandate and less civil society resistance' } },
    ],
  },

  // ── Baguio City Sustainable Transport ─────────────────────────
  {
    doc: {
      id: 'baguio-sustainable-transport-2022',
      title: 'Baguio City Vehicle Reduction and Sustainable Transport Programme',
      source_type: 'report',
      source_url: 'https://www.baguio.gov.ph/',
      date_published: '2022-01-01',
      summary: 'Baguio City implemented aggressive vehicle reduction measures to address severe congestion in its mountain geography: a vehicle volume reduction scheme (odd-even for provincial buses), a mandatory electric vehicle (EV) policy for new taxi franchises, and a Sunday pedestrian street programme on Session Road. Baguio is the only Philippine city with a successful pedestrianisation precedent (Session Road on Sundays since 2014). By 2022, Session Road Sunday pedestrianisation recorded 15,000 daily foot traffic, a 300% increase, and associated commercial revenues rose 40%. The EV taxi fleet reached 200 units by 2023. Baguio\'s success with pedestrianisation is highly relevant to QC proposals for Maginhawa Street and Katipunan pedestrian zones, as Baguio demonstrates strong public acceptance of temporary road closures even among the motorist community when leisure/commercial benefits are clear.',
    },
    nodes: [
      { id: 'baguio-session-road-pedestrian-policy', type: 'policy', name: 'Baguio Session Road Sunday Pedestrianisation', description: 'Session Road closed to vehicles every Sunday since 2014. 15,000 daily foot traffic by 2022 (300% increase). Commercial revenues +40%. Only successful permanent pedestrianisation precedent in a Philippine city.', metadata: { city: 'baguio', year_enacted: 2014 } },
      { id: 'baguio', type: 'location', name: 'Baguio City', description: 'Mountain city in Cordillera Region, northern Philippines. Summer capital of the Philippines. Unique topography creates severe traffic challenges unlike Metro Manila flatlands.', metadata: { country: 'Philippines', region: 'Cordillera', ring: 2 } },
      { id: 'baguio-session-road-outcome', type: 'outcome', name: 'Session Road pedestrianisation: 15,000 daily visitors and +40% commercial revenue', description: 'Sunday pedestrianisation of Session Road increased foot traffic 300% to 15,000 daily visitors. Commercial revenues along the street rose 40%. Strong public acceptance including from motorists.', metadata: { value: 15000, unit: 'daily visitors', year: 2022 } },
    ],
    edges: [
      { source_id: 'baguio-session-road-pedestrian-policy', target_id: 'baguio', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'baguio-session-road-pedestrian-policy', target_id: 'baguio-session-road-outcome', relationship: 'resulted_in', weight: 0.88 },
      { source_id: 'baguio', target_id: 'manila', relationship: 'proximity_chain', weight: 0.68, metadata: { basis: 'national' } },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // RING 3 — ASEAN CITIES
  // ═══════════════════════════════════════════════════════════════

  // ── Kuala Lumpur Smart Traffic Management ─────────────────────
  {
    doc: {
      id: 'kl-scats-smart-selangor-2019',
      title: 'Kuala Lumpur SCATS Adaptive Traffic Control and Smart Selangor Bus',
      source_type: 'report',
      source_url: 'https://www.dbkl.gov.my/',
      date_published: '2019-01-01',
      summary: 'Kuala Lumpur deployed SCATS (the same adaptive signal system used in Singapore) across 800 major junctions managed by Dewan Bandaraya Kuala Lumpur (DBKL). The system is integrated with Malaysia\'s FLOW (Federal Lembah Klang) traffic management platform. KL also launched Smart Selangor Ride — a free bus service in Petaling Jaya funded by the Selangor state government and operated by Rapid Bus. Smart Selangor Ride increased bus ridership by 180% in its first year by eliminating the cost barrier. The KL traffic management experience is relevant to Manila because both cities share similar governance fragmentation: KL\'s DBKL manages the city but expressways are managed by PLUS (private concession), while state roads are managed separately — analogous to Manila\'s MMDA/LGU/DPWH fragmentation.',
    },
    nodes: [
      { id: 'kl-scats-policy', type: 'policy', name: 'Kuala Lumpur SCATS Adaptive Signal Control (800 junctions)', description: 'SCATS adaptive signal control across 800 KL junctions managed by DBKL. Integrated with Malaysia FLOW traffic platform. Governance fragmentation between DBKL, PLUS expressways, and state roads similar to Manila.', metadata: { city: 'kuala-lumpur', year_enacted: 2015, junctions: 800 } },
      { id: 'kuala-lumpur', type: 'location', name: 'Kuala Lumpur', description: 'Capital of Malaysia. Megacity of 7.7 million. ASEAN financial hub with governance fragmentation between DBKL (city), PLUS (expressways), and Selangor state — comparable to Manila MMDA/DPWH/LGU dynamics.', metadata: { country: 'Malaysia', region: 'Southeast Asia', ring: 3 } },
      { id: 'kl-dbkl', type: 'stakeholder', name: 'Dewan Bandaraya Kuala Lumpur (DBKL)', description: 'City Hall of Kuala Lumpur. Manages city roads and SCATS traffic system but lacks authority over federal expressways (PLUS) — creating similar jurisdictional challenges to MMDA in Metro Manila.', metadata: { city: 'kuala-lumpur', type: 'city government' } },
      { id: 'smart-selangor-ride-outcome', type: 'outcome', name: 'Smart Selangor Ride free bus: 180% ridership increase', description: 'Free bus service in Petaling Jaya increased ridership 180% in year 1. Demonstrates that fare elimination is the single biggest lever for public transport modal shift in car-dependent ASEAN cities.', metadata: { value: 180, unit: 'ridership increase percentage' } },
    ],
    edges: [
      { source_id: 'kl-scats-policy', target_id: 'kuala-lumpur', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'kl-scats-policy', target_id: 'kl-dbkl', relationship: 'supported_by', weight: 0.88 },
      { source_id: 'kl-scats-policy', target_id: 'smart-selangor-ride-outcome', relationship: 'related_to', weight: 0.65 },
      { source_id: 'kuala-lumpur', target_id: 'singapore', relationship: 'proximity_chain', weight: 0.82, metadata: { basis: 'geographic' } },
      { source_id: 'kuala-lumpur', target_id: 'manila', relationship: 'proximity_chain', weight: 0.65, metadata: { basis: 'economic' } },
      { source_id: 'kl-scats-policy', target_id: 'sg-scats-scoot-policy', relationship: 'related_to', weight: 0.85, metadata: { detail: 'KL uses same SCATS platform as Singapore; different governance context' } },
    ],
  },

  // ── Ho Chi Minh City Urban Mobility ────────────────────────────
  {
    doc: {
      id: 'hcmc-urban-mobility-2022',
      title: 'Ho Chi Minh City Urban Mobility Masterplan: Metro, BRT, and Traffic Management',
      source_type: 'report',
      source_url: 'https://www.hochiminhcity.gov.vn/',
      date_published: '2022-04-01',
      summary: 'Ho Chi Minh City (HCMC) faces traffic conditions comparable to Metro Manila: 8.5 million registered motorcycles, 900,000 cars, and a highly informal transport sector (xe om motorcycle taxis, now partially displaced by Grab). HCMC Metro Line 1 (Bến Thành to Suối Tiên, 19.7km) opened in late 2024 after 14 years of construction. The city also trialled a BRT corridor on Vo Van Kiet Avenue in 2017 which was discontinued after 18 months due to low ridership (bus lanes were not enforced, allowing cars to use them). The BRT failure offers the most directly comparable lesson to Manila: without physical separation and strict enforcement of dedicated lanes, BRT fails in mixed high-motorcycle traffic environments. HCMC also deployed a centralized Intelligent Traffic Management System (ITMS) covering 800 intersections in 2021, reducing average inner-city travel times by 12%.',
    },
    nodes: [
      { id: 'hcmc-itms-policy', type: 'policy', name: 'Ho Chi Minh City Intelligent Traffic Management System (ITMS)', description: '800-intersection ITMS deployed 2021. 12% travel time reduction in inner city. BRT on Vo Van Kiet failed due to unenforced lanes in mixed motorcycle traffic — cautionary precedent for Manila.', metadata: { city: 'ho-chi-minh-city', year_enacted: 2021, intersections: 800 } },
      { id: 'ho-chi-minh-city', type: 'location', name: 'Ho Chi Minh City', description: 'Largest city in Vietnam. 8.5 million motorcycles, heavily mixed traffic similar to Metro Manila. Metro Line 1 opened 2024. BRT failed 2017–2019 due to enforcement gaps.', metadata: { country: 'Vietnam', region: 'Southeast Asia', ring: 3 } },
      { id: 'hcmc-brt-failure', type: 'outcome', name: 'HCMC BRT failure: discontinued after 18 months due to unenforced lanes', description: 'HCMC BRT on Vo Van Kiet Avenue shut down after 18 months because dedicated bus lanes were not enforced — cars occupied lanes, reducing bus speed below non-BRT routes. Direct parallel to Manila EDSA Carousel issues.', metadata: { year_started: 2017, year_ended: 2019, reason: 'unenforced dedicated lanes' } },
      { id: 'hcmc-itms-outcome', type: 'outcome', name: '12% inner-city travel time reduction from HCMC ITMS', description: '12% average travel time reduction in Ho Chi Minh City inner-city corridors after 800-intersection ITMS deployment in 2021.', metadata: { value: 12, unit: 'travel time reduction percentage' } },
    ],
    edges: [
      { source_id: 'hcmc-itms-policy', target_id: 'ho-chi-minh-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'hcmc-itms-policy', target_id: 'hcmc-itms-outcome', relationship: 'resulted_in', weight: 0.82 },
      { source_id: 'hcmc-itms-policy', target_id: 'hcmc-brt-failure', relationship: 'related_to', weight: 0.7 },
      { source_id: 'ho-chi-minh-city', target_id: 'singapore', relationship: 'proximity_chain', weight: 0.62, metadata: { basis: 'economic' } },
      { source_id: 'ho-chi-minh-city', target_id: 'bangkok', relationship: 'proximity_chain', weight: 0.70, metadata: { basis: 'geographic' } },
      { source_id: 'hcmc-brt-failure', target_id: 'edsa-carousel-policy', relationship: 'related_to', weight: 0.78, metadata: { detail: 'Both BRT systems face unenforced dedicated lanes in mixed-traffic environments' } },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // RING 4 — INTERNATIONAL SMART CITY LEADERS
  // ═══════════════════════════════════════════════════════════════

  // ── Vienna Integrated Smart Traffic ───────────────────────────
  {
    doc: {
      id: 'vienna-smart-traffic-2020',
      title: 'Vienna Smart Traffic Management: Multimodal Coordination and Green Wave System',
      source_type: 'study',
      source_url: 'https://www.wien.gv.at/verkehr/oeffentlich/',
      date_published: '2020-03-01',
      summary: 'Vienna\'s traffic management system, ViennaITS, coordinates 1,500 traffic signals with real-time data from trams, buses, and cyclists to create dynamic "green waves" for public transport. Tram signal priority (TSP) ensures Wiener Linien trams trigger green lights in a 400m radius, reducing tram travel times by 18%. Vienna has achieved a modal split where only 27% of daily trips are made by private car — the lowest in any European capital city with comparable economic output. Key policy mechanism: Vienna\'s Superblock-equivalent programme (Begegnungszonen or "encounter zones") is implemented at barangay-level granularity through district councils, not city-wide mandate. Each district proposes Begegnungszonen candidates; the city approves, funds, and manages them. The bottom-up district approach is highly relevant to QC\'s barangay governance model.',
    },
    nodes: [
      { id: 'vienna-its-policy', type: 'policy', name: 'ViennaITS Smart Traffic and Tram Signal Priority', description: '1,500 coordinated signals with tram/bus TSP. 18% tram travel time reduction. 27% private car modal share — lowest in European capitals. Bottom-up Begegnungszonen through district councils.', metadata: { city: 'vienna', year_enacted: 2010, signals: 1500, car_modal_share: 27 } },
      { id: 'vienna', type: 'location', name: 'Vienna', description: 'Capital of Austria. Consistently ranked most liveable city globally. Only 27% car modal share. Strong public transport (tram/U-Bahn) and bottom-up traffic calming through district governance.', metadata: { country: 'Austria', region: 'Europe', ring: 4 } },
      { id: 'vienna-its-outcome-tram', type: 'outcome', name: '18% tram travel time improvement and 27% car modal share (Vienna)', description: 'Vienna tram signal priority reduced tram travel times by 18%. City-wide car modal share is 27%, achieved through coordinated modal integration and district-level traffic calming.', metadata: { value: 18, unit: 'tram travel time improvement percentage' } },
    ],
    edges: [
      { source_id: 'vienna-its-policy', target_id: 'vienna', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'vienna-its-policy', target_id: 'vienna-its-outcome-tram', relationship: 'resulted_in', weight: 0.88 },
      { source_id: 'vienna', target_id: 'singapore', relationship: 'proximity_chain', weight: 0.42, metadata: { basis: 'innovation' } },
    ],
  },

  // ── Curitiba BRT Gold Standard ─────────────────────────────────
  {
    doc: {
      id: 'curitiba-brt-gold-standard',
      title: 'Curitiba, Brazil: The Gold Standard BRT and Integrated Land Use Transport System',
      source_type: 'study',
      source_url: 'https://www.curitiba.pr.gov.br/',
      date_published: '2005-01-01',
      summary: 'Curitiba\'s Bus Rapid Transit (BRT) system, launched in 1974, is globally recognized as the gold standard for BRT design. The Curitiba system features: (1) tube stations with off-board fare payment eliminating boarding delay; (2) dedicated bus lanes on all 5 structural axes enforced by physical separation; (3) express/direct/inter-neighbourhood route hierarchy; (4) land use zoning concentrated along BRT corridors (TOD). By 2005, Curitiba moved 2.3 million passengers/day on 300km of BRT with only 3-5 minute headways. Car usage dropped 30% compared to comparable Brazilian cities without BRT. The Curitiba model was directly studied by Jakarta (Transjakarta) and Manila (EDSA Carousel) planners, but neither city achieved Curitiba\'s results because both lacked physical lane enforcement and off-board fare payment. Key lesson for QC: the technology of BRT is simple; the political will to enforce exclusive lanes against motorcycles, cars, and informal transport operators is the hard part.',
    },
    nodes: [
      { id: 'curitiba-brt-policy', type: 'policy', name: 'Curitiba BRT Integrated Urban Transport System (RIT)', description: 'Global BRT gold standard. 2.3M passengers/day on 300km. Tube stations with off-board fare. Physical lane separation. TOD zoning. 30% lower car usage than comparable cities. Studied by Jakarta and Manila planners.', metadata: { city: 'curitiba', year_enacted: 1974, daily_ridership: 2300000, length_km: 300 } },
      { id: 'curitiba', type: 'location', name: 'Curitiba', description: 'Capital of Paraná state, Brazil. Population 1.9 million. Internationally recognised as a global model for integrated urban planning, BRT, and sustainability. Often called "the ecological capital of Brazil".', metadata: { country: 'Brazil', region: 'Latin America', ring: 4 } },
      { id: 'curitiba-brt-outcome-car', type: 'outcome', name: 'Curitiba: 30% lower car usage than comparable Brazilian cities', description: '30% lower car usage than comparable Brazilian cities without integrated BRT. 2.3 million daily BRT passengers. Tube station off-board boarding eliminates dwell time. Physical lane separation achieves 99% lane exclusivity.', metadata: { value: 30, unit: 'car usage reduction vs comparable cities' } },
    ],
    edges: [
      { source_id: 'curitiba-brt-policy', target_id: 'curitiba', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'curitiba-brt-policy', target_id: 'curitiba-brt-outcome-car', relationship: 'resulted_in', weight: 0.9 },
      { source_id: 'curitiba', target_id: 'singapore', relationship: 'proximity_chain', weight: 0.38, metadata: { basis: 'innovation' } },
      { source_id: 'curitiba-brt-policy', target_id: 'jakarta-transjakarta-smart-policy', relationship: 'preceded', weight: 0.7, metadata: { detail: 'Transjakarta directly modelled on Curitiba BRT but without physical lane enforcement' } },
      { source_id: 'curitiba-brt-policy', target_id: 'edsa-carousel-policy', relationship: 'preceded', weight: 0.6, metadata: { detail: 'Manila EDSA Carousel studied Curitiba model but lacked off-board fare and physical separation' } },
    ],
  },

  // ── Medellín Urban Acupuncture and Cable Car ──────────────────
  {
    doc: {
      id: 'medellin-urban-acupuncture-2014',
      title: 'Medellín Urban Acupuncture: Metro Cable and Hillside Community Integration',
      source_type: 'study',
      source_url: 'https://www.medellin.gov.co/',
      date_published: '2014-01-01',
      summary: 'Medellín, Colombia transformed from the world\'s most violent city in 1991 to a global urban innovation model by 2013. The key intervention: "urban acupuncture" — targeted public infrastructure investments in marginalized hilltop comunas (informal settlements) that were previously inaccessible. The Metrocable (aerial gondola connecting hillside comunas to the metro system) reduced travel times from hilltops to the city centre from 2 hours to 15 minutes. Accompanying infrastructure: escalators (the world\'s first outdoor urban escalator system in Comuna 13), libraries, parks, and schools in the same communities. Violence dropped 95% in targeted comunas between 1991 and 2013. The key transferability lesson for QC: informal settlements on hillsides (Payatas, Batasan, New Era) face similar access isolation to Medellín\'s comunas, and targeted infrastructure that connects rather than displaces these communities produces stronger social outcomes than forced resettlement.',
    },
    nodes: [
      { id: 'medellin-metrocable-policy', type: 'policy', name: 'Medellín Metrocable and Urban Acupuncture Programme', description: 'Aerial gondola + escalators connecting hilltop informal comunas to metro system. Travel time hilltop-to-centre: 2hrs → 15min. Violence -95% in targeted comunas. Targeted infrastructure instead of forced resettlement.', metadata: { city: 'medellin', year_enacted: 2004 } },
      { id: 'medellin', type: 'location', name: 'Medellín', description: 'Second largest city in Colombia. Transformed from most violent city globally (1991) to innovation model (2013) through targeted infrastructure investment in marginalized hillside comunas.', metadata: { country: 'Colombia', region: 'Latin America', ring: 4 } },
      { id: 'medellin-comunas-stakeholder', type: 'stakeholder', name: 'Medellín Hillside Comunas Residents', description: 'Informal settlement communities on Medellín hillsides. Previously isolated, high violence, and underserved. Transformed into active civic participants after targeted infrastructure investment.', metadata: { city: 'medellin', type: 'affected community' } },
      { id: 'medellin-outcome-violence', type: 'outcome', name: '95% violence reduction in Medellín targeted comunas (1991–2013)', description: 'Violence dropped 95% in Medellín\'s targeted hillside comunas after urban acupuncture programme. Demonstrated that connectivity and public space investment outperforms purely security-based interventions.', metadata: { value: 95, unit: 'violence reduction percentage' } },
    ],
    edges: [
      { source_id: 'medellin-metrocable-policy', target_id: 'medellin', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'medellin-metrocable-policy', target_id: 'medellin-comunas-stakeholder', relationship: 'affected', weight: 0.95 },
      { source_id: 'medellin-metrocable-policy', target_id: 'medellin-outcome-violence', relationship: 'resulted_in', weight: 0.85 },
      { source_id: 'medellin', target_id: 'singapore', relationship: 'proximity_chain', weight: 0.35, metadata: { basis: 'innovation' } },
    ],
  },

  // ── Taipei Smart Traffic and MRT Integration ──────────────────
  {
    doc: {
      id: 'taipei-smart-traffic-mrt-2021',
      title: 'Taipei Smart City Traffic Management and MRT Integration',
      source_type: 'report',
      source_url: 'https://www.dot.gov.taipei/',
      date_published: '2021-06-01',
      summary: 'Taipei City operates one of Asia\'s highest-rated urban transit systems (MRT) and has built a smart traffic management layer on top: the Taipei ITS platform covers 2,600 traffic signals with AI-driven adaptive control, 12,000 CCTV cameras, and real-time data shared with Google Maps and Apple Maps via open APIs. The YouBike shared bicycle system integrates with the MRT fare system (EasyCard), achieving 350,000 daily rides. Taipei\'s governance model relevant to QC: the Taipei City Government manages the MRT, buses, and traffic signals under a single agency (DoT), unlike Manila\'s fragmented structure. However, Taipei\'s experience launching YouBike in QC-comparable districts showed that bike-sharing requires high-density residential areas and safe cycling infrastructure simultaneously — one without the other results in underutilisation.',
    },
    nodes: [
      { id: 'taipei-its-policy', type: 'policy', name: 'Taipei Smart City ITS and YouBike Integration', description: '2,600 AI-adaptive signals, 12,000 CCTVs, open APIs to Google/Apple Maps. YouBike 350,000 daily rides integrated with MRT EasyCard. Single DoT governance (no MMDA fragmentation equivalent).', metadata: { city: 'taipei', year_enacted: 2016, signals: 2600 } },
      { id: 'taipei', type: 'location', name: 'Taipei', description: 'Capital of Taiwan. MRT serves 2 million daily riders. High tech adoption. Single city government managing transport (no equivalent to Manila\'s MMDA fragmentation). YouBike bike-sharing is Southeast Asia\'s most successful public bike programme.', metadata: { country: 'Taiwan', region: 'East Asia', ring: 4 } },
      { id: 'taipei-dot', type: 'stakeholder', name: 'Taipei City Department of Transportation (DoT)', description: 'Single agency managing Taipei MRT, buses, taxi regulation, traffic signals, and YouBike — eliminating the jurisdictional fragmentation that plagues Manila.', metadata: { city: 'taipei', type: 'city government' } },
      { id: 'taipei-youbike-outcome', type: 'outcome', name: 'YouBike: 350,000 daily rides integrated with MRT', description: '350,000 daily YouBike rides in Taipei, integrated with MRT EasyCard. Requires high-density residential areas AND safe cycling infrastructure — neither alone is sufficient.', metadata: { value: 350000, unit: 'daily YouBike rides' } },
    ],
    edges: [
      { source_id: 'taipei-its-policy', target_id: 'taipei', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'taipei-its-policy', target_id: 'taipei-dot', relationship: 'supported_by', weight: 0.95 },
      { source_id: 'taipei-its-policy', target_id: 'taipei-youbike-outcome', relationship: 'resulted_in', weight: 0.85 },
      { source_id: 'taipei', target_id: 'seoul', relationship: 'proximity_chain', weight: 0.72, metadata: { basis: 'geographic' } },
      { source_id: 'taipei', target_id: 'singapore', relationship: 'proximity_chain', weight: 0.55, metadata: { basis: 'economic' } },
    ],
  },

];

// ── Seeding Logic (same as seed-smartcity.ts) ─────────────────────────────────

async function nodeExists(id: string): Promise<boolean> {
  const r = await d1Query<{ id: string }>(`SELECT id FROM nodes WHERE id = ?`, [id]);
  return r.length > 0;
}

async function docExists(id: string): Promise<boolean> {
  const r = await d1Query<{ id: string }>(`SELECT id FROM documents WHERE id = ?`, [id]);
  return r.length > 0;
}

interface PendingVector { id: string; values: number[]; metadata: Record<string, string> }
const pendingVectors: PendingVector[] = [];

async function seedDataset(dataset: Dataset): Promise<void> {
  const { doc, nodes, edges } = dataset;
  console.log(`\n[${doc.id}] ${doc.title}`);

  if (!(await docExists(doc.id))) {
    await d1Query(
      `INSERT INTO documents (id, title, source_type, source_url, summary, date_published, ingested_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [doc.id, doc.title, doc.source_type, doc.source_url, doc.summary, doc.date_published],
    );
    console.log('  ✓ Document inserted');
  }

  for (const node of nodes) {
    if (await nodeExists(node.id)) {
      // Update description/metadata in case it's richer than what exists
      await d1Query(
        `UPDATE nodes SET description = ?, metadata = ? WHERE id = ?`,
        [node.description, node.metadata ? JSON.stringify(node.metadata) : null, node.id],
      );
      console.log(`  → Node "${node.id}" updated`);
      continue;
    }
    await d1Query(
      `INSERT INTO nodes (id, type, name, description, metadata, source_doc_id, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [node.id, node.type, node.name, node.description, node.metadata ? JSON.stringify(node.metadata) : null, doc.id],
    );
    try {
      const embedding = await getEmbedding(`${node.name}: ${node.description}`);
      pendingVectors.push({ id: node.id, values: embedding, metadata: { type: node.type, name: node.name, doc_id: doc.id } });
      console.log(`  ✓ Node "${node.name}" inserted + embedded`);
    } catch (err) {
      console.warn(`  ✗ Embed failed "${node.id}": ${err}`);
    }
  }

  for (const edge of edges) {
    try {
      await d1Query(
        `INSERT OR IGNORE INTO edges (source_id, target_id, relationship, weight, metadata, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [edge.source_id, edge.target_id, edge.relationship, edge.weight ?? 0.8, edge.metadata ? JSON.stringify(edge.metadata) : null],
      );
    } catch {}
  }
  console.log(`  ✓ ${edges.length} edges inserted`);
}

async function main() {
  console.log('=== Expanded Smart City Knowledge Graph Seeding ===\n');
  for (const ds of DATASETS) {
    try { await seedDataset(ds); } catch (err) { console.error(`✗ Failed "${ds.doc.id}":`, err); }
  }

  const nodeCount = await d1Query<{ count: number }>(`SELECT COUNT(*) as count FROM nodes`);
  const edgeCount = await d1Query<{ count: number }>(`SELECT COUNT(*) as count FROM edges`);
  const docCount = await d1Query<{ count: number }>(`SELECT COUNT(*) as count FROM documents`);
  console.log(`\n=== Done. Docs: ${docCount[0]?.count} | Nodes: ${nodeCount[0]?.count} | Edges: ${edgeCount[0]?.count} ===`);
  console.log(`\nNEXT: vectorize new nodes via:`);
  console.log(`  curl -X POST http://localhost:3000/api/admin/reembed -H "Content-Type: application/json" -d "{}"`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
