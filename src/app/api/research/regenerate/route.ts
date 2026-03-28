// app/api/research/regenerate/route.ts
import { getEnv } from '@/lib/env';
import { synthesizeSingleField, verifyWithDeBERTa } from '@/lib/research';
import type { SearchResult, IngestFormRecord } from '@/lib/types';

export const runtime = 'edge';

export async function POST(request: Request) {
  const env = await getEnv();
  const body = (await request.json()) as {
    query?: string;
    sources?: SearchResult[];
    field?: keyof Omit<IngestFormRecord, 'model'>;
    source_text?: string;
  };

  if (!body.query || !body.sources?.length || !body.field) {
    return Response.json(
      { error: '"query", "sources", and "field" are required' },
      { status: 400 }
    );
  }

  try {
    const value = await synthesizeSingleField(env, body.field, body.sources);

    // Verify the regenerated value against sources (optional, graceful fallback)
    let verification = null;
    if (value && body.source_text && env.DEBERTA_URL) {
      verification = await verifyWithDeBERTa(env, body.source_text, value);
    }

    return Response.json({ field: body.field, value, verification });
  } catch (err) {
    return Response.json({ error: `Regeneration failed: ${err}` }, { status: 500 });
  }
}
