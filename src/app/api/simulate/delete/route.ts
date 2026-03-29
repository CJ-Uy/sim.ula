// app/api/simulate/delete/route.ts
import { d1Query, r2Delete } from '@/lib/d1-rest';

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return Response.json({ error: '"id" query param is required' }, { status: 400 });
  }

  const errors: string[] = [];

  // Delete from D1
  try {
    await d1Query('DELETE FROM simulations WHERE id = ?', [id]);
  } catch (err) {
    console.error('[simulate/delete] D1 error:', err);
    errors.push('D1');
  }

  // Delete from R2
  try {
    await r2Delete(`simulations/${id}.json`);
  } catch (err) {
    console.error('[simulate/delete] R2 error:', err);
    errors.push('R2');
  }

  if (errors.length === 2) {
    return Response.json({ error: 'Failed to delete from both D1 and R2' }, { status: 500 });
  }

  return Response.json({ deleted: true, partial_errors: errors.length ? errors : undefined });
}
