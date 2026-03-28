// app/api/simulate/get/route.ts
import { r2Get } from '@/lib/d1-rest';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return Response.json({ error: '"id" query param is required' }, { status: 400 });
  }

  try {
    const data = await r2Get(`simulations/${id}.json`);
    if (!data) {
      return Response.json({ error: 'Simulation not found' }, { status: 404 });
    }

    return new Response(data, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[simulate/get]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
