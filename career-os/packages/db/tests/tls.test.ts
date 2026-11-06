/**
 * TLS policy of createDb (SUPABASE_CA_CERT). Unit part needs no database.
 * The integration part runs against an SSL-only Postgres whose certificate chains to a private
 * root CA (the Supabase situation): set TEST_TLS_DATABASE_URL (host must match the server cert,
 * with ?sslmode=require like the Supabase pooler URL), TEST_TLS_CA_FILE (that root) and
 * TEST_TLS_OTHER_CA_FILE (an unrelated CA). Skipped (not faked) otherwise.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDb, resolveTls } from '../src/index.ts';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----';
const SECRET = 's3cr3t-pw';
const POOLER = `postgresql://postgres.ref:${SECRET}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require`;

describe('resolveTls', () => {
  test('with a CA: removes sslmode so node-postgres keeps our ssl object; verification on', () => {
    const r = resolveTls(POOLER, PEM);
    assert.deepEqual(r.ssl, { ca: PEM, rejectUnauthorized: true });
    const u = new URL(r.connectionString);
    assert.equal(u.searchParams.has('sslmode'), false);
    assert.equal(u.hostname, 'aws-0-sa-east-1.pooler.supabase.com');
    assert.equal(u.port, '6543');
    assert.equal(u.password, SECRET);
  });

  test('strips every URL TLS parameter and keeps the others', () => {
    const r = resolveTls('postgres://u@h/db?sslmode=verify-full&sslrootcert=/x.crt&ssl=true&uselibpqcompat=true&application_name=cos', PEM);
    const u = new URL(r.connectionString);
    for (const p of ['sslmode', 'sslrootcert', 'ssl', 'uselibpqcompat']) assert.equal(u.searchParams.has(p), false, p);
    assert.equal(u.searchParams.get('application_name'), 'cos');
  });

  test('accepts PEM with escaped \\n (single-line env value) and bundles', () => {
    const r = resolveTls(POOLER, `${PEM}\n${PEM}`.replace(/\n/g, '\\n'));
    assert.equal((r.ssl as { ca: string }).ca, `${PEM}\n${PEM}`);
  });

  test('Supabase host without CA is refused with an actionable message (no secret in it)', () => {
    for (const ca of [undefined, '', '  ']) {
      assert.throws(() => resolveTls(POOLER, ca), (e: Error) => /SUPABASE_CA_CERT is required/.test(e.message) && !e.message.includes(SECRET));
    }
    assert.throws(() => resolveTls('postgres://u:p@db.abc.supabase.co:5432/postgres', undefined), /SUPABASE_CA_CERT/);
  });

  test('non-PEM CA, sslmode=disable and invalid URLs are refused without echoing inputs', () => {
    assert.throws(() => resolveTls(POOLER, 'not-a-cert'), (e: Error) => /PEM/.test(e.message) && !e.message.includes('not-a-cert'));
    assert.throws(() => resolveTls(`postgres://u:${SECRET}@h/db?sslmode=disable`, PEM), (e: Error) => /sslmode=disable/.test(e.message) && !e.message.includes(SECRET));
    assert.throws(() => resolveTls(`not a url ${SECRET}`, PEM), (e: Error) => !e.message.includes(SECRET));
  });

  test('non-Supabase URL without CA is passed through unchanged (local tests)', () => {
    const local = 'postgres://postgres@localhost:54329/postgres?host=/tmp';
    assert.deepEqual(resolveTls(local, undefined), { connectionString: local });
  });
});

const TLS_URL = process.env.TEST_TLS_DATABASE_URL;
const CA_FILE = process.env.TEST_TLS_CA_FILE;
const OTHER_FILE = process.env.TEST_TLS_OTHER_CA_FILE;

if (!TLS_URL || !CA_FILE || !OTHER_FILE) {
  test('TLS integration (skipped: TEST_TLS_DATABASE_URL / TEST_TLS_CA_FILE / TEST_TLS_OTHER_CA_FILE not set)', { skip: true }, () => {});
} else {
  const ca = readFileSync(CA_FILE, 'utf8');
  const other = readFileSync(OTHER_FILE, 'utf8');
  const sslInUse = async (url: string, caCert?: string) => {
    const db = createDb({ connectionString: url, caCert, max: 1 });
    try {
      const r = await db.query<{ ssl: boolean }>('select ssl from pg_stat_ssl where pid = pg_backend_pid()');
      return r.rows[0]?.ssl;
    } finally {
      await db.end();
    }
  };
  const code = async (url: string, caCert?: string) => {
    try {
      await sslInUse(url, caCert);
      return 'connected';
    } catch (e) {
      return (e as { code?: string }).code ?? (e as Error).message;
    }
  };

  describe('TLS against a server signed by a private root CA', () => {
    test('reproduces the bug: sslmode=require without the CA → SELF_SIGNED_CERT_IN_CHAIN', async () => {
      assert.equal(await code(TLS_URL, ''), 'SELF_SIGNED_CERT_IN_CHAIN');
    });
    test('fix: same URL + the CA → verified TLS session', async () => {
      assert.equal(await sslInUse(TLS_URL, ca), true);
    });
    test('an unrelated CA is rejected', async () => {
      assert.notEqual(await code(TLS_URL, other), 'connected');
    });
    test('hostname is verified: right CA, host not in the certificate → rejected', async () => {
      const u = new URL(TLS_URL);
      u.hostname = '127.0.0.1';
      assert.equal(await code(u.toString(), ca), 'ERR_TLS_CERT_ALTNAME_INVALID');
    });
  });
}
