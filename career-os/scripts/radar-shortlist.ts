#!/usr/bin/env node
/**
 * Shortlist from the database using the existing deterministic matching engine.
 *   npm run radar:shortlist -- [--top 10]      (DATABASE_URL + CAREER_OS_OWNER_ID)
 * Writes private/radar/shortlist.md and prints a compact table.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_LABEL, CONFIDENCE_LABEL, ELIGIBILITY_LABEL, RECOMMENDATION_LABEL, countryName, matchAll, triageJob } from '@career-os/core';
import { createDb, loadJobs, loadProfileSnapshot } from '@career-os/db';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const top = Number(args[args.indexOf('--top') + 1] || 10) || 10;
const { DATABASE_URL, CAREER_OS_OWNER_ID } = process.env;
if (!DATABASE_URL || !CAREER_OS_OWNER_ID) throw new Error('DATABASE_URL e CAREER_OS_OWNER_ID são obrigatórios');
const db = createDb({ connectionString: DATABASE_URL });
const [jobs, profile] = await Promise.all([loadJobs(db, CAREER_OS_OWNER_ID), loadProfileSnapshot(db, CAREER_OS_OWNER_ID)]);
await db.end();
if (!profile) throw new Error('sem snapshot de perfil no banco (rode radar-ingest --db com profile-extension.yml ou cv.md)');

const m = matchAll(jobs, profile);
const RANK = { prioritize: 0, apply: 1, verify_eligibility: 2, consider: 3, low_priority: 4, insufficient_data: 5, do_not_apply: 6, job_closed: 7 } as const;
const open = jobs.filter((j) => j.status !== 'closed' && triageJob(j).tier);
const evaluable = open.filter((j) => m.get(j.id)!.insufficientReason !== 'posting');
// recommendation first; then jobs whose technical fit is verifiable; then technical score; then overall
const tech = (id: string) => m.get(id)!.technicalScore ?? -1;
const ranked = [...evaluable]
  .sort((a, b) => RANK[m.get(a.id)!.recommendation] - RANK[m.get(b.id)!.recommendation] || tech(b.id) - tech(a.id) || m.get(b.id)!.overallScore - m.get(a.id)!.overallScore)
  .slice(0, top);

const lines = [`# Radar — shortlist (${new Date().toISOString().slice(0, 10)})`, '', `Base: ${jobs.length} vagas no banco · ${open.length} abertas no perfil · ${evaluable.length} com dados suficientes · ${open.length - evaluable.length} "Dados insuficientes para avaliação".`, `Perfil: ${profile.importReport?.sources.join(', ') || '—'} (declarado; CV não validado).`, ''];
ranked.forEach((j, i) => {
  const r = m.get(j.id)!;
  const met = r.matchedRequirements.map((x) => x.requirement.text);
  const miss = r.missingRequirements.map((x) => `${x.requirement.text} (${x.requirement.kind === 'must' ? 'obrig.' : 'desej.'})`);
  const unk = r.unknownRequirements.map((x) => x.requirement.text);
  lines.push(`## ${i + 1}. ${j.title} — ${j.company}`, `- País: ${countryName(j.country)}${j.city ? ` (${j.city})` : ''} · Link: ${j.source.url}`, `- Score: ${r.insufficientData ? 'n/d (dados insuficientes: ' + r.insufficientReason + ')' : r.overallScore + '/100'} · técnico ${r.technicalScore ?? 'n/d'} · confiança ${CONFIDENCE_LABEL[r.confidence]} · ${CATEGORY_LABEL[r.category]} · elegibilidade: ${ELIGIBILITY_LABEL[r.eligibilityStatus]}`, `- Aderência: ${met.join('; ') || '—'}`, `- Lacunas: ${miss.join('; ') || '—'}`, `- Pendentes (a confirmar): ${unk.join('; ') || '—'}`, `- Recomendação: ${RECOMMENDATION_LABEL[r.recommendation]} — ${triageJob(j).reason}`, '');
});
mkdirSync(join(process.env.CAREER_OS_PRIVATE_DIR ?? join(ROOT, 'private'), 'radar'), { recursive: true });
writeFileSync(join(process.env.CAREER_OS_PRIVATE_DIR ?? join(ROOT, 'private'), 'radar', 'shortlist.md'), lines.join('\n'), { mode: 0o600 });
console.log(lines.slice(0, 4).join('\n'));
for (const [i, j] of ranked.entries()) {
  const r = m.get(j.id)!;
  console.log(`${i + 1}\t${r.insufficientData ? 'n/d' : r.overallScore}\t${r.technicalScore ?? 'n/d'}\t${r.confidence}\t${r.eligibilityStatus}\t${j.country}\t${j.company}\t${j.title}\t${j.source.url}`);
}
