export interface Dimension {
  name: string;
  score: number;
  color: string;
  findings: string[];
}

export interface TimelineMilestone {
  timeframe: string;
  phase: string;
  description: string;
}

export interface Stakeholder {
  persona: string;
  quote: string;
}

export interface SimulationResult {
  sustainabilityScore: number;
  summary: string;
  dimensions: Dimension[];
  timeline: TimelineMilestone[];
  stakeholders: Stakeholder[];
}

export const mockResults: SimulationResult = {
  sustainabilityScore: 72,
  summary:
    "Strong environmental potential with moderate economic considerations.",
  dimensions: [
    {
      name: "Economic Impact",
      score: 65,
      color: "#2563EB",
      findings: [
        "Estimated \u20B12.3M annual savings in landfill costs",
        "12\u201315 new direct jobs created within the facility",
        "Moderate initial capital expenditure of ~\u20B118M required",
      ],
    },
    {
      name: "Environmental Impact",
      score: 82,
      color: "#16A34A",
      findings: [
        "Projected 30% reduction in barangay-level waste to landfill",
        "Decreased methane emissions equivalent to 450 tons CO\u2082/year",
        "Positive downstream effects on Marikina River watershed",
      ],
    },
    {
      name: "Social Impact",
      score: 68,
      color: "#D97706",
      findings: [
        "Community health improvement from reduced open waste burning",
        "Initial NIMBY resistance expected from nearby residential zones",
        "Potential model for barangay-level waste entrepreneurship",
      ],
    },
  ],
  timeline: [
    {
      timeframe: "1 Month",
      phase: "Setup",
      description:
        "Site assessment complete. Community consultations initiated. Initial resistance from 2 adjacent barangays.",
    },
    {
      timeframe: "6 Months",
      phase: "Operational",
      description:
        "MRF processing 12 tons/day at 60% capacity. 8 jobs filled. First revenue from recyclable sales.",
    },
    {
      timeframe: "1 Year",
      phase: "Scaling",
      description:
        "Full 20 ton/day capacity reached. Waste diversion rate at 28%. Adjacent barangays requesting replication.",
    },
  ],
  stakeholders: [
    {
      persona: "Community Supporter",
      quote:
        "This is exactly what Commonwealth needs. We\u2019ve been burning trash for years. My kids can finally play outside.",
    },
    {
      persona: "Concerned Resident",
      quote:
        "I support waste management but not next door. Truck traffic and smell worry me. Will there be a complaints mechanism?",
    },
    {
      persona: "Local Business Owner",
      quote:
        "If the MRF buys sorted recyclables, this could create a supply chain for my packaging business.",
    },
  ],
};
