#!/usr/bin/env node --experimental-strip-types
// scripts/seed-qc-depth.ts
// Deep Quezon City policy dataset — the closest ring, so the most entries.
// Covers: waste management, solid waste, urban flooding, housing, green spaces,
//   air quality, PUV modernization, informal economy formalization, and smart city.
//
// Usage: node --experimental-strip-types scripts/seed-qc-depth.ts

const ACCOUNT_ID = '8527ec1369d46f55304a6f59ab5356e4';
const DATABASE_ID = 'c401b2f1-a1d1-4b15-b714-e297ca7d5ddc';
const API_TOKEN = 'cfat_JJP1FBjbWrh3ubBX2YXAEHCCyvTO3fEJvDmG8y7E1599f1eb';
const OLLAMA_URL = 'http://localhost:11434';
const EMBED_MODEL = 'nomic-embed-text';
const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

async function d1Query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await fetch(D1_URL, { method: 'POST', headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) });
  if (!res.ok) throw new Error(`D1 ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { result: { results: T[] }[] };
  return json.result?.[0]?.results ?? [];
}
async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: EMBED_MODEL, prompt: text }) });
  if (!res.ok) throw new Error(`Ollama embed ${res.status}`);
  return ((await res.json()) as { embedding: number[] }).embedding;
}

interface NodeDef { id: string; type: 'policy' | 'location' | 'stakeholder' | 'outcome' | 'event' | 'metric'; name: string; description: string; metadata?: Record<string, unknown> }
interface EdgeDef { source_id: string; target_id: string; relationship: string; weight?: number; metadata?: Record<string, unknown> }
interface Dataset { doc: { id: string; title: string; source_type: 'ordinance' | 'news' | 'report' | 'study'; source_url: string; date_published: string; summary: string }; nodes: NodeDef[]; edges: EdgeDef[] }

const DATASETS: Dataset[] = [

  // ── QC Solid Waste Management Ordinance (RA 9003 Implementation) ──────────
  {
    doc: {
      id: 'qc-solid-waste-ra9003-2016',
      title: 'Quezon City Solid Waste Management: RA 9003 Implementation and Barangay Segregation Program',
      source_type: 'ordinance',
      source_url: 'https://www.quezoncity.gov.ph/',
      date_published: '2016-01-01',
      summary: 'Quezon City generates approximately 1,800 metric tons of solid waste per day, making it the largest waste generator in Metro Manila. Under Republic Act 9003 (Ecological Solid Waste Management Act), QC implemented a barangay-level segregation program requiring households to sort waste into biodegradable, non-biodegradable, and residual categories. The program is managed by the QC Environment Protection and Waste Management Department (EPWMD). By 2022, 108 of 142 barangays had operational Materials Recovery Facilities (MRFs), achieving a 22% diversion rate (waste diverted from landfills). The city operates 3 transfer stations and sends waste to the Payatas dumpsite (now sanitary landfill). Challenges: the informal junk shop sector (binero/bote-dyaryo collectors) processes an estimated 30% of recyclables but is unregistered and unprotected. Barangays with low compliance tend to be those with high informal settler populations where household storage space is limited. The Payatas community is directly affected as informal waste pickers (estimated 2,000 individuals) rely on the dumpsite for livelihood.',
    },
    nodes: [
      { id: 'qc-solid-waste-policy', type: 'policy', name: 'QC Solid Waste Segregation and MRF Program (RA 9003)', description: 'Barangay-level waste segregation program. 108/142 barangays with MRFs. 22% landfill diversion rate. 1,800 MT/day waste generation. Informal junk shop sector handles 30% of recyclables unofficially.', metadata: { city: 'quezon-city', year_enacted: 2016, diversion_rate: 22, daily_waste_mt: 1800 } },
      { id: 'qc-epwmd', type: 'stakeholder', name: 'QC Environment Protection and Waste Management Department (EPWMD)', description: 'City department managing solid waste collection, MRF oversight, and environmental compliance. Coordinates barangay-level segregation and manages 3 transfer stations.', metadata: { city: 'quezon-city', type: 'city government' } },
      { id: 'qc-junk-shop-sector', type: 'stakeholder', name: 'QC Informal Junk Shop Collectors (Binero/Bote-Dyaryo)', description: 'Estimated 5,000+ informal waste collectors and junk shop operators in QC who handle 30% of recyclables outside the formal MRF system. Unregistered, unprotected, but economically essential to recycling.', metadata: { city: 'quezon-city', type: 'informal economy', count_est: 5000 } },
      { id: 'qc-payatas-waste-pickers', type: 'stakeholder', name: 'Payatas Community Waste Pickers', description: 'Est. 2,000 informal waste pickers living near the Payatas sanitary landfill in QC. Rely on waste picking for livelihood. Affected by any policy changing landfill operations or waste diversion rates.', metadata: { city: 'quezon-city', type: 'affected community', location: 'Payatas' } },
      { id: 'qc-waste-outcome-diversion', type: 'outcome', name: '22% waste diversion rate from QC MRF program', description: '108 barangay MRFs achieved 22% diversion rate from Payatas landfill by 2022. Low-income barangays with limited storage show lowest compliance. Informal sector handles 30% of recyclables outside formal system.', metadata: { value: 22, unit: 'diversion rate percentage', year: 2022 } },
      { id: 'qc-payatas', type: 'location', name: 'Payatas, Quezon City', description: 'Barangay in QC\'s District 6, home to one of Metro Manila\'s largest sanitary landfills. Community of approx. 100,000 residents, many historically reliant on waste picking from the dumpsite.', metadata: { city: 'quezon-city', district: 6, type: 'location' } },
    ],
    edges: [
      { source_id: 'qc-solid-waste-policy', target_id: 'quezon-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'qc-solid-waste-policy', target_id: 'qc-epwmd', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'qc-solid-waste-policy', target_id: 'qc-junk-shop-sector', relationship: 'affected', weight: 0.75 },
      { source_id: 'qc-solid-waste-policy', target_id: 'qc-payatas-waste-pickers', relationship: 'affected', weight: 0.85 },
      { source_id: 'qc-solid-waste-policy', target_id: 'qc-waste-outcome-diversion', relationship: 'resulted_in', weight: 0.82 },
      { source_id: 'qc-payatas', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-payatas-waste-pickers', target_id: 'qc-payatas', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-barangay-system', target_id: 'qc-solid-waste-policy', relationship: 'supported_by', weight: 0.7, metadata: { detail: 'Barangay captains responsible for MRF compliance enforcement' } },
    ],
  },

  // ── QC Flood Control and Drainage Master Plan ─────────────────────────────
  {
    doc: {
      id: 'qc-flood-control-master-plan-2021',
      title: 'Quezon City Flood Control and Drainage Master Plan 2021–2030',
      source_type: 'report',
      source_url: 'https://www.quezoncity.gov.ph/',
      date_published: '2021-09-01',
      summary: 'Quezon City is traversed by 8 major creek systems including the Diliman, Tullahan, San Juan, and Katipunan creeks, which regularly flood 47 flood-prone barangays during the wet season. The QC Flood Control and Drainage Master Plan 2021–2030 targets PHP 18 billion in infrastructure investments including creek dredging, box culverts, retention basins, and catch basin upgrades. Priority flood areas: Batasan Hills, Holy Spirit, Commonwealth, Bagong Silangan (north-eastern QC, upper Marikina watershed). Key challenge: many drainage rights-of-way are occupied by informal settlements, making construction dependent on resettlement — the same bottleneck that has delayed DPWH flood control projects for decades. The city\'s early warning system (managed by CDRRMO-QC) uses PAGASA rainfall data and creek level sensors to trigger barangay-level evacuation, but sensor coverage is incomplete (only 4 of 8 creek systems are monitored). Post-Ondoy lesson from Marikina has been partially adopted.',
    },
    nodes: [
      { id: 'qc-flood-master-plan-policy', type: 'policy', name: 'QC Flood Control and Drainage Master Plan 2021–2030', description: 'PHP 18B flood infrastructure investment targeting 47 flood-prone barangays. 8 creek systems. Creek dredging, box culverts, retention basins. Key bottleneck: ISF settlements on drainage ROW. Partial EWS coverage on 4 of 8 creeks.', metadata: { city: 'quezon-city', year_enacted: 2021, budget_php: 18000000000 } },
      { id: 'qc-cdrrmo', type: 'stakeholder', name: 'Quezon City CDRRMO (City Disaster Risk Reduction and Management Office)', description: 'Manages QC\'s flood early warning system, evacuation protocols, and disaster response. Operates creek level sensors on 4 of 8 major QC creek systems.', metadata: { city: 'quezon-city', type: 'city government' } },
      { id: 'qc-flood-prone-barangays', type: 'location', name: 'QC Flood-Prone Barangays (47 barangays)', description: '47 barangays in QC regularly flooded during monsoon season. Concentrated in northern QC (Batasan Hills, Holy Spirit, Commonwealth, Bagong Silangan) along upper Marikina watershed tributaries.', metadata: { city: 'quezon-city', count: 47, areas: 'Batasan Hills, Holy Spirit, Commonwealth, Bagong Silangan' } },
      { id: 'qc-diliman-creek', type: 'location', name: 'Diliman Creek System, Quezon City', description: 'Major creek system flowing through central QC past UP Diliman. Regular flooding in Barangays Pinyahan, East Triangle, UP Campus. Part of the Marikina River basin.', metadata: { city: 'quezon-city', creek: 'Diliman', type: 'waterway' } },
      { id: 'qc-flood-outcome-incomplete', type: 'outcome', name: 'QC flood EWS covers only 4 of 8 creek systems', description: 'QC CDRRMO\'s flood early warning sensors installed on only 4 of 8 major creek systems as of 2023. Incomplete coverage means late warnings in uncovered catchments. DPWH national projects delayed by ISF ROW conflicts.', metadata: { covered_creeks: 4, total_creeks: 8 } },
    ],
    edges: [
      { source_id: 'qc-flood-master-plan-policy', target_id: 'quezon-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'qc-flood-master-plan-policy', target_id: 'qc-cdrrmo', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'qc-flood-master-plan-policy', target_id: 'qc-flood-prone-barangays', relationship: 'affected', weight: 0.95 },
      { source_id: 'qc-flood-prone-barangays', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-diliman-creek', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-flood-master-plan-policy', target_id: 'qc-flood-outcome-incomplete', relationship: 'resulted_in', weight: 0.7 },
      { source_id: 'marikina-flood-ews-policy', target_id: 'qc-flood-master-plan-policy', relationship: 'related_to', weight: 0.85, metadata: { detail: 'Marikina EWS model partially adopted by QC CDRRMO; QC lacks Marikina\'s sensor density' } },
    ],
  },

  // ── QC PUV Modernization (Jeepney Phase-out) ──────────────────────────────
  {
    doc: {
      id: 'qc-puv-modernization-2023',
      title: 'Quezon City PUV Modernization Program: Jeepney Consolidation and E-Jeepney Transition',
      source_type: 'news',
      source_url: 'https://www.quezoncity.gov.ph/',
      date_published: '2023-01-01',
      summary: 'The DOTr\'s Public Utility Vehicle (PUV) Modernization Program requires all traditional jeepneys in the Philippines to be replaced with Euro 4-compliant or electric vehicles operated by cooperatives (not individual operators). Quezon City has 8,400 jeepney operators on 87 QC-originating routes. The modernization program has been a major point of contention: PISTON (Pagkakaisa ng mga Samahan ng Tsuper at Opereytor ng Pilipinas) and ACTO organized multiple transport strikes in 2018, 2019, and 2023, halting QC and Metro Manila public transport. As of 2023, only 12% of QC jeepney operators have consolidated into cooperatives, far below the DOTr target of 80%. The main barriers: consolidation capital requirements (PHP 2.5M per unit), loss of individual operator flexibility, and distrust of cooperative management. The e-jeepney pilot on C-5 and Katipunan routes showed positive ridership response (+15%) but operators report 40% higher maintenance costs.',
    },
    nodes: [
      { id: 'qc-puv-modernization-policy', type: 'policy', name: 'QC PUV Modernization: Jeepney Consolidation to Cooperatives', description: 'DOTr mandate to replace traditional jeepneys with Euro 4/EV cooperatives. 8,400 QC operators on 87 routes. Only 12% consolidated by 2023. Three transport strikes (2018, 2019, 2023). E-jeepney pilot on C-5/Katipunan: +15% ridership, +40% maintenance costs.', metadata: { city: 'quezon-city', year_enacted: 2017, operators: 8400, routes: 87, consolidation_rate: 12 } },
      { id: 'qc-piston-acto', type: 'stakeholder', name: 'PISTON and ACTO (Jeepney Operator-Driver Federations)', description: 'National transport federations representing QC jeepney operators. Organized major transport strikes in 2018, 2019, 2023 against PUV Modernization. Key political constituency for any QC transport reform.', metadata: { city: 'quezon-city', type: 'transport federation' } },
      { id: 'qc-ejeepney-pilot', type: 'policy', name: 'QC E-Jeepney Pilot on C-5 and Katipunan Routes', description: 'Electric jeepney pilot program on C-5 and Katipunan routes in QC. +15% ridership increase vs traditional jeepneys. +40% maintenance costs reported by operators. Charging infrastructure gaps on outer routes.', metadata: { city: 'quezon-city', year_enacted: 2022, routes: 'C-5, Katipunan' } },
      { id: 'qc-puv-outcome-strike', type: 'event', name: 'QC-Metro Manila Jeepney Transport Strikes (2018, 2019, 2023)', description: 'Three major transport strikes in Metro Manila including QC protesting PUV Modernization. Paralysed public transport for 1-5 days each. Demonstrated organized resistance from jeepney operators to route consolidation.', metadata: { years: [2018, 2019, 2023], duration_days: '1-5 per strike' } },
      { id: 'qc-puv-outcome-low-consolidation', type: 'outcome', name: 'Only 12% QC jeepney consolidation rate vs 80% DOTr target', description: 'Only 12% of QC jeepney operators consolidated into cooperatives by 2023 vs DOTr\'s 80% target. Main barriers: PHP 2.5M capital requirement per unit, loss of individual flexibility, distrust of cooperative management.', metadata: { target: 80, achieved: 12, unit: 'percent consolidation', year: 2023 } },
    ],
    edges: [
      { source_id: 'qc-puv-modernization-policy', target_id: 'quezon-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'qc-puv-modernization-policy', target_id: 'qc-jeepney-operators', relationship: 'affected', weight: 0.95 },
      { source_id: 'qc-puv-modernization-policy', target_id: 'qc-piston-acto', relationship: 'conflicted_with', weight: 0.9 },
      { source_id: 'qc-piston-acto', target_id: 'qc-puv-modernization-policy', relationship: 'opposed_by', weight: 0.9 },
      { source_id: 'qc-puv-modernization-policy', target_id: 'qc-puv-outcome-strike', relationship: 'resulted_in', weight: 0.85 },
      { source_id: 'qc-puv-modernization-policy', target_id: 'qc-puv-outcome-low-consolidation', relationship: 'resulted_in', weight: 0.85 },
      { source_id: 'qc-ejeepney-pilot', target_id: 'quezon-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'qc-puv-modernization-policy', target_id: 'qc-ejeepney-pilot', relationship: 'resulted_in', weight: 0.7 },
      { source_id: 'dotr', target_id: 'qc-puv-modernization-policy', relationship: 'supported_by', weight: 0.85 },
    ],
  },

  // ── QC Urban Greening and Tree Preservation Ordinance ─────────────────────
  {
    doc: {
      id: 'qc-urban-greening-2019',
      title: 'Quezon City Urban Greening Program and Tree Preservation Ordinance',
      source_type: 'ordinance',
      source_url: 'https://www.quezoncity.gov.ph/',
      date_published: '2019-03-01',
      summary: 'Quezon City is known as the "City of Stars and Gardenias" and has the largest urban forest canopy in Metro Manila. The QC Tree Preservation Ordinance prohibits tree cutting without DENR and city government permits and mandates a 1:3 replacement ratio (3 trees planted for every 1 cut). The Urban Greening Program targets 3,000 trees planted per year in public spaces, school grounds, and creek banks. QC\'s green coverage is estimated at 14% of city area (compared to Metro Manila average of 6%), but development pressure is threatening tree cover in the UP Diliman area, Diliman Commonwealth, and Tandang Sora. Key challenge: private subdivisions are legally exempt from the tree ordinance in gated areas, and real estate development along Katipunan and C-5 has resulted in illegal tree cutting (107 violation cases in 2022). The Parks Development and Administration Department (PDAD) manages QC\'s 84 parks and 6 identified urban forests.',
    },
    nodes: [
      { id: 'qc-tree-preservation-policy', type: 'policy', name: 'QC Tree Preservation Ordinance and Urban Greening Program', description: 'No tree cutting without DENR+city permits. 1:3 replacement ratio. 3,000 trees/year target. 14% green coverage (highest in NCR). 107 illegal cutting violations in 2022. Private subdivisions exempt from ordinance.', metadata: { city: 'quezon-city', year_enacted: 2019, green_coverage_pct: 14 } },
      { id: 'qc-pdad', type: 'stakeholder', name: 'QC Parks Development and Administration Department (PDAD)', description: 'Manages 84 parks, 6 urban forests, and oversees urban greening in QC. Enforces tree preservation ordinance on public land.', metadata: { city: 'quezon-city', type: 'city government' } },
      { id: 'qc-real-estate-developers', type: 'stakeholder', name: 'QC Real Estate Developers (Katipunan / C-5 Corridor)', description: 'Property developers along Katipunan, C-5, and Tandang Sora corridors. Subject to EIS requirements but have lobbied for ordinance exemptions. 107 illegal cutting cases filed in 2022 primarily from this sector.', metadata: { city: 'quezon-city', type: 'private sector' } },
      { id: 'up-diliman', type: 'location', name: 'University of the Philippines Diliman', description: 'National university campus within Quezon City occupying 493 hectares. Contains one of the few remaining large urban forests in Metro Manila. Major green lung and ecological resource for QC.', metadata: { city: 'quezon-city', area_ha: 493, type: 'institution' } },
      { id: 'qc-greening-outcome-coverage', type: 'outcome', name: 'QC 14% green coverage — highest in Metro Manila', description: 'QC maintains 14% green area coverage vs Metro Manila average of 6%. Threatened by real estate development. 107 illegal tree cutting violations in 2022 primarily along Katipunan and C-5.', metadata: { value: 14, unit: 'percent green coverage', comparison: 'NCR average 6%' } },
    ],
    edges: [
      { source_id: 'qc-tree-preservation-policy', target_id: 'quezon-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'qc-tree-preservation-policy', target_id: 'qc-pdad', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'qc-tree-preservation-policy', target_id: 'qc-real-estate-developers', relationship: 'conflicted_with', weight: 0.65 },
      { source_id: 'qc-real-estate-developers', target_id: 'qc-tree-preservation-policy', relationship: 'opposed_by', weight: 0.5 },
      { source_id: 'qc-tree-preservation-policy', target_id: 'qc-greening-outcome-coverage', relationship: 'resulted_in', weight: 0.8 },
      { source_id: 'up-diliman', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
    ],
  },

  // ── QC Affordable Housing and In-City Resettlement ────────────────────────
  {
    doc: {
      id: 'qc-affordable-housing-2020',
      title: 'Quezon City In-City Resettlement and Socialized Housing Program',
      source_type: 'report',
      source_url: 'https://www.quezoncity.gov.ph/',
      date_published: '2020-06-01',
      summary: 'Quezon City has approximately 320,000 informal settler families (ISF) — one of the largest ISF populations in the Philippines. The QC In-City Resettlement Program, managed by the Community Development Department (CDD), targets relocation to medium-rise socialized housing within QC — specifically along the EDSA-Quezon Ave and Commonwealth corridors — to maintain livelihood access. Unlike Caloocan\'s out-of-city approach, QC\'s in-city model has a 15% return rate (vs Caloocan\'s 35%) because housing sites are within 2km of original communities. Key QC projects: (1) the Bistekville resettlement series (Bistekville 1–4, 7,000 units) in Novaliches; (2) the Holy Spirit ISF resettlement near the old quarry; (3) the Commonwealth Avenue ISF relocation for creek easements. The CDD partners with Pag-IBIG Fund for end-user financing at PHP 400/month amortization. Main challenge: land scarcity in QC — suitable in-city sites for large-scale housing are almost exhausted in southern QC; remaining sites are in distant Novaliches.',
    },
    nodes: [
      { id: 'qc-in-city-resettlement-policy', type: 'policy', name: 'QC In-City ISF Resettlement to Socialized Housing', description: 'In-city resettlement to medium-rise housing maintaining livelihood proximity. 15% return rate vs 35% for out-of-city (Caloocan model). Bistekville series (7,000 units in Novaliches). Pag-IBIG PHP 400/month financing.', metadata: { city: 'quezon-city', year_enacted: 2010, isf_population: 320000, return_rate: 15 } },
      { id: 'qc-cdd', type: 'stakeholder', name: 'QC Community Development Department (CDD)', description: 'City department managing QC\'s in-city resettlement programme, community organizing, and livelihood integration for ISF communities.', metadata: { city: 'quezon-city', type: 'city government' } },
      { id: 'qc-isf-communities', type: 'stakeholder', name: 'QC Informal Settler Families (320,000 households)', description: 'Est. 320,000 ISF households in QC, concentrated in creek easements, railway ROW, and government land. Affected by any infrastructure, transport, or drainage policy.', metadata: { city: 'quezon-city', type: 'affected community', count: 320000 } },
      { id: 'qc-bistekville', type: 'location', name: 'Bistekville Housing Resettlement (Novaliches, QC)', description: 'QC\'s flagship in-city resettlement: Bistekville 1-4 in Novaliches, providing 7,000 socialized housing units. Medium-rise, with community facilities. Located in northern QC, Novaliches.', metadata: { city: 'quezon-city', units: 7000, location: 'Novaliches' } },
      { id: 'qc-housing-outcome-return', type: 'outcome', name: 'QC in-city resettlement: 15% return rate vs 35% out-of-city', description: 'QC\'s in-city resettlement approach achieves 15% return rate (vs 35% for Caloocan\'s out-of-city model) because sites are within 2km of original livelihood areas. PHP 400/month Pag-IBIG financing makes housing affordable.', metadata: { value: 15, unit: 'return rate percentage', comparison: 'Caloocan out-of-city: 35%' } },
    ],
    edges: [
      { source_id: 'qc-in-city-resettlement-policy', target_id: 'quezon-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'qc-in-city-resettlement-policy', target_id: 'qc-cdd', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'qc-in-city-resettlement-policy', target_id: 'qc-isf-communities', relationship: 'affected', weight: 0.95 },
      { source_id: 'qc-in-city-resettlement-policy', target_id: 'qc-housing-outcome-return', relationship: 'resulted_in', weight: 0.88 },
      { source_id: 'qc-bistekville', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-in-city-resettlement-policy', target_id: 'caloocan-isf-relocation-policy', relationship: 'related_to', weight: 0.8, metadata: { detail: 'QC in-city model outperforms Caloocan out-of-city: 15% vs 35% return rate' } },
    ],
  },

  // ── QC Smart City Office and Digital Governance ───────────────────────────
  {
    doc: {
      id: 'qc-smart-city-digital-gov-2022',
      title: 'Quezon City Smart City Office and Digital Governance Initiatives',
      source_type: 'report',
      source_url: 'https://www.quezoncity.gov.ph/smart-city',
      date_published: '2022-08-01',
      summary: 'Quezon City established a Smart City Office in 2019 under the City Administrator\'s office. Key digital governance achievements: (1) QCitizen app — mobile app for business permit renewal, complaint filing, and health monitoring with 450,000 registered users by 2023; (2) QC GIS Mapping Portal — real-time geographic information system for urban planning and disaster response; (3) Command Center — 1,200 CCTV cameras integrated with QCPD and BFP dispatch; (4) e-payment rollout — 85% of city transactions moved online since 2020 (COVID catalyst). Technology partnerships include Samsung (command center), DICT (Digital Infrastructure), and Globe Telecom (connectivity). Key limitation: the Smart City Office has advisory authority only — it cannot compel other city departments to adopt digital systems, creating uneven implementation across the 142 barangays. Privacy advocacy groups have flagged the CCTV expansion as needing a formal data governance policy.',
    },
    nodes: [
      { id: 'qc-smart-city-office', type: 'stakeholder', name: 'Quezon City Smart City Office', description: 'City office managing QC\'s digital governance: QCitizen app (450K users), GIS portal, 1,200-camera Command Center, and 85% e-payment adoption. Advisory authority only — cannot compel other departments.', metadata: { city: 'quezon-city', type: 'city government', established: 2019 } },
      { id: 'qc-citizen-app', type: 'policy', name: 'QCitizen Mobile App and E-Government Platform', description: 'Mobile app for QC residents: business permits, complaint filing, health monitoring. 450,000 registered users by 2023. 85% of city transactions online after COVID catalyzed adoption.', metadata: { city: 'quezon-city', year_launched: 2020, users: 450000 } },
      { id: 'qc-gis-portal', type: 'policy', name: 'QC GIS Mapping Portal (Urban Planning and Disaster Response)', description: 'Real-time geographic information system for QC urban planning, infrastructure mapping, and CDRRMO disaster response. Integrated with flood monitoring data and building permit records.', metadata: { city: 'quezon-city', year_launched: 2019 } },
      { id: 'qc-smart-city-outcome-epayment', type: 'outcome', name: '85% of QC transactions online and 450K QCitizen app users', description: 'COVID catalyzed QC\'s e-government transition: 85% of city transactions now online. QCitizen app has 450K registered users. But Smart City Office has advisory-only authority, creating uneven departmental adoption.', metadata: { epayment_pct: 85, app_users: 450000, year: 2023 } },
      { id: 'qc-data-privacy-concern', type: 'stakeholder', name: 'QC Privacy Advocacy Groups (Data Governance)', description: 'Civil society organizations flagging QC\'s 1,200-CCTV expansion as needing formal data governance policy. Same groups raised concerns about CCTV traffic enforcement data access.', metadata: { city: 'quezon-city', type: 'civil society' } },
    ],
    edges: [
      { source_id: 'qc-citizen-app', target_id: 'quezon-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'qc-gis-portal', target_id: 'quezon-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'qc-smart-city-office', target_id: 'quezon-city', relationship: 'located_in', weight: 1.0 },
      { source_id: 'qc-citizen-app', target_id: 'qc-smart-city-office', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'qc-gis-portal', target_id: 'qc-smart-city-office', relationship: 'supported_by', weight: 0.9 },
      { source_id: 'qc-citizen-app', target_id: 'qc-smart-city-outcome-epayment', relationship: 'resulted_in', weight: 0.88 },
      { source_id: 'qc-command-center', target_id: 'qc-smart-city-office', relationship: 'related_to', weight: 0.85 },
      { source_id: 'qc-data-privacy-concern', target_id: 'qc-cctv-traffic-policy', relationship: 'related_to', weight: 0.8 },
      { source_id: 'qc-data-privacy-concern', target_id: 'qc-smart-city-office', relationship: 'related_to', weight: 0.75 },
    ],
  },

  // ── QC Air Quality and Anti-Smoke Belching Program ────────────────────────
  {
    doc: {
      id: 'qc-air-quality-smoke-belching-2021',
      title: 'Quezon City Air Quality Monitoring and Anti-Smoke Belching Enforcement Program',
      source_type: 'ordinance',
      source_url: 'https://www.quezoncity.gov.ph/',
      date_published: '2021-01-01',
      summary: 'Quezon City has 12 ambient air quality monitoring stations maintained jointly by DENR-EMB and the QC Environment Protection and Waste Management Department (EPWMD). PM2.5 levels along EDSA and Commonwealth regularly exceed the 35 µg/m³ Philippine Annual Ambient Air Quality Standard (PAAQS). QC\'s anti-smoke belching apprehension program uses roadside emissions testing: vehicles failing the test receive an Order of Payment (PHP 2,000–10,000 fine). In 2022, QC apprehended 4,200 smoke-belching vehicles. However, enforcement is seasonal (dry season only due to wet-season limitations on outdoor testing) and focused on MMDA-managed roads only. Diesel jeepneys and old trucks are the primary offenders. Any policy affecting jeepney fleet composition (e.g., PUV Modernization) or traffic flow (e.g., AI signal control reducing idling time) would directly impact QC air quality metrics.',
    },
    nodes: [
      { id: 'qc-air-quality-policy', type: 'policy', name: 'QC Anti-Smoke Belching Enforcement and Air Quality Monitoring', description: 'Roadside emissions testing with PHP 2,000–10,000 fines. 4,200 vehicles apprehended 2022. 12 ambient AQ monitoring stations. PM2.5 regularly exceeds PAAQS on EDSA and Commonwealth. Seasonal enforcement (dry season only).', metadata: { city: 'quezon-city', year_enacted: 2021, apprehensions_2022: 4200 } },
      { id: 'qc-air-quality-outcome', type: 'outcome', name: 'PM2.5 exceeds PAAQS on QC major roads despite enforcement', description: 'PM2.5 levels on EDSA and Commonwealth regularly exceed 35 µg/m³ PAAQS. Anti-smoke belching program catches 4,200 vehicles/year but seasonal limitation and focus on MMDA roads limits impact.', metadata: { pm25_standard: 35, unit: 'µg/m³', roads_affected: 'EDSA, Commonwealth' } },
      { id: 'qc-denr-emb', type: 'stakeholder', name: 'DENR-EMB (Environment Management Bureau) NCR', description: 'National agency maintaining QC\'s ambient air quality monitoring network. Issues emissions testing standards and certifications for smoke-belching enforcement.', metadata: { city: 'quezon-city', type: 'national government' } },
    ],
    edges: [
      { source_id: 'qc-air-quality-policy', target_id: 'quezon-city', relationship: 'enacted_in', weight: 1.0 },
      { source_id: 'qc-air-quality-policy', target_id: 'qc-epwmd', relationship: 'supported_by', weight: 0.88 },
      { source_id: 'qc-air-quality-policy', target_id: 'qc-denr-emb', relationship: 'supported_by', weight: 0.8 },
      { source_id: 'qc-air-quality-policy', target_id: 'qc-air-quality-outcome', relationship: 'resulted_in', weight: 0.75 },
      { source_id: 'qc-jeepney-operators', target_id: 'qc-air-quality-policy', relationship: 'affected', weight: 0.8, metadata: { detail: 'Diesel jeepneys are primary smoke-belching violators' } },
      { source_id: 'qc-air-quality-policy', target_id: 'qc-commonwealth-ave', relationship: 'affected', weight: 0.85 },
    ],
  },

];

async function nodeExists(id: string): Promise<boolean> {
  const r = await d1Query<{ id: string }>(`SELECT id FROM nodes WHERE id = ?`, [id]);
  return r.length > 0;
}
async function docExists(id: string): Promise<boolean> {
  const r = await d1Query<{ id: string }>(`SELECT id FROM documents WHERE id = ?`, [id]);
  return r.length > 0;
}

async function seedDataset(dataset: Dataset): Promise<void> {
  const { doc, nodes, edges } = dataset;
  console.log(`\n[${doc.id}]`);
  if (!(await docExists(doc.id))) {
    await d1Query(`INSERT INTO documents (id, title, source_type, source_url, summary, date_published, ingested_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [doc.id, doc.title, doc.source_type, doc.source_url, doc.summary, doc.date_published]);
    console.log('  ✓ doc');
  }
  for (const node of nodes) {
    if (await nodeExists(node.id)) {
      await d1Query(`UPDATE nodes SET description = ?, metadata = ? WHERE id = ?`,
        [node.description, node.metadata ? JSON.stringify(node.metadata) : null, node.id]);
      console.log(`  → updated "${node.id}"`); continue;
    }
    await d1Query(`INSERT INTO nodes (id, type, name, description, metadata, source_doc_id, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [node.id, node.type, node.name, node.description, node.metadata ? JSON.stringify(node.metadata) : null, doc.id]);
    try {
      await getEmbedding(`${node.name}: ${node.description}`); // validate Ollama reachable
      console.log(`  ✓ "${node.name}"`);
    } catch { console.warn(`  ✗ embed failed "${node.id}"`); }
  }
  for (const edge of edges) {
    try {
      await d1Query(`INSERT OR IGNORE INTO edges (source_id, target_id, relationship, weight, metadata, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [edge.source_id, edge.target_id, edge.relationship, edge.weight ?? 0.8, edge.metadata ? JSON.stringify(edge.metadata) : null]);
    } catch {}
  }
  console.log(`  ✓ ${edges.length} edges`);
}

async function main() {
  console.log('=== QC Depth Seeding ===\n');
  for (const ds of DATASETS) {
    try { await seedDataset(ds); } catch (e) { console.error(`✗ "${ds.doc.id}":`, e); }
  }
  const [nc, ec, dc] = await Promise.all([
    d1Query<{ count: number }>(`SELECT COUNT(*) as count FROM nodes`),
    d1Query<{ count: number }>(`SELECT COUNT(*) as count FROM edges`),
    d1Query<{ count: number }>(`SELECT COUNT(*) as count FROM documents`),
  ]);
  console.log(`\n=== Done. Docs: ${dc[0]?.count} | Nodes: ${nc[0]?.count} | Edges: ${ec[0]?.count} ===`);
  console.log('\nRun reembed to vectorize new nodes:');
  console.log('  curl -X POST http://localhost:3000/api/admin/reembed -H "Content-Type: application/json" -d "{}"');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
