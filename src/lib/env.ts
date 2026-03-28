// src/lib/env.ts
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Env } from './types';

export function getEnv(): Env {
  const ctx = getCloudflareContext();
  return ctx.env as unknown as Env;
}
