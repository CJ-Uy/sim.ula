// app/api/weather/grid/route.ts
// Returns a GeoJSON FeatureCollection for all grid points within the given
// bounding box.  Doing this server-side reduces browser → worker round-trips
// from ~300 per layer to 1 per layer.

import { getEnv } from '@/lib/env';
import { getCachedWeather } from '@/lib/weather';
import type { FeatureCollection, Point } from 'geojson';

const MAX_POINTS = 300;

function generateGrid(
  north: number,
  south: number,
  east: number,
  west: number,
  step: number
): Array<{ lat: number; lng: number }> {
  const latRange = north - south;
  const lngRange = east - west;
  const estCount = (latRange / step) * (lngRange / step);
  const effectiveStep =
    estCount > MAX_POINTS ? step * Math.sqrt(estCount / MAX_POINTS) : step;

  const points: Array<{ lat: number; lng: number }> = [];
  for (let lat = south; lat <= north; lat += effectiveStep) {
    for (let lng = west; lng <= east; lng += effectiveStep) {
      points.push({
        lat: parseFloat(lat.toFixed(4)),
        lng: parseFloat(lng.toFixed(4)),
      });
    }
  }
  return points;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const north = parseFloat(searchParams.get('north') ?? '');
  const south = parseFloat(searchParams.get('south') ?? '');
  const east = parseFloat(searchParams.get('east') ?? '');
  const west = parseFloat(searchParams.get('west') ?? '');
  const type = searchParams.get('type') as 'heat' | 'aqi' | 'flood' | null;

  if (
    [north, south, east, west].some(isNaN) ||
    !['heat', 'aqi', 'flood'].includes(type ?? '')
  ) {
    return Response.json(
      { error: 'north, south, east, west, and type (heat|aqi|flood) are required' },
      { status: 400 }
    );
  }

  const env = await getEnv();
  const step = type === 'heat' ? 0.01 : type === 'aqi' ? 0.015 : 0.02;
  const points = generateGrid(north, south, east, west, step);

  const results = await Promise.all(
    points.map((p) => getCachedWeather(env, p.lat, p.lng, type!).catch(() => null))
  );

  const features: FeatureCollection<Point>['features'] = [];

  results.forEach((r, i) => {
    if (!r) return;
    const p = points[i];

    if (type === 'heat') {
      const data = r as {
        current?: {
          temperature_2m?: number;
          apparent_temperature?: number;
          relative_humidity_2m?: number;
        };
      };
      if (!data.current) return;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          apparentTemperature: data.current.apparent_temperature ?? 0,
          temperature: data.current.temperature_2m ?? 0,
          humidity: data.current.relative_humidity_2m ?? 0,
        },
      });
    } else if (type === 'aqi') {
      const data = r as {
        current?: { us_aqi?: number; pm2_5?: number; pm10?: number };
      };
      if (!data.current || data.current.us_aqi == null) return;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          usAqi: data.current.us_aqi,
          pm25: data.current.pm2_5 ?? 0,
          pm10: data.current.pm10 ?? 0,
        },
      });
    } else {
      const data = r as {
        daily?: { river_discharge_mean?: (number | null)[] };
      };
      const discharge = data.daily?.river_discharge_mean?.[0];
      if (!discharge || discharge <= 0) return;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { riverDischarge: discharge },
      });
    }
  });

  return Response.json(
    { type: 'FeatureCollection', features } satisfies FeatureCollection<Point>,
    { headers: { 'Cache-Control': 'public, max-age=3600' } }
  );
}
