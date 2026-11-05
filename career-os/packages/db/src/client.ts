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
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID.test(v);
}

export function createDb({ connectionString, max = 3 }: DbOptions): Db {
  if (!connectionString) throw new Error('DATABASE_URL is required for the Postgres store');
  return new pg.Pool({ connectionString, max, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 });
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
