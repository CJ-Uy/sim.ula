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
  // Widen step if viewport is large to stay under MAX_POINTS
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

// --- Fetch heat index grid ---

export async function fetchHeatGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<FeatureCollection<Point>> {
  const points = generateGrid(bounds, 0.01); // ~1km spacing for dense heatmap
  if (points.length === 0) return { type: "FeatureCollection", features: [] };

  const lats = points.map((p) => p.lat).join(",");
  const lngs = points.map((p) => p.lng).join(",");

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,apparent_temperature,relative_humidity_2m`
  );
  const data = (await res.json()) as
    | Array<{ current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number } }>
    | { current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number } };

  // Single point returns an object, multiple returns an array
  const results = Array.isArray(data) ? data : [data];

  return {
    type: "FeatureCollection",
    features: results.map((r, i) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [points[i].lng, points[i].lat] },
      properties: {
        apparentTemperature: r.current.apparent_temperature,
        temperature: r.current.temperature_2m,
        humidity: r.current.relative_humidity_2m,
      },
    })),
  };
}

// --- Fetch air quality grid ---

export async function fetchAqiGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<FeatureCollection<Point>> {
  const points = generateGrid(bounds, 0.015); // ~1.5km spacing for dense heatmap
  if (points.length === 0) return { type: "FeatureCollection", features: [] };

  const lats = points.map((p) => p.lat).join(",");
  const lngs = points.map((p) => p.lng).join(",");

  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=us_aqi,pm2_5,pm10`
  );
  const data = (await res.json()) as
    | Array<{ current: { us_aqi: number; pm2_5: number; pm10: number } }>
    | { current: { us_aqi: number; pm2_5: number; pm10: number } };

  const results = Array.isArray(data) ? data : [data];

  return {
    type: "FeatureCollection",
    features: results
      .map((r, i) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [points[i].lng, points[i].lat] },
        properties: {
          usAqi: r.current.us_aqi,
          pm25: r.current.pm2_5,
          pm10: r.current.pm10,
        },
      }))
      .filter((f) => f.properties.usAqi != null),
  };
}

// --- Fetch flood / river discharge grid ---

export async function fetchFloodGrid(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<FeatureCollection<Point>> {
  const points = generateGrid(bounds, 0.02); // ~2km spacing for dense heatmap
  if (points.length === 0) return { type: "FeatureCollection", features: [] };

  const lats = points.map((p) => p.lat).join(",");
  const lngs = points.map((p) => p.lng).join(",");

  const res = await fetch(
    `https://flood-api.open-meteo.com/v1/flood?latitude=${lats}&longitude=${lngs}&daily=river_discharge_mean&forecast_days=1`
  );
  const data = (await res.json()) as
    | Array<{ daily: { river_discharge_mean: Array<number | null> } }>
    | { daily: { river_discharge_mean: Array<number | null> } };

  const results = Array.isArray(data) ? data : [data];

  return {
    type: "FeatureCollection",
    features: results
      .map((r, i) => {
        const discharge = r.daily?.river_discharge_mean?.[0];
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [points[i].lng, points[i].lat] },
          properties: {
            riverDischarge: discharge ?? 0,
          },
        };
      })
      .filter((f) => f.properties.riverDischarge > 0),
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
