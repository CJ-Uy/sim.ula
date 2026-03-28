// app/api/research/route.ts
import { getEnv } from '@/lib/env';
import { runResearch } from '@/lib/research';

export const runtime = 'edge';

export async function POST(request: Request) {
  const env = getEnv();

  if (!env.SEARXNG_URL) {
    return Response.json(
      {
        error: 'Research service not available',
        detail:
          'SEARXNG_URL is not configured. This feature requires a running SearXNG instance. Set the URL in your .dev.vars (local) or Cloudflare Pages project settings (production).',
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as { query?: string; location?: string };

  if (!body.query?.trim()) {
    return Response.json({ error: '"query" field is required' }, { status: 400 });
  }

  try {
    const result = await runResearch(env, body.query.trim(), body.location?.trim());
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: `Research failed: ${err}` }, { status: 500 });
  }
}
