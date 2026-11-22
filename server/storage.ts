import path from 'node:path';

export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function getDataDir(): string {
  if (isVercelRuntime()) {
    return '/tmp/huella-bienestar-data';
  }
  return path.resolve(process.cwd(), 'data');
}

function getKvEnv(): { url: string; token: string } | null {
  const url = (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    ''
  ).trim();
  const token = (
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    ''
  ).trim();

  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

export function isKvConfigured(): boolean {
  return getKvEnv() !== null;
}

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const kv = getKvEnv();
  if (!kv) return null;

  try {
    const res = await fetch(kv.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kv.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['GET', key]),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string | null };
    if (!data.result) return null;
    return JSON.parse(data.result) as T;
  } catch {
    return null;
  }
}

export async function kvSetJson<T>(key: string, value: T): Promise<boolean> {
  const kv = getKvEnv();
  if (!kv) return false;

  try {
    const serialized = JSON.stringify(value);
    const res = await fetch(kv.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kv.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', key, serialized]),
    });
    return res.ok;
  } catch {
    return false;
  }
}
