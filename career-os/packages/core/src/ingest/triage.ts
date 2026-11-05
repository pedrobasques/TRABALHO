/**
 * Deterministic title triage against the owner's priority areas (no AI).
 * A = engineering & project management, B = industrial transformation, C = related areas.
 * Titles in EN / PT / ES / IT / DE / NL.
 */
import type { Job } from '../domain/types.ts';

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const TIERS: { tier: 'A' | 'B' | 'C'; re: RegExp; label: string }[] = [
  { tier: 'A', label: 'gestão de projetos / PMO', re: /\b(project|program(me)?|portfolio|pmo|projetos?|proyectos?|progett[oi]|projekt\w*|projectleider|projectmanager)\b/ },
  { tier: 'A', label: 'engenharia industrial / manufatura', re: /\b(industrial engineer\w*|manufacturing engineer\w*|engenh\w+ de produc\w+|engenharia industrial|engineering manager|ingegnere|fertigungsingenieur|produktionsingenieur)\b/ },
  { tier: 'B', label: 'transformação industrial', re: /\b(digital manufacturing|smart (manufacturing|factory)|industry 4\.?0|industria 4\.?0|manufacturing automation|operational excellence|excelencia operacional|transforma\w+|automation engineer|innovation)\b/ },
  { tier: 'C', label: 'melhoria contínua / processos / supply chain', re: /\b(continuous improvement|melhoria continua|lean|kaizen|process engineer\w*|engenheiro de processos|supply chain|logistic\w*|operations manager|operations engineer|production engineer|planner|mining|mineracao)\b/ },
];

const EXCLUDE = /\b(software (engineer|developer)|developer|devops|site reliability|sre|backend|back-end|frontend|front-end|full[ -]?stack|cloud infrastructure|data scientist|machine learning engineer|account executive|sales|marketing|recruiter|intern(ship)?|estagi\w+|werkstudent|praktikant)\b/;

export interface TriageResult {
  tier: 'A' | 'B' | 'C' | null;
  excluded: string | null;
  reason: string;
}

export function triageJob(job: Pick<Job, 'title'>): TriageResult {
  const t = fold(job.title);
  const hit = TIERS.find((x) => x.re.test(t));
  const ex = EXCLUDE.exec(t);
  // An excluded term wins unless the title is also explicitly industrial (e.g. "Manufacturing Software Project Manager").
  if (ex && !(hit && hit.tier === 'A' && /project|program|manufactur|industrial/.test(t))) {
    return { tier: null, excluded: ex[0], reason: `fora do perfil: "${ex[0]}"` };
  }
  if (!hit) return { tier: null, excluded: 'sem área prioritária', reason: 'título sem termo das áreas A/B/C' };
  return { tier: hit.tier, excluded: null, reason: `prioridade ${hit.tier}: ${hit.label}` };
}

const TIER_WEIGHT = { A: 3, B: 2, C: 1 } as const;

/** Pre-matching rank for choosing which jobs get a JD fetch (Level 3 budget). */
export function triageRank(job: Job, countryPriority: Record<string, number>): number {
  const t = triageJob(job);
  if (!t.tier) return -1;
  const country = countryPriority[job.country] ?? 0.3;
  const senior = /senior|sr\.?|lead|manager|gerente|coordenador|leiter|head/i.test(job.title) ? 0.5 : 0;
  const junior = /junior|jr\.?|\bi\b|graduate|entry/i.test(job.title) ? -0.7 : 0;
  return TIER_WEIGHT[t.tier] + country * 2 + senior + junior;
}
