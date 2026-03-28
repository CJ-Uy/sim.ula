// app/api/health/route.ts
import { getEnv } from '@/lib/env';

export const runtime = 'edge';

export async function GET() {
  const env = getEnv();
  const checks: Record<string, string> = {};

  await Promise.all([
    // D1
    env.DB.prepare('SELECT COUNT(*) as count FROM nodes')
      .first()
      .then((r) => { checks.d1 = `ok (${r?.count ?? 0} nodes)`; })
      .catch((e) => { checks.d1 = `error: ${e}`; }),

    // Ollama
    fetch(`${env.OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) })
      .then((r) => { checks.ollama = r.ok ? 'ok' : `error: ${r.status}`; })
      .catch(() => { checks.ollama = 'unreachable (Workers AI fallback active)'; }),

    // SearXNG
    (env.SEARXNG_URL
      ? fetch(`${env.SEARXNG_URL}/healthz`, { signal: AbortSignal.timeout(5000) })
          .then((r) => { checks.searxng = r.ok ? 'ok' : `error: ${r.status}`; })
          .catch(() => { checks.searxng = 'unreachable (research auto-fill unavailable)'; })
      : Promise.resolve().then(() => { checks.searxng = 'not configured'; })),

    // DeBERTa
    (env.DEBERTA_URL
      ? fetch(`${env.DEBERTA_URL}/health`, { signal: AbortSignal.timeout(5000) })
          .then((r) => { checks.deberta = r.ok ? 'ok' : `error: ${r.status}`; })
          .catch(() => { checks.deberta = 'unreachable (verification disabled)'; })
      : Promise.resolve().then(() => { checks.deberta = 'not configured'; })),
  ]);

  checks.workers_ai = 'ok (bound)';
  checks.vectorize = 'ok (bound)';
  checks.r2 = 'ok (bound)';
  checks.kv = 'ok (bound)';

  const allOk = ['d1', 'ollama', 'workers_ai'].every((k) =>
    checks[k]?.startsWith('ok')
  );

  return Response.json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
}
