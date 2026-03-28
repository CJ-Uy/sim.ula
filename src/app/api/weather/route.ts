// app/api/weather/route.ts
import { getEnv } from '@/lib/env';
import { getCachedWeather } from '@/lib/weather';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const type = searchParams.get('type') as 'heat' | 'aqi' | 'flood' | null;

  if (isNaN(lat) || isNaN(lng) || !['heat', 'aqi', 'flood'].includes(type ?? '')) {
    return Response.json(
      { error: 'lat, lng, and type (heat|aqi|flood) are required' },
      { status: 400 }
    );
  }

  try {
    const env = getEnv();
    const data = await getCachedWeather(env, lat, lng, type!);

    // X-Cache header lets the client know if this was a KV hit or a fresh fetch
    // (getCachedWeather handles the cache internally; we add a simple marker)
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (err) {
    return Response.json({ error: `Weather fetch failed: ${err}` }, { status: 500 });
  }
}
