// src/lib/d1-rest.ts
// Direct Cloudflare REST API clients — bypass broken local dev bindings

const ACCOUNT_ID = '8527ec1369d46f55304a6f59ab5356e4';
const DATABASE_ID = 'c401b2f1-a1d1-4b15-b714-e297ca7d5ddc';
const API_TOKEN = 'cfat_JJP1FBjbWrh3ubBX2YXAEHCCyvTO3fEJvDmG8y7E1599f1eb';
const R2_BUCKET = 'simula';
const R2_ACCESS_KEY_ID = '886421c149f1a7e4d0d4691a0e1f1b83';
const R2_SECRET_ACCESS_KEY = '3177876213a59a5ab9f2a6424a6211f2463ab445e034ad2ed653e6d45eda8f0a';

// ── D1 ──────────────────────────────────────────────────────────────────────

const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

interface D1RestResult<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
}

export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await fetch(D1_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 REST API ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json() as { result: D1RestResult<T>[] };
  return json.result?.[0]?.results ?? [];
}

// ── R2 (via S3-compatible API) ──────────────────────────────────────────────

/**
 * Put a JSON object to R2 using the S3-compatible API with AWS Signature V4.
 */
export async function r2Put(key: string, data: string): Promise<void> {
  const endpoint = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${R2_BUCKET}/${key}`;
  const now = new Date();

  // AWS Signature V4
  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8);
  const amzDate = dateStamp + 'T' + now.toISOString().replace(/[-:]/g, '').slice(9, 15) + 'Z';
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const encoder = new TextEncoder();

  async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
    const raw = key instanceof ArrayBuffer ? key : key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength);
    const cryptoKey = await crypto.subtle.importKey('raw', raw as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  }

  async function sha256(data: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const payloadHash = await sha256(data);

  const canonicalHeaders = [
    `content-type:application/json`,
    `host:${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    `/${R2_BUCKET}/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  // Derive signing key
  const kDate = await hmacSha256(encoder.encode('AWS4' + R2_SECRET_ACCESS_KEY), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');

  const signatureBuffer = await hmacSha256(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json',
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body: data,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 PUT ${res.status}: ${text.slice(0, 200)}`);
  }
}

/**
 * Get a JSON object from R2 using the S3-compatible API.
 */
export async function r2Get(key: string): Promise<string | null> {
  const endpoint = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${R2_BUCKET}/${key}`;
  const now = new Date();

  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8);
  const amzDate = dateStamp + 'T' + now.toISOString().replace(/[-:]/g, '').slice(9, 15) + 'Z';
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const encoder = new TextEncoder();

  async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
    const raw = key instanceof ArrayBuffer ? key : key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength);
    const cryptoKey = await crypto.subtle.importKey('raw', raw as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  }

  async function sha256(data: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const payloadHash = await sha256('');

  const canonicalHeaders = [
    `host:${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';

  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'GET',
    `/${R2_BUCKET}/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  const kDate = await hmacSha256(encoder.encode('AWS4' + R2_SECRET_ACCESS_KEY), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');

  const signatureBuffer = await hmacSha256(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 GET ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.text();
}

/**
 * Delete an object from R2 using the S3-compatible API.
 */
export async function r2Delete(key: string): Promise<void> {
  const endpoint = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${R2_BUCKET}/${key}`;
  const now = new Date();

  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8);
  const amzDate = dateStamp + 'T' + now.toISOString().replace(/[-:]/g, '').slice(9, 15) + 'Z';
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const encoder = new TextEncoder();

  async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
    const raw = key instanceof ArrayBuffer ? key : key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength);
    const cryptoKey = await crypto.subtle.importKey('raw', raw as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  }

  async function sha256(data: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const payloadHash = await sha256('');

  const canonicalHeaders = [
    `host:${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';

  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'DELETE',
    `/${R2_BUCKET}/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  const kDate = await hmacSha256(encoder.encode('AWS4' + R2_SECRET_ACCESS_KEY), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');

  const signatureBuffer = await hmacSha256(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`R2 DELETE ${res.status}: ${text.slice(0, 200)}`);
  }
}
