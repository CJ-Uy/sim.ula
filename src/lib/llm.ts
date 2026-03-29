// src/lib/llm.ts
import type { Env } from './types';

/**
 * Call Ollama LLM via Cloudflare tunnel (streaming).
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
    noFallback?: boolean;   // kept for backward compat, no longer used
  }
): Promise<string> {
  const model = options?.modelOverride ?? env.OLLAMA_MODEL;
  // Minimum 150s timeout — phi4 gets 3min, others use env or 150s floor
  const envTimeout = parseInt(env.OLLAMA_TIMEOUT_MS || '150000');
  const timeoutMs = model.includes('phi4')
    ? 180000
    : Math.max(envTimeout, 150000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${env.OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        system: systemPrompt,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_ctx: 16384,
        },
        ...(options?.format && { format: options.format }),
      }),
    });

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
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get text embedding via Ollama nomic-embed-text (768-dim).
 */
export async function getEmbedding(env: Env, text: string): Promise<number[]> {
  const timeoutMs = parseInt(env.OLLAMA_TIMEOUT_MS || '60000');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${env.OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model: env.EMBED_MODEL, prompt: text }),
    });

    if (!response.ok) throw new Error(`Ollama embeddings returned ${response.status}`);

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  } finally {
    clearTimeout(timeout);
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
