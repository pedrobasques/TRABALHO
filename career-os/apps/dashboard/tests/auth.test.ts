import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthConfig, safeNext, signSession, verifySession } from '../src/lib/auth/session.ts';

const HASH = 'scrypt$16384$8$1$c2FsdHNhbHRzYWx0c2FsdA==$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g=';
const SECRET = 'x'.repeat(48);

test('auth config: off locally by default, password required on Vercel (fail closed)', () => {
  assert.deepEqual(resolveAuthConfig({}), { mode: 'off' });
  assert.equal(resolveAuthConfig({ VERCEL: '1' }).mode, 'misconfigured');
  assert.equal(resolveAuthConfig({ VERCEL: '1', CAREER_OS_AUTH_MODE: 'off' }).mode, 'misconfigured');
  assert.equal(resolveAuthConfig({ VERCEL: '1', CAREER_OS_PASSWORD_HASH: HASH, CAREER_OS_SESSION_SECRET: SECRET }).mode, 'password');
});

test('auth config: rejects weak secret, malformed hash, unknown mode', () => {
  assert.equal(resolveAuthConfig({ CAREER_OS_AUTH_MODE: 'password', CAREER_OS_PASSWORD_HASH: HASH, CAREER_OS_SESSION_SECRET: 'short' }).mode, 'misconfigured');
  assert.equal(resolveAuthConfig({ CAREER_OS_AUTH_MODE: 'password', CAREER_OS_PASSWORD_HASH: 'plaintext', CAREER_OS_SESSION_SECRET: SECRET }).mode, 'misconfigured');
  assert.equal(resolveAuthConfig({ CAREER_OS_AUTH_MODE: 'magic' }).mode, 'misconfigured');
  const ok = resolveAuthConfig({ CAREER_OS_AUTH_MODE: 'password', CAREER_OS_PASSWORD_HASH: HASH, CAREER_OS_SESSION_SECRET: SECRET, CAREER_OS_OWNER_ID: 'u1' });
  assert.equal(ok.mode === 'password' && ok.ownerId, 'u1');
});

test('session: valid token verifies; tampered, wrong-secret and expired tokens do not', async () => {
  const now = 1_800_000_000;
  const t = await signSession('owner', SECRET, now, 60);
  assert.equal((await verifySession(t, SECRET, now + 10))?.sub, 'owner');
  assert.equal(await verifySession(t, 'y'.repeat(48), now), null);
  assert.equal(await verifySession(t, SECRET, now + 61), null, 'expired');
  const [body, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 'attacker', iat: now, exp: now + 9999 })).toString('base64url');
  assert.equal(await verifySession(`${forged}.${sig}`, SECRET, now), null, 'payload swap');
  assert.equal(await verifySession(`${body}.${sig}x`, SECRET, now), null);
  for (const junk of ['', 'abc', 'a.b.c', '..', null, undefined]) assert.equal(await verifySession(junk, SECRET, now), null);
});

test('safeNext only allows same-site relative paths', () => {
  assert.equal(safeNext('/jobs?q=x'), '/jobs?q=x');
  for (const bad of ['//evil.example', '/\\evil', 'https://evil.example', '/api/pipeline', '', null, undefined]) assert.equal(safeNext(bad), '/dashboard');
});
