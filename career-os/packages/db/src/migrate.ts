/**
 * Minimal versioned migration runner for local/CI Postgres. In Supabase, prefer
 * `supabase db push` with the same files (supabase/migrations). Applied files are
 * tracked with their SHA-256 so an edited, already-applied migration is detected.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export async function runMigrations(client: pg.Pool | pg.PoolClient | pg.Client, dir: string): Promise<MigrationResult> {
  await client.query(`create table if not exists public.career_os_migrations (name text primary key, sha256 text not null, applied_at timestamptz not null default now())`);
  const files = readdirSync(dir).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
  const done = new Map((await client.query<{ name: string; sha256: string }>(`select name, sha256 from public.career_os_migrations`)).rows.map((r) => [r.name, r.sha256]));
  const out: MigrationResult = { applied: [], skipped: [] };
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    const sha = createHash('sha256').update(sql).digest('hex');
    const prev = done.get(f);
    if (prev) {
      if (prev !== sha) throw new Error(`migration ${f} was modified after being applied (sha mismatch) — create a new migration instead`);
      out.skipped.push(f);
      continue;
    }
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(`insert into public.career_os_migrations (name, sha256) values ($1, $2)`, [f, sha]);
      await client.query('commit');
      out.applied.push(f);
    } catch (e) {
      await client.query('rollback');
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
  return out;
}
