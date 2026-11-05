/**
 * Session tokens and auth configuration. Uses only Web Crypto so it runs in
 * the Next.js proxy and in route handlers alike.
 *
 * Token: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, secret)).
 */

export const SESSION_COOKIE = 'cos_session';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

export type AuthConfig =
  | { mode: 'off' }
  | { mode: 'password'; secret: string; passwordHash: string; ownerId: string }
  | { mode: 'misconfigured'; reason: string };

type Env = Record<string, string | undefined>;

const SCRYPT_FORMAT = /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=_-]+\$[A-Za-z0-9+/=_-]+$/;

/**
 * Fail-closed resolution:
 *  - On Vercel (VERCEL=1) auth is mandatory; "off" is refused.
 *  - CAREER_OS_AUTH_MODE=password needs CAREER_OS_PASSWORD_HASH and a ≥32-char CAREER_OS_SESSION_SECRET.
 *  - Locally (loopback, no Vercel) the default is "off".
 */
export function resolveAuthConfig(env: Env): AuthConfig {
  const onVercel = env.VERCEL === '1';
  const requested = (env.CAREER_OS_AUTH_MODE ?? (onVercel ? 'password' : 'off')).toLowerCase();
  if (requested === 'off') {
    return onVercel ? { mode: 'misconfigured', reason: 'CAREER_OS_AUTH_MODE=off não é permitido em deployments na Vercel.' } : { mode: 'off' };
  }
  if (requested !== 'password') return { mode: 'misconfigured', reason: `CAREER_OS_AUTH_MODE desconhecido: "${requested}".` };
  const secret = env.CAREER_OS_SESSION_SECRET ?? '';
  const passwordHash = env.CAREER_OS_PASSWORD_HASH ?? '';
  if (secret.length < 32) return { mode: 'misconfigured', reason: 'CAREER_OS_SESSION_SECRET ausente ou com menos de 32 caracteres.' };
  if (!SCRYPT_FORMAT.test(passwordHash)) return { mode: 'misconfigured', reason: 'CAREER_OS_PASSWORD_HASH ausente ou fora do formato scrypt$N$r$p$salt$hash.' };
  return { mode: 'password', secret, passwordHash, ownerId: env.CAREER_OS_OWNER_ID || 'owner' };
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signSession(sub: string, secret: string, now = Math.floor(Date.now() / 1000), ttl = SESSION_TTL_SECONDS): Promise<string> {
  const payload: SessionPayload = { sub, iat: now, exp: now + ttl };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** Payload when the signature is valid and not expired; otherwise null. subtle.verify is constant-time. */
export async function verifySession(token: string | undefined | null, secret: string, now = Math.floor(Date.now() / 1000)): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(parts[1]), enc.encode(parts[0]));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[0]))) as SessionPayload;
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number' || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Only same-site relative redirect targets are allowed after login. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || next.startsWith('/api/')) return '/dashboard';
  return next;
}

/** Public origin of the request (honours the proxy headers Vercel sets), so redirects keep the cookie's host. */
export function requestOrigin(req: Request): string {
  const h = req.headers;
  const trustProxy = process.env.VERCEL === '1'; // only trust forwarded headers where the platform sets them
  const host = (trustProxy && h.get('x-forwarded-host')) || h.get('host') || new URL(req.url).host;
  const proto = ((trustProxy && h.get('x-forwarded-proto')) || new URL(req.url).protocol.replace(':', '')).split(',')[0]!.trim();
  return `${proto === 'https' ? 'https' : 'http'}://${host}`;
}
