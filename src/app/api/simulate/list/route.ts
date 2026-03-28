// app/api/simulate/list/route.ts
import { d1Query } from '@/lib/d1-rest';

export async function GET() {
  try {
    const rows = await d1Query<{
      id: string;
      input_policy: string;
      input_location: string | null;
      sustainability_score: number | null;
      created_at: string | null;
    }>(
      'SELECT id, input_policy, input_location, sustainability_score, created_at FROM simulations ORDER BY rowid DESC LIMIT 50'
    );

    return Response.json({ simulations: rows });
  } catch (err) {
    console.error('[simulate/list]', err);
    return Response.json({ simulations: [], error: String(err) });
  }
}
