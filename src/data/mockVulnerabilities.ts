import type { FeatureCollection, Polygon, Point } from "geojson";

export interface FloodZoneProperties {
  name: string;
  riskLevel: "high" | "moderate" | "low";
}

export interface HeatZoneProperties {
  name: string;
  heatIndex: number; // °C
}

export interface AqiStationProperties {
  stationName: string;
  aqi: number;
  dominantPollutant: string;
}

export const floodZones: FeatureCollection<Polygon, FloodZoneProperties> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "Marikina River Floodplain",
        riskLevel: "high",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [121.095, 14.635],
            [121.105, 14.635],
            [121.11, 14.65],
            [121.108, 14.665],
            [121.098, 14.668],
            [121.09, 14.655],
            [121.092, 14.64],
            [121.095, 14.635],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Commonwealth Low-Lying Area",
        riskLevel: "moderate",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [121.075, 14.685],
            [121.085, 14.682],
            [121.09, 14.69],
            [121.088, 14.698],
            [121.078, 14.7],
            [121.073, 14.693],
            [121.075, 14.685],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "San Juan River Corridor",
        riskLevel: "moderate",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [121.035, 14.6],
            [121.045, 14.598],
            [121.048, 14.61],
            [121.043, 14.618],
            [121.033, 14.615],
            [121.032, 14.607],
            [121.035, 14.6],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Tullahan River Basin",
        riskLevel: "high",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [121.02, 14.66],
            [121.035, 14.655],
            [121.04, 14.665],
            [121.038, 14.678],
            [121.025, 14.68],
            [121.018, 14.67],
            [121.02, 14.66],
          ],
        ],
      },
    },
  ],
};

export const heatZones: FeatureCollection<Polygon, HeatZoneProperties> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "Cubao Commercial District",
        heatIndex: 42,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [121.05, 14.615],
            [121.065, 14.612],
            [121.07, 14.625],
            [121.062, 14.635],
            [121.048, 14.632],
            [121.046, 14.622],
            [121.05, 14.615],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Muñoz-EDSA Corridor",
        heatIndex: 39,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [121.02, 14.645],
            [121.035, 14.642],
            [121.038, 14.655],
            [121.03, 14.66],
            [121.018, 14.657],
            [121.017, 14.65],
            [121.02, 14.645],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Novaliches Urban Core",
        heatIndex: 40,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [121.04, 14.72],
            [121.055, 14.718],
            [121.058, 14.73],
            [121.05, 14.738],
            [121.038, 14.735],
            [121.037, 14.727],
            [121.04, 14.72],
          ],
        ],
      },
    },
  ],
};

export const aqiStations: FeatureCollection<Point, AqiStationProperties> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        stationName: "Quezon City Hall",
        aqi: 42,
        dominantPollutant: "PM2.5",
      },
      geometry: { type: "Point", coordinates: [121.0437, 14.676] },
    },
    {
      type: "Feature",
      properties: {
        stationName: "EDSA-Cubao",
        aqi: 78,
        dominantPollutant: "PM10",
      },
      geometry: { type: "Point", coordinates: [121.053, 14.623] },
    },
    {
      type: "Feature",
      properties: {
        stationName: "Commonwealth Ave",
        aqi: 55,
        dominantPollutant: "PM2.5",
      },
      geometry: { type: "Point", coordinates: [121.08, 14.692] },
    },
    {
      type: "Feature",
      properties: {
        stationName: "UP Diliman",
        aqi: 28,
        dominantPollutant: "O₃",
      },
      geometry: { type: "Point", coordinates: [121.066, 14.654] },
    },
    {
      type: "Feature",
      properties: {
        stationName: "Novaliches",
        aqi: 63,
        dominantPollutant: "PM2.5",
      },
      geometry: { type: "Point", coordinates: [121.045, 14.73] },
    },
  ],
};

export function getAqiColor(aqi: number): string {
  if (aqi <= 50) return "#16a34a";
  if (aqi <= 100) return "#f59e0b";
  if (aqi <= 150) return "#f97316";
  return "#ef4444";
}

export function getAqiLabel(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy (Sensitive)";
  return "Unhealthy";
}

export function getFloodColor(risk: string): string {
  if (risk === "high") return "#1d4ed8";
  if (risk === "moderate") return "#60a5fa";
  return "#bfdbfe";
}

export function getHeatColor(index: number): string {
  if (index >= 42) return "#dc2626";
  if (index >= 39) return "#f97316";
  return "#fbbf24";
}
