#!/usr/bin/env node
/**
 * Prints {"<url>": "<description>"} for the Gupy entry of a career-ops data root's portals.yml,
 * using career-ops' own Gupy provider (public portal API; the description ships in the list payload).
 *   node scripts/lib/gupy-descriptions.mjs <careerOpsDataRoot>
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const CO = join(here, '..', '..', 'upstream', 'career-ops', 'providers');
const { default: gupy } = await import(join(CO, 'gupy.mjs'));
const { makeHttpCtx } = await import(join(CO, '_http.mjs'));
const portals = load(readFileSync(join(process.argv[2], 'portals.yml'), 'utf8'));
const entry = (portals.tracked_companies ?? []).find((e) => e.provider === 'gupy' && e.enabled !== false);
if (!entry) {
  console.log('{}');
  process.exit(0);
}
const jobs = await gupy.fetch(entry, makeHttpCtx());
const out = {};
for (const j of jobs ?? []) if (j?.url && j.description) out[j.url] = String(j.description).replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n');
console.log(JSON.stringify(out));
