import type { FeatureCollection, Point } from "geojson";

// --- Types ---

export interface GridPoint {
  lat: number;
  lng: number;
  apparentTemperature: number;
  temperature: number;
  humidity: number;
}

export interface AqiPoint {
  lat: number;
  lng: number;
  usAqi: number;
  pm25: number;
  pm10: number;
}

export interface FloodPoint {
  lat: number;
  lng: number;
  riverDischarge: number;
}

// --- Grid fetch (one request per layer via /api/weather/grid) ---
// Grid generation and caching now happen server-side; the browser makes a
// single request per layer type instead of one request per grid point.

const EMPTY_FC: FeatureCollection<Point> = { type: "FeatureCollection", features: [] };

async function fetchGrid(
  bounds: { north: number; south: number; east: number; west: number },
  type: "heat" | "aqi" | "flood"
): Promise<FeatureCollection<Point>> {
  const { north, south, east, west } = bounds;
  try {
    const res = await fetch(
      `/api/weather/grid?north=${north}&south=${south}&east=${east}&west=${west}&type=${type}`
    );
    if (!res.ok) return EMPTY_FC;
    return res.json();
  } catch {
    return EMPTY_FC;
  }
}

export function fetchHeatGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<FeatureCollection<Point>> {
  return fetchGrid(bounds, "heat");
}

export function fetchAqiGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<FeatureCollection<Point>> {
  return fetchGrid(bounds, "aqi");
}

export function fetchFloodGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<FeatureCollection<Point>> {
  return fetchGrid(bounds, "flood");
}

// --- Color helpers ---

export function getHeatColor(temp: number): string {
  if (temp >= 42) return "#dc2626";
  if (temp >= 38) return "#ef4444";
  if (temp >= 35) return "#f97316";
  if (temp >= 32) return "#fbbf24";
  return "#a3e635";
}

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
