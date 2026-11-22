import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { getDataDir, kvGetJson, kvSetJson } from './storage.ts';

const ADMIN_KV_KEY = 'huella:admin_credential';

function getAdminCredentialPath(): string {
  return path.join(getDataDir(), 'admin.json');
}

function resolveSessionSecret(): string {
  const explicit = (process.env.SESSION_SECRET || '').trim();
  if (explicit) return explicit;

  const secretMaterial = [
    process.env.ADMIN_PASSWORD || '',
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
    process.env.MS_CLIENT_SECRET || '',
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('|');

  if (secretMaterial) {
    const scope =
      process.env.VERCEL_PROJECT_ID ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      'huella-bienestar';
    return crypto
      .createHmac('sha256', `session-signing:${scope}`)
      .update(secretMaterial)
      .digest('hex');
  }

  return crypto.randomBytes(32).toString('hex');
}

const RUNTIME_SESSION_SECRET = resolveSessionSecret();

interface StoredAdminCredential {
  username: string;
  salt: string;
  hash: string;
  claimedAt: string;
}

export interface AuthStateInfo {
  initialized: boolean;
  envConfigured: boolean;
  usernameHint: string;
}

function getEnvAdminCredentials(): { username: string; password: string } | null {
  const password = (process.env.ADMIN_PASSWORD || '').trim();
  if (!password) return null;
  const username = (process.env.ADMIN_USERNAME || 'facilitadora').trim();
  return { username, password };
}

async function readClaimedAdmin(): Promise<StoredAdminCredential | null> {
  const fromKv = await kvGetJson<StoredAdminCredential>(ADMIN_KV_KEY);
  if (fromKv && fromKv.username && fromKv.salt && fromKv.hash) {
    return fromKv;
  }
  try {
    const raw = await fs.readFile(getAdminCredentialPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredAdminCredential>;
    if (parsed.username && parsed.salt && parsed.hash) {
      return parsed as StoredAdminCredential;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getAuthState(): Promise<AuthStateInfo> {
  const envCreds = getEnvAdminCredentials();
  if (envCreds) {
    return {
      initialized: true,
      envConfigured: true,
      usernameHint: envCreds.username,
    };
  }
  const claimed = await readClaimedAdmin();
  return {
    initialized: Boolean(claimed),
    envConfigured: false,
    usernameHint: claimed?.username || 'facilitadora',
  };
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function safeEqualText(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

let authSetupQueue: Promise<unknown> = Promise.resolve();

function withAuthLock<T>(task: () => Promise<T>): Promise<T> {
  const next = authSetupQueue.then(task, task);
  authSetupQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export async function claimFirstRunAdmin(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string; username?: string }> {
  return withAuthLock(async () => {
    const envCreds = getEnvAdminCredentials();
    if (envCreds) {
      return { ok: false, error: 'Las credenciales ya están configuradas en el servidor.' };
    }
    const existing = await readClaimedAdmin();
    if (existing) {
      return { ok: false, error: 'El acceso administrativo ya fue configurado previamente.' };
    }

    const cleanUser = username.trim();
    if (cleanUser.length < 3 || cleanUser.length > 40) {
      return { ok: false, error: 'El usuario debe tener entre 3 y 40 caracteres.' };
    }
    if (password.length < 6 || password.length > 100) {
      return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    await fs.mkdir(getDataDir(), { recursive: true });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    const payload: StoredAdminCredential = {
      username: cleanUser,
      salt,
      hash,
      claimedAt: new Date().toISOString(),
    };

    try {
      await kvSetJson(ADMIN_KV_KEY, payload);
      await fs.writeFile(getAdminCredentialPath(), JSON.stringify(payload, null, 2), 'utf8');
      return { ok: true, username: cleanUser };
    } catch {
      return { ok: false, error: 'No se pudo guardar el acceso administrativo.' };
    }
  });
}

export async function verifyAdminLogin(username: string, password: string): Promise<boolean> {
  const cleanUser = username.trim();
  const envCreds = getEnvAdminCredentials();
  if (envCreds) {
    return (
      safeEqualText(cleanUser.toLowerCase(), envCreds.username.toLowerCase()) &&
      safeEqualText(password, envCreds.password)
    );
  }

  const claimed = await readClaimedAdmin();
  if (!claimed) return false;

  if (!safeEqualText(cleanUser.toLowerCase(), claimed.username.toLowerCase())) {
    return false;
  }
  const computed = hashPassword(password, claimed.salt);
  return safeEqualText(computed, claimed.hash);
}

interface TokenPayload {
  sub: string;
  role: 'facilitadora';
  exp: number;
}

export function issueAdminToken(username: string): string {
  const payload: TokenPayload = {
    sub: username,
    role: 'facilitadora',
    exp: Date.now() + 12 * 60 * 60 * 1000, // 12 horas
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', RUNTIME_SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSignature] = parts;
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', RUNTIME_SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (!safeEqualText(providedSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as TokenPayload;
    if (payload.role !== 'facilitadora' || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Acceso privado requerido. Inicia sesión como facilitadora.' });
    return;
  }
  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión.' });
    return;
  }
  (req as Request & { adminUser?: string }).adminUser = payload.sub;
  next();
}
