import type { Dataset } from '../domain/types.ts';
import type { MatchResult } from '../matching/engine.ts';
import { CATEGORY_LABEL, ELIGIBILITY_LABEL, countryName } from './labels.ts';
import { cohort, funnel, kpis, recurringGaps, topSkills, countBy } from './metrics.ts';
import { PERIODS, type PeriodKey } from './period.ts';

const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`);

function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV of the jobs table (only non-sensitive job + score fields). */
export function jobsToCsv(ds: Dataset, matches: Map<string, MatchResult>): string {
  const head = ['id', 'origin', 'title', 'company', 'country', 'area', 'seniority', 'status', 'score', 'category', 'eligibility', 'confidence', 'career_ops_score', 'discovered_at', 'source_url'];
  const rows = ds.jobs.map((j) => {
    const m = matches.get(j.id)!;
    return [j.id, j.origin, j.title, j.company, j.country, j.area, j.seniority, j.status, m.overallScore, m.category, m.eligibilityStatus, m.confidence, j.careerOpsScore ?? '', j.discoveredAt, j.source.url ?? ''];
  });
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** Executive Markdown summary, computed only from the dataset. */
export function executiveReport(ds: Dataset, matches: Map<string, MatchResult>, period: PeriodKey): string {
  const c = cohort(ds, period);
  const k = kpis(ds, c, matches);
  const f = funnel(c);
  const label = PERIODS.find((p) => p.key === period)!.label;
  const top = c.jobs
    .filter((j) => j.status !== 'closed')
    .map((j) => ({ j, m: matches.get(j.id)! }))
    .filter((x) => x.m.category !== 'blocked')
    .sort((a, b) => b.m.overallScore - a.m.overallScore)
    .slice(0, 10);
  const lines: string[] = [];
  lines.push(`# Career OS — Relatório executivo (${label})`);
  lines.push('');
  if (ds.origin === 'demo') lines.push('> **DEMO** — gerado a partir de dados fictícios. Não representa candidaturas reais.', '');
  lines.push(`Referência: ${ds.asOf} · Fonte: ${ds.origin}`, '');
  lines.push('## Executive Summary', '');
  lines.push(`- Vagas identificadas no período: **${k.identified}** (novas nos últimos 7 dias: ${k.newLast7d})`);
  lines.push(`- Alta aderência (abertas): **${k.highFit}**`);
  lines.push(`- Candidaturas enviadas: **${k.submitted}** · respostas: ${k.responded} (${pct(k.responseRate)}) · entrevistas: ${k.interviews}`);
  lines.push('');
  lines.push('## Top Opportunities', '', '| # | Cargo | Empresa | País | Score | Categoria | Elegibilidade |', '|---|---|---|---|---|---|---|');
  top.forEach(({ j, m }, i) => lines.push(`| ${i + 1} | ${j.title} | ${j.company} | ${countryName(j.country)} | ${m.overallScore} | ${CATEGORY_LABEL[m.category]} | ${ELIGIBILITY_LABEL[m.eligibilityStatus]} |`));
  lines.push('', '## Application Performance', '', '| Etapa | Qtde | Conversão da etapa anterior |', '|---|---|---|');
  f.forEach((s) => lines.push(`| ${s.label} | ${s.count} | ${pct(s.rateFromPrev)} |`));
  lines.push('', '## Strategic Intelligence', '', '**Competências mais demandadas:**', '');
  topSkills(c.jobs, 8).forEach((s) => lines.push(`- ${s.label} — ${s.count} vagas (${s.must} como obrigatória)`));
  lines.push('', '**Lacunas recorrentes (não atendidas ou não verificadas):**', '');
  recurringGaps(c.jobs, matches, 8).forEach((g) => lines.push(`- ${g.label} — ${g.missing} ausente(s), ${g.unknown} a validar`));
  lines.push('', '**Oportunidades por país:**', '');
  countBy(c.jobs, (j) => j.country).forEach((x) => lines.push(`- ${countryName(x.key)}: ${x.count}`));
  return lines.join('\n') + '\n';
}
