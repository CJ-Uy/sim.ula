// src/lib/env.ts
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Env } from './types';

export async function getEnv(): Promise<Env> {
  const ctx = await getCloudflareContext({ async: true });
  return ctx.env as unknown as Env;
}
