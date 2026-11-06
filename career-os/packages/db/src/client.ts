/**
 * Postgres access for Career OS (Supabase in production, plain Postgres in tests).
 *
 * Every user-scoped operation runs inside `withUser`: a transaction that switches to
 * the `authenticated` role and sets the JWT claims Supabase's auth.uid() reads, so the
 * Row Level Security policies in supabase/migrations are enforced on the server path
 * too — a bug in a query cannot leak or modify another owner's rows.
 */
import pg from 'pg';

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

export interface DbOptions {
  connectionString: string;
  /** Max pooled connections per server instance (serverless: keep small). */
  max?: number;
  /** PEM of the CA that signs the server certificate. Defaults to env SUPABASE_CA_CERT. */
  caCert?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID.test(v);
}

/** URL parameters through which node-postgres builds its own `ssl` object, discarding ours. */
const SSL_URL_PARAMS = ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'];
const PEM_CERT = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;

/**
 * TLS settings for the pool. Errors never echo the connection string or the certificate.
 *
 * With a CA (Supabase: Database Settings → SSL Configuration → Download certificate) the
 * connection always uses TLS with full verification (chain against that CA + hostname).
 * node-postgres replaces the `ssl` option whenever the URL carries `sslmode` & co., so those
 * parameters are removed from the URL and the TLS policy is expressed only here.
 * A Supabase host without a CA is refused with an actionable message instead of failing
 * later with SELF_SIGNED_CERT_IN_CHAIN.
 */
export function resolveTls(connectionString: string, caCert?: string): { connectionString: string; ssl?: pg.PoolConfig['ssl'] } {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid postgres:// URL');
  }
  const ca = caCert?.trim() ? caCert.replace(/\\n/g, '\n').trim() : '';
  if (!ca) {
    if (/\.supabase\.(com|co)$/i.test(url.hostname))
      throw new Error('SUPABASE_CA_CERT is required to verify TLS to Supabase (Database Settings → SSL Configuration → Download certificate)');
    return { connectionString };
  }
  if (!PEM_CERT.test(ca)) throw new Error('SUPABASE_CA_CERT must be a PEM certificate (-----BEGIN CERTIFICATE----- …)');
  if (url.searchParams.get('sslmode')?.toLowerCase() === 'disable')
    throw new Error('DATABASE_URL has sslmode=disable but a CA certificate is configured; remove sslmode=disable');
  for (const p of SSL_URL_PARAMS) url.searchParams.delete(p);
  return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}

export function createDb({ connectionString, max = 3, caCert = process.env.SUPABASE_CA_CERT }: DbOptions): Db {
  if (!connectionString) throw new Error('DATABASE_URL is required for the Postgres store');
  const tls = resolveTls(connectionString, caCert);
  return new pg.Pool({ ...tls, max, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 });
}

/** Run `fn` as `userId` under RLS. Rolls back on any error. */
export async function withUser<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!isUuid(userId)) throw new Error('owner id must be a UUID (Supabase auth.users.id)');
  const tx = await db.connect();
  try {
    await tx.query('begin');
    await tx.query('set local role authenticated');
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })]);
    const out = await fn(tx);
    await tx.query('commit');
    return out;
  } catch (e) {
    await tx.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    tx.release();
  }
}

/** Transaction-local settings read by the history trigger. */
export async function setEventContext(tx: Tx, ctx: { note?: string | null; actor?: string; at?: string | null }): Promise<void> {
  await tx.query(
    `select set_config('career_os.event_note', $1, true), set_config('career_os.actor', $2, true), set_config('career_os.event_at', $3, true)`,
    [ctx.note ?? '', ctx.actor ?? 'dashboard', ctx.at ?? ''],
  );
}
