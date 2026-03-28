// src/lib/report.ts
import type { SimulationResult, WeatherContext } from './types';

interface ReportData {
  simulationId: string;
  policy: string;
  location: string;
  simulation: SimulationResult;
  context: unknown;
  weatherContext?: WeatherContext | null;
  date: string;
}

const scoreColor = (score: number) =>
  score > 0 ? '#1D9E75' : score < 0 ? '#E24B4A' : '#888';

const scoreSign = (score: number) => (score > 0 ? `+${score}` : `${score}`);

export function generateReportHTML(data: ReportData): string {
  const s = data.simulation;
  const w = data.weatherContext;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Simula Report — ${data.policy}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 22px; font-weight: 600; border-bottom: 3px solid #1D9E75; padding-bottom: 8px; margin-bottom: 4px; }
    h2 { font-size: 17px; font-weight: 600; color: #0F6E56; margin-top: 28px; margin-bottom: 10px; }
    .subtitle { font-size: 13px; color: #666; margin-bottom: 20px; }
    .meta { background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 14px; }
    .meta strong { display: inline-block; min-width: 100px; }
    .score-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 12px 0; }
    .score-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px; }
    .score-card .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .score-card .value { font-size: 32px; font-weight: 700; margin: 4px 0; }
    .score-card .reasoning { font-size: 13px; color: #444; line-height: 1.5; }
    .sustainability-row { display: flex; align-items: center; gap: 16px; margin: 16px 0; padding: 16px; background: #f0faf5; border-radius: 8px; }
    .sustainability-row .gauge { font-size: 42px; font-weight: 700; text-align: center; }
    .sustainability-row .gauge small { display: block; font-size: 12px; font-weight: 400; color: #666; }
    .sustainability-row .arrow { font-size: 28px; color: #1D9E75; }
    .weather-box { background: #e8f4fd; border: 1px solid #b3d9f5; border-radius: 8px; padding: 14px; margin: 12px 0; font-size: 13px; }
    .weather-box .title { font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #1a4f7a; }
    .weather-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
    .weather-stat { background: white; border-radius: 6px; padding: 8px; text-align: center; }
    .weather-stat .val { font-size: 18px; font-weight: 600; }
    .weather-stat .lbl { font-size: 11px; color: #666; }
    .season-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-top: 8px; }
    .wet { background: #dbeafe; color: #1e40af; }
    .dry { background: #fef3c7; color: #92400e; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { padding: 8px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid #eee; }
    th { font-weight: 600; color: #444; background: #fafafa; }
    .timeline { border-left: 3px solid #1D9E75; padding-left: 20px; margin: 12px 0; }
    .timeline-step { margin-bottom: 16px; }
    .timeline-step .period { font-weight: 600; font-size: 14px; }
    .timeline-step .delta { font-size: 12px; color: #1D9E75; }
    .timeline-step p { font-size: 13px; color: #333; margin-top: 2px; }
    .persona { background: #f8f8f8; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
    .persona .type { font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; margin-bottom: 4px; }
    .persona .type.supporter { color: #1D9E75; }
    .persona .type.opponent { color: #E24B4A; }
    .persona .type.neutral { color: #888; }
    .risk { border-left: 3px solid #E24B4A; padding: 8px 12px; margin-bottom: 8px; background: #fef8f8; border-radius: 0 6px 6px 0; }
    .risk .header { font-weight: 600; font-size: 14px; }
    .risk .likelihood { font-size: 12px; color: #666; }
    .risk .mitigation { font-size: 13px; color: #444; margin-top: 4px; }
    .rec { padding: 6px 0; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
    .confidence { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; }
    .confidence.high { background: #e6f9f0; color: #0F6E56; }
    .confidence.medium { background: #fef3cd; color: #854F0B; }
    .confidence.low { background: #fce8e8; color: #993556; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>Simula Policy Simulation Report</h1>
  <p class="subtitle">Simulation ID: ${data.simulationId}</p>

  <div class="meta">
    <strong>Policy:</strong> ${data.policy}<br>
    <strong>Location:</strong> ${data.location}<br>
    <strong>Date:</strong> ${new Date(data.date).toLocaleDateString('en-PH', { dateStyle: 'long' })}<br>
    <strong>Confidence:</strong> <span class="confidence ${s.confidence ?? 'medium'}">${(s.confidence ?? 'medium').toUpperCase()}</span><br>
    ${s.confidence_reasoning ? `<span style="font-size:13px;color:#666">${s.confidence_reasoning}</span>` : ''}
  </div>

  ${w ? `
  <h2>Environmental Context at Simulation Time</h2>
  <div class="weather-box">
    <div class="title">Live conditions — ${data.location}</div>
    <div class="weather-grid">
      <div class="weather-stat">
        <div class="val">${w.temperature}°C</div>
        <div class="lbl">Temperature</div>
      </div>
      <div class="weather-stat">
        <div class="val">${w.usAqi ?? 'N/A'}</div>
        <div class="lbl">Air Quality (AQI)</div>
      </div>
      <div class="weather-stat">
        <div class="val" style="color:${w.floodRisk === 'high' ? '#E24B4A' : w.floodRisk === 'moderate' ? '#f97316' : '#1D9E75'}">${w.floodRisk.toUpperCase()}</div>
        <div class="lbl">Flood Risk</div>
      </div>
    </div>
    <span class="season-badge ${w.isRainySeason ? 'wet' : 'dry'}">${w.season}</span>
  </div>
  ` : ''}

  <h2>Policy Summary</h2>
  <p>${s.policy_summary ?? ''}</p>
  <p style="margin-top:8px;color:#555">${s.location_context ?? ''}</p>

  <h2>Impact Scores</h2>
  <div class="score-grid">
    ${(['economic', 'environmental', 'social', 'human_centered'] as const).map((key) => {
      const impact = s.impact_scores?.[key] ?? { score: 0, reasoning: '' };
      return `<div class="score-card">
        <div class="label">${key.replace('_', '-')}</div>
        <div class="value" style="color:${scoreColor(impact.score)}">${scoreSign(impact.score)}</div>
        <div class="reasoning">${impact.reasoning}</div>
      </div>`;
    }).join('')}
  </div>

  <h2>Sustainability Index</h2>
  <div class="sustainability-row">
    <div class="gauge" style="color:#888">
      ${s.sustainability_score?.before ?? '—'}
      <small>Before</small>
    </div>
    <div class="arrow">→</div>
    <div class="gauge" style="color:#1D9E75">
      ${s.sustainability_score?.after ?? '—'}
      <small>After</small>
    </div>
  </div>
  ${s.sustainability_score?.breakdown ? `
  <table>
    <tr><th>Category</th><th>Score (0–100)</th></tr>
    ${Object.entries(s.sustainability_score.breakdown).map(([k, v]) =>
      `<tr><td>${k.replace(/_/g, ' ')}</td><td>${v}</td></tr>`
    ).join('')}
  </table>` : ''}

  <h2>Projected Timeline</h2>
  <div class="timeline">
    ${(s.simulation_timeline ?? []).map((step) => `
      <div class="timeline-step">
        <div class="period">${step.period} — ${step.label}
          ${step.sustainability_delta ? `<span class="delta">(sustainability ${step.sustainability_delta > 0 ? '+' : ''}${step.sustainability_delta})</span>` : ''}
        </div>
        <p>${step.events}</p>
      </div>
    `).join('')}
  </div>

  <h2>Stakeholder Reactions</h2>
  ${(['supporter', 'opponent', 'neutral'] as const).map((type) => {
    const p = s.persona_reactions?.[type] ?? { profile: '', reaction: '' };
    return `<div class="persona">
      <div class="type ${type}">${type}</div>
      <p><strong>${p.profile}</strong></p>
      <p style="margin-top:4px">${p.reaction}</p>
    </div>`;
  }).join('')}

  <h2>Risks</h2>
  ${(s.risks ?? []).map((r) => `
    <div class="risk">
      <div class="header">${r.risk}</div>
      <div class="likelihood">Likelihood: ${r.likelihood}</div>
      <div class="mitigation"><strong>Mitigation:</strong> ${r.mitigation}</div>
    </div>
  `).join('')}

  <h2>Recommendations</h2>
  ${(s.recommendations ?? []).map((r) => `<div class="rec">→ ${r}</div>`).join('')}

  ${(s.historical_precedents?.length ?? 0) > 0 ? `
  <h2>Historical Precedents Referenced</h2>
  <table>
    <tr><th>Policy</th><th>Relevance</th><th>Outcome</th></tr>
    ${s.historical_precedents.map((p) =>
      `<tr><td>${p.policy_name}</td><td>${p.relevance}</td><td>${p.outcome_summary}</td></tr>`
    ).join('')}
  </table>` : ''}

  <div class="footer">
    <strong>Generated by Simula</strong> — Policy Simulation Platform for Sustainable Urban Development<br>
    SDG Alignment: Goal 7 (Affordable & Clean Energy), Goal 11 (Sustainable Cities), Goal 12 (Responsible Consumption)<br>
    Data sourced from QC government ordinances, news reports, and policy research.<br>
    This simulation is for educational and research purposes. Results are projections, not guarantees.
  </div>
</body>
</html>`;
}
