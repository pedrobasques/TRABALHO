#!/usr/bin/env node
/**
 * Read-only checks of a deployed (or local) Career OS URL. Sends no credentials.
 *
 *   node scripts/verify-deploy.mjs https://<your-project>.vercel.app
 *
 * Expected on a correctly protected Vercel deployment:
 *  - Vercel Authentication ON: anonymous requests get 401 / a redirect to vercel.com login
 *    → reported as "protected by Vercel" (the app itself is not reachable anonymously).
 *  - Vercel Authentication OFF: the app's own gate must answer:
 *      /api/health → {"ok":true,"auth":"password"}; /dashboard → 307 /login; /api/pipeline → 401.
 *  - Any 200 on /dashboard or /api/pipeline without a session = FAIL (publicly exposed).
 */
const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('uso: node scripts/verify-deploy.mjs <url>');
  process.exit(2);
}
const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });
const get = (p) => fetch(base + p, { redirect: 'manual' }).catch((e) => ({ status: 0, headers: new Headers(), text: async () => String(e) }));

const vercelGate = (r) => r.status === 401 || ([302, 303, 307].includes(r.status) && /vercel\.com|_vercel_sso|sso-api/.test(r.headers.get('location') ?? ''));

const health = await get('/api/health');
const dash = await get('/dashboard');
const api = await get('/api/pipeline');

if (vercelGate(dash) && vercelGate(api)) {
  check('Vercel Authentication', true, `anônimo recebe ${dash.status} — app inacessível sem login Vercel`);
} else {
  const body = health.status === 200 ? await health.json().catch(() => ({})) : {};
  check('/api/health responde', health.status === 200, `status ${health.status}`);
  check('login do app configurado', body.auth === 'password' && body.ok === true, JSON.stringify(body));
  check('/dashboard exige login', [302, 303, 307].includes(dash.status) && /\/login/.test(dash.headers.get('location') ?? ''), `status ${dash.status} → ${dash.headers.get('location')}`);
  check('/api/pipeline exige sessão', api.status === 401, `status ${api.status}`);
}
const anyHtml = await get('/dashboard');
check('sem exposição anônima', anyHtml.status !== 200, `GET /dashboard anônimo = ${anyHtml.status}`);
const h = dash.headers;
if (!vercelGate(dash)) {
  check('X-Frame-Options DENY', h.get('x-frame-options') === 'DENY', h.get('x-frame-options'));
  check('noindex', /noindex/.test(h.get('x-robots-tag') ?? ''), h.get('x-robots-tag'));
}
if (base.startsWith('https://')) check('HTTPS', true, 'ok');

let fail = 0;
for (const r of results) {
  if (!r.ok) fail++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.detail ?? ''}`);
}
console.log(fail ? `\n${fail} verificação(ões) falharam` : '\nOK: implantação protegida');
process.exit(fail ? 1 : 0);
