// src/lib/weather.ts
import { eq, gt, and } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { Env, WeatherContext } from './types';

const CACHE_TTL_SECONDS = 21_600; // 6 hours

type WeatherType = 'heat' | 'aqi' | 'flood';

function buildCacheKey(type: WeatherType, lat: number, lng: number): string {
  // 2 decimal places ≈ 1.1 km precision — nearby points share a cache entry
  return `weather:${type}:${lat.toFixed(2)}:${lng.toFixed(2)}`;
}

function expiresAt(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

// ── Open-Meteo fetchers ────────────────────────────────────────────────────

async function fetchFromOpenMeteo(
  type: WeatherType,
  lat: number,
  lng: number
): Promise<unknown> {
  const latStr = lat.toFixed(4);
  const lngStr = lng.toFixed(4);

  const urls: Record<WeatherType, string> = {
    heat: `https://api.open-meteo.com/v1/forecast?latitude=${latStr}&longitude=${lngStr}&current=temperature_2m,apparent_temperature,relative_humidity_2m`,
    aqi: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latStr}&longitude=${lngStr}&current=us_aqi,pm2_5,pm10`,
    flood: `https://flood-api.open-meteo.com/v1/flood?latitude=${latStr}&longitude=${lngStr}&daily=river_discharge_mean&forecast_days=1`,
  };

  const res = await fetch(urls[type]);
  if (!res.ok) throw new Error(`Open-Meteo ${type} returned ${res.status}`);
  return res.json();
}

// ── Cache lookup + store ───────────────────────────────────────────────────

export async function getCachedWeather(
  env: Env,
  lat: number,
  lng: number,
  type: WeatherType
): Promise<unknown> {
  const key = buildCacheKey(type, lat, lng);
  const db = getDb(env);

  // 1. KV (fastest, ~1ms) — best-effort, fall through if unavailable
  try {
    const kvHit = await env.CACHE.get(key);
    if (kvHit) return JSON.parse(kvHit);
  } catch {
    // KV unavailable — continue to D1
  }

  // 2. D1 (check if not expired)
  const now = new Date().toISOString();
  const row = await db
    .select()
    .from(schema.weatherCache)
    .where(
      and(
        eq(schema.weatherCache.cache_key, key),
        gt(schema.weatherCache.expires_at, now)
      )
    )
    .get();

  if (row) {
    const parsed = JSON.parse(row.data);
    // Repopulate KV from D1 — best-effort
    const ttlRemaining = Math.floor(
      (new Date(row.expires_at).getTime() - Date.now()) / 1000
    );
    if (ttlRemaining > 0) {
      try {
        await env.CACHE.put(key, row.data, { expirationTtl: ttlRemaining });
      } catch { /* ignore */ }
    }
    return parsed;
  }

  // 3. Fetch from Open-Meteo → store in D1 + KV
  const data = await fetchFromOpenMeteo(type, lat, lng);
  const dataStr = JSON.stringify(data);
  const expires = expiresAt(CACHE_TTL_SECONDS);

  await db
    .insert(schema.weatherCache)
    .values({
      cache_key: key,
      lat,
      lng,
      data_type: type,
      data: dataStr,
      expires_at: expires,
    })
    .onConflictDoUpdate({
      target: schema.weatherCache.cache_key,
      set: { data: dataStr, fetched_at: new Date().toISOString(), expires_at: expires },
    });

  try {
    await env.CACHE.put(key, dataStr, { expirationTtl: CACHE_TTL_SECONDS });
  } catch { /* ignore */ }

  return data;
}

// ── Single-point weather context for simulation prompt ──────────────────────

export async function getLocationWeatherContext(
  env: Env,
  lat: number,
  lng: number
): Promise<WeatherContext> {
  const [heatRaw, aqiRaw, floodRaw] = await Promise.allSettled([
    getCachedWeather(env, lat, lng, 'heat'),
    getCachedWeather(env, lat, lng, 'aqi'),
    getCachedWeather(env, lat, lng, 'flood'),
  ]);

  // Parse heat
  let temperature = 0;
  let apparentTemperature = 0;
  let humidity = 0;
  if (heatRaw.status === 'fulfilled') {
    const h = heatRaw.value as { current?: { temperature_2m?: number; apparent_temperature?: number; relative_humidity_2m?: number } };
    temperature = h.current?.temperature_2m ?? 0;
    apparentTemperature = h.current?.apparent_temperature ?? 0;
    humidity = h.current?.relative_humidity_2m ?? 0;
  }

  // Parse AQI
  let usAqi: number | null = null;
  if (aqiRaw.status === 'fulfilled') {
    const a = aqiRaw.value as { current?: { us_aqi?: number } };
    usAqi = a.current?.us_aqi ?? null;
  }

  // Parse flood / river discharge
  let riverDischarge: number | null = null;
  if (floodRaw.status === 'fulfilled') {
    const f = floodRaw.value as { daily?: { river_discharge_mean?: (number | null)[] } };
    riverDischarge = f.daily?.river_discharge_mean?.[0] ?? null;
  }

  // Philippine season: June–November is wet season (Habagat)
  const month = new Date().getMonth() + 1; // 1-indexed
  const isRainySeason = month >= 6 && month <= 11;
  const season = isRainySeason ? 'Wet Season (Habagat)' : 'Dry Season (Amihan)';

  const floodRisk =
    riverDischarge === null
      ? 'low'
      : riverDischarge > 20
      ? 'high'
      : riverDischarge > 5
      ? 'moderate'
      : 'low';

  return {
    temperature,
    apparentTemperature,
    humidity,
    usAqi,
    riverDischarge,
    season,
    isRainySeason,
    floodRisk,
  };
}
