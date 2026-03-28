// src/lib/llm.ts
import type { Env } from './types';

/**
 * Call LLM with automatic fallback:
 * 1. Try Ollama (self-hosted via Cloudflare tunnel, primary)
 * 2. If Ollama fails/times out → fall back to Cloudflare Workers AI
 *
 * Pass modelOverride to use phi4:14b for high-quality batch ingestion.
 */
export async function callLLM(
  env: Env,
  prompt: string,
  systemPrompt: string,
  options?: {
    temperature?: number;
    format?: 'json';
    modelOverride?: string; // e.g. "phi4:14b" for high-quality ingestion
    noFallback?: boolean;   // skip Workers AI fallback (useful for debugging Ollama)
  }
): Promise<string> {
  const model = options?.modelOverride ?? env.OLLAMA_MODEL;
  // phi4:14b needs more time — use 3 min, other models use configured/default 60s
  const timeoutMs = model.includes('phi4')
    ? 180000
    : parseInt(env.OLLAMA_TIMEOUT_MS || '60000');

  let ollamaError: unknown;

  // Attempt 1: Ollama via Cloudflare tunnel
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${env.OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        system: systemPrompt,
        stream: true,
        options: { temperature: options?.temperature ?? 0.7 },
        ...(options?.format && { format: options.format }),
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    if (!response.body) throw new Error('Ollama returned empty body');

    // Reassemble streamed newline-delimited JSON chunks
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as { response: string; done: boolean };
        fullResponse += chunk.response;
        if (chunk.done) break;
      }
    }

    return fullResponse;
  } catch (err) {
    ollamaError = err;
    console.warn(`Ollama (${model}) failed, falling back to Workers AI:`, err);
  }

  // Attempt 2: Cloudflare Workers AI (fallback, always qwen3:8b equivalent)
  if (options?.noFallback) {
    throw new Error(`Ollama failed (fallback disabled): ${ollamaError}`);
  }

  try {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: 4096,
    })) as { response?: string };

    if (!result.response) throw new Error('Workers AI returned empty response');

    return result.response;
  } catch (aiError) {
    throw new Error(
      `Both LLM providers failed. Ollama: ${ollamaError}. Workers AI: ${aiError}`
    );
  }
}

/**
 * Get text embedding with automatic fallback:
 * 1. Try nomic-embed-text via Ollama (768-dim)
 * 2. Fall back to bge-base-en-v1.5 via Workers AI (768-dim)
 * Both are compatible with the same Vectorize index.
 */
export async function getEmbedding(env: Env, text: string): Promise<number[]> {
  const timeoutMs = parseInt(env.OLLAMA_TIMEOUT_MS || '60000');

  let ollamaError: unknown;

  // Attempt 1: Ollama nomic-embed-text
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${env.OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model: env.EMBED_MODEL, prompt: text }),
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`Ollama embeddings returned ${response.status}`);

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  } catch (err) {
    ollamaError = err;
    console.warn('Ollama embeddings failed, falling back to Workers AI:', err);
  }

  // Attempt 2: Cloudflare Workers AI bge-base-en-v1.5
  try {
    const result = (await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [text],
    })) as { data: number[][] };

    if (!result.data?.[0]) throw new Error('Workers AI embeddings returned empty');

    return result.data[0];
  } catch (aiError) {
    throw new Error(
      `Both embedding providers failed. Ollama: ${ollamaError}. Workers AI: ${aiError}`
    );
  }
}

/** Embed multiple texts sequentially (Ollama doesn't batch natively). */
export async function getEmbeddings(env: Env, texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await getEmbedding(env, text));
  }
  return results;
}
