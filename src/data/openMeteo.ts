import type { FeatureCollection, Point, Polygon, Feature } from "geojson";

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

// --- Grid response with cell step ---
interface GridResponse {
  type: "FeatureCollection";
  features: Feature<Point>[];
  cellStep?: number;
}

export interface GridData {
  points: FeatureCollection<Point>;
  cells: FeatureCollection<Polygon>;
}

// --- Grid fetch (one request per layer via /api/weather/grid) ---
// Grid generation and caching now happen server-side; the browser makes a
// single request per layer type instead of one request per grid point.

const EMPTY_FC_POINT: FeatureCollection<Point> = { type: "FeatureCollection", features: [] };
const EMPTY_FC_POLY: FeatureCollection<Polygon> = { type: "FeatureCollection", features: [] };
const EMPTY_GRID: GridData = { points: EMPTY_FC_POINT, cells: EMPTY_FC_POLY };

/** Convert point features into square polygon cells for seamless fill rendering */
function pointsToCells(
  points: Feature<Point>[],
  step: number
): FeatureCollection<Polygon> {
  const half = step / 2;
  const features: Feature<Polygon>[] = points.map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [lng - half, lat - half],
            [lng + half, lat - half],
            [lng + half, lat + half],
            [lng - half, lat + half],
            [lng - half, lat - half],
          ],
        ],
      },
      properties: f.properties,
    };
  });
  return { type: "FeatureCollection", features };
}

async function fetchGrid(
  bounds: { north: number; south: number; east: number; west: number },
  type: "heat" | "aqi" | "flood"
): Promise<GridData> {
  const { north, south, east, west } = bounds;
  try {
    const res = await fetch(
      `/api/weather/grid?north=${north}&south=${south}&east=${east}&west=${west}&type=${type}`
    );
    if (!res.ok) return EMPTY_GRID;
    const data: GridResponse = await res.json();
    const step = data.cellStep ?? 0.01;
    const pointsFc: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: data.features,
    };
    const cells = pointsToCells(data.features, step);
    return { points: pointsFc, cells };
  } catch {
    return EMPTY_GRID;
  }
}

export function fetchHeatGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<GridData> {
  return fetchGrid(bounds, "heat");
}

export function fetchAqiGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<GridData> {
  return fetchGrid(bounds, "aqi");
}

export function fetchFloodGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<GridData> {
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
