// app/api/scrape/route.ts
import { getEnv } from '@/lib/env';
import { runScrapeSession, requestScrapeStop } from '@/lib/scraper';
import type { ScrapeRequest, ScrapeEvent, Env } from '@/lib/types';

export async function POST(request: Request) {
  const env = await getEnv() as Env;

  let body: ScrapeRequest;
  try {
    body = (await request.json()) as ScrapeRequest;
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Handle stop action
  if (body.action === 'stop') {
    await requestScrapeStop(env);
    return Response.json({ status: 'stop_requested' });
  }

  // Start scraping — stream SSE events
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ScrapeEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await runScrapeSession(env, {
          rings: body.rings,
          resume: body.resume,
          city: body.city,
          topic: body.topic,
          limit: body.limit,
        }, send);
      } catch (err) {
        send({ type: 'job_error', error: String(err), message: `Session error: ${err}` });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
