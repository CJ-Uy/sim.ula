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

// --- Grid generation ---

const MAX_POINTS = 300;

function generateGrid(
  bounds: { north: number; south: number; east: number; west: number },
  step: number
): Array<{ lat: number; lng: number }> {
  const latRange = bounds.north - bounds.south;
  const lngRange = bounds.east - bounds.west;
  const estCount = (latRange / step) * (lngRange / step);
  const effectiveStep = estCount > MAX_POINTS
    ? step * Math.sqrt(estCount / MAX_POINTS)
    : step;

  const points: Array<{ lat: number; lng: number }> = [];
  for (let lat = bounds.south; lat <= bounds.north; lat += effectiveStep) {
    for (let lng = bounds.west; lng <= bounds.east; lng += effectiveStep) {
      points.push({ lat: parseFloat(lat.toFixed(4)), lng: parseFloat(lng.toFixed(4)) });
    }
  }
  return points;
}

// --- Internal weather API (routes through /api/weather for caching) ---
// Each grid point is fetched via our own edge worker, which caches results
// in KV + D1. First load per coordinate calls Open-Meteo; every subsequent
// viewer (same coordinates) gets a KV hit in ~1ms instead.

async function fetchWeatherPoint(
  lat: number,
  lng: number,
  type: "heat" | "aqi" | "flood"
): Promise<unknown> {
  try {
    const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}&type=${type}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// --- Fetch heat index grid ---

export async function fetchHeatGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<FeatureCollection<Point>> {
  const points = generateGrid(bounds, 0.01);
  if (points.length === 0) return { type: "FeatureCollection", features: [] };

  const results = await Promise.all(
    points.map((p) => fetchWeatherPoint(p.lat, p.lng, "heat"))
  );

  return {
    type: "FeatureCollection",
    features: results
      .map((r, i) => {
        const data = r as {
          current?: {
            temperature_2m?: number;
            apparent_temperature?: number;
            relative_humidity_2m?: number;
          };
        } | null;
        if (!data?.current) return null;
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [points[i].lng, points[i].lat] },
          properties: {
            apparentTemperature: data.current.apparent_temperature ?? 0,
            temperature: data.current.temperature_2m ?? 0,
            humidity: data.current.relative_humidity_2m ?? 0,
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null),
  };
}

// --- Fetch air quality grid ---

export async function fetchAqiGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<FeatureCollection<Point>> {
  const points = generateGrid(bounds, 0.015);
  if (points.length === 0) return { type: "FeatureCollection", features: [] };

  const results = await Promise.all(
    points.map((p) => fetchWeatherPoint(p.lat, p.lng, "aqi"))
  );

  return {
    type: "FeatureCollection",
    features: results
      .map((r, i) => {
        const data = r as {
          current?: { us_aqi?: number; pm2_5?: number; pm10?: number };
        } | null;
        if (!data?.current || data.current.us_aqi == null) return null;
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [points[i].lng, points[i].lat] },
          properties: {
            usAqi: data.current.us_aqi,
            pm25: data.current.pm2_5 ?? 0,
            pm10: data.current.pm10 ?? 0,
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null),
  };
}

// --- Fetch flood / river discharge grid ---

export async function fetchFloodGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<FeatureCollection<Point>> {
  const points = generateGrid(bounds, 0.02);
  if (points.length === 0) return { type: "FeatureCollection", features: [] };

  const results = await Promise.all(
    points.map((p) => fetchWeatherPoint(p.lat, p.lng, "flood"))
  );

  return {
    type: "FeatureCollection",
    features: results
      .map((r, i) => {
        const data = r as {
          daily?: { river_discharge_mean?: (number | null)[] };
        } | null;
        const discharge = data?.daily?.river_discharge_mean?.[0];
        if (!discharge || discharge <= 0) return null;
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [points[i].lng, points[i].lat] },
          properties: { riverDischarge: discharge },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null),
  };
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
