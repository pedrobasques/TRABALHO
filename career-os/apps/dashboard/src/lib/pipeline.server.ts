import 'server-only';
import { join as pathJoin } from 'node:path';
import { PipelineError, type Application, type Dataset, type PipelineStore } from '@career-os/core';
import { FilePipelineStore } from '@career-os/core/server';
import { privateDir } from '@/lib/data.server';

export interface StoreStatus {
  kind: 'file' | 'postgres' | 'none';
  persistent: boolean;
  /** Human-readable, never contains credentials. */
  detail: string;
}

let cached: { key: string; store: PipelineStore | null; status: StoreStatus } | null = null;

/**
 * Store selection (CAREER_OS_STORE = auto | file | postgres | none):
 *  - postgres: DATABASE_URL + CAREER_OS_OWNER_ID (Supabase auth user UUID) → RLS-enforced Supabase store.
 *  - file: durable JSON under CAREER_OS_PRIVATE_DIR (local / VPS only; refused on Vercel's ephemeral FS).
 *  - auto: postgres if configured, else file when not on Vercel, else none.
 */
export async function getPipelineStore(origin: Dataset['origin']): Promise<{ store: PipelineStore | null; status: StoreStatus }> {
  const env = process.env;
  const key = [env.CAREER_OS_STORE, env.DATABASE_URL ? 'db' : '', env.CAREER_OS_OWNER_ID, env.CAREER_OS_PRIVATE_DIR, origin].join('|');
  if (cached?.key === key) return cached;
  const want = (env.CAREER_OS_STORE ?? 'auto').toLowerCase();
  const onVercel = env.VERCEL === '1';
  let store: PipelineStore | null = null;
  let status: StoreStatus;

  const pgConfigured = Boolean(env.DATABASE_URL && env.CAREER_OS_OWNER_ID);
  if (want === 'postgres' || (want === 'auto' && pgConfigured)) {
    if (!pgConfigured) {
      status = { kind: 'none', persistent: false, detail: 'CAREER_OS_STORE=postgres, mas DATABASE_URL ou CAREER_OS_OWNER_ID não estão definidos.' };
    } else {
      // Loaded lazily so deployments without a database never import the driver.
      const dbmod = await import('@career-os/db');
      if (!dbmod.isUuid(env.CAREER_OS_OWNER_ID!)) {
        status = { kind: 'none', persistent: false, detail: 'CAREER_OS_OWNER_ID precisa ser o UUID do usuário no Supabase Auth.' };
      } else {
        store = new dbmod.PostgresPipelineStore(dbmod.createDb({ connectionString: env.DATABASE_URL! }), env.CAREER_OS_OWNER_ID!);
        status = { kind: 'postgres', persistent: true, detail: 'Supabase/Postgres com Row Level Security.' };
      }
    }
  } else if (want === 'file' || (want === 'auto' && !onVercel)) {
    if (onVercel) {
      status = { kind: 'none', persistent: false, detail: 'Armazenamento em arquivo não é persistente na Vercel. Configure DATABASE_URL.' };
    } else {
      const path = pathJoin(/* turbopackIgnore: true */ privateDir(), `pipeline.${origin}.json`);
      store = new FilePipelineStore(path);
      status = { kind: 'file', persistent: true, detail: `Arquivo local career-os/private/pipeline.${origin}.json (fora do Git).` };
    }
  } else {
    status = { kind: 'none', persistent: false, detail: onVercel ? 'Sem banco configurado nesta implantação.' : 'Persistência desativada (CAREER_OS_STORE=none).' };
  }
  cached = { key, store, status };
  return cached;
}

export function httpStatusFor(e: unknown): number {
  if (e instanceof PipelineError) {
    return { not_found: 404, invalid_stage: 400, invalid_input: 400, conflict: 409, unavailable: 503 }[e.code];
  }
  return 500;
}

export function errorBody(e: unknown) {
  if (e instanceof PipelineError) return { error: e.message, code: e.code };
  return { error: 'Erro interno ao acessar o pipeline.', code: 'internal' };
}

/** History of an application that already exists in the data source, used when adopting it into the store. */
export function seedFrom(base: Application | undefined) {
  return base?.history.map((h) => ({ stage: h.stage, at: h.at, ...(h.note ? { note: h.note } : {}) }));
}
