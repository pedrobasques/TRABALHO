import type { Job, JobArea, JobStatus, Seniority, WorkMode } from '../domain/types.ts';
import type { EligibilityStatus, MatchResult } from '../matching/engine.ts';

export interface JobRow {
  job: Job;
  match: MatchResult;
}

export type JobSort = 'score' | 'recent' | 'company' | 'country' | 'priority';

export interface JobFilter {
  query: string;
  countries: string[];
  areas: JobArea[];
  seniorities: Seniority[];
  workModes: WorkMode[];
  statuses: JobStatus[];
  eligibility: EligibilityStatus[];
  companies: string[];
  minScore: number;
  sort: JobSort;
}

export const EMPTY_FILTER: JobFilter = {
  query: '',
  countries: [],
  areas: [],
  seniorities: [],
  workModes: [],
  statuses: [],
  eligibility: [],
  companies: [],
  minScore: 0,
  sort: 'score',
};

export function isFilterActive(f: JobFilter): boolean {
  return (
    f.query.trim() !== '' ||
    f.countries.length > 0 ||
    f.areas.length > 0 ||
    f.seniorities.length > 0 ||
    f.workModes.length > 0 ||
    f.statuses.length > 0 ||
    f.eligibility.length > 0 ||
    f.companies.length > 0 ||
    f.minScore > 0
  );
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Priority rank used by the "priority" sort: recommendation first, then score. */
const RECO_RANK: Record<MatchResult['recommendation'], number> = {
  prioritize: 0,
  apply: 1,
  verify_eligibility: 2,
  consider: 3,
  low_priority: 4,
  do_not_apply: 5,
  job_closed: 6,
};

export function applyJobFilter(rows: JobRow[], f: JobFilter): JobRow[] {
  const q = fold(f.query.trim());
  const terms = q ? q.split(/\s+/) : [];
  const out = rows.filter(({ job, match }) => {
    if (terms.length) {
      const hay = fold(
        [job.title, job.normalizedTitle, job.company, job.sector, job.city ?? '', job.country, ...job.requirements.map((r) => r.text)].join(' '),
      );
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    if (f.countries.length && !f.countries.includes(job.country)) return false;
    if (f.areas.length && !f.areas.includes(job.area)) return false;
    if (f.seniorities.length && !f.seniorities.includes(job.seniority)) return false;
    if (f.workModes.length && !f.workModes.includes(job.workMode)) return false;
    if (f.statuses.length && !f.statuses.includes(job.status)) return false;
    if (f.eligibility.length && !f.eligibility.includes(match.eligibilityStatus)) return false;
    if (f.companies.length && !f.companies.includes(job.company)) return false;
    if (match.overallScore < f.minScore) return false;
    return true;
  });
  const byDate = (r: JobRow) => r.job.postedAt ?? r.job.discoveredAt;
  const cmp: Record<JobSort, (a: JobRow, b: JobRow) => number> = {
    score: (a, b) => b.match.overallScore - a.match.overallScore,
    recent: (a, b) => byDate(b).localeCompare(byDate(a)),
    company: (a, b) => a.job.company.localeCompare(b.job.company),
    country: (a, b) => a.job.country.localeCompare(b.job.country) || b.match.overallScore - a.match.overallScore,
    priority: (a, b) =>
      RECO_RANK[a.match.recommendation] - RECO_RANK[b.match.recommendation] || b.match.overallScore - a.match.overallScore,
  };
  return out.sort((a, b) => cmp[f.sort](a, b) || a.job.id.localeCompare(b.job.id));
}

/** Distinct values present in the data, for building filter options. */
export function facetValues(rows: JobRow[]) {
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  return {
    countries: uniq(rows.map((r) => r.job.country)).sort(),
    areas: uniq(rows.map((r) => r.job.area)),
    seniorities: uniq(rows.map((r) => r.job.seniority)),
    workModes: uniq(rows.map((r) => r.job.workMode)),
    statuses: uniq(rows.map((r) => r.job.status)),
    eligibility: uniq(rows.map((r) => r.match.eligibilityStatus)),
    companies: uniq(rows.map((r) => r.job.company)).sort(),
  };
}

export function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  return { items: items.slice((p - 1) * pageSize, p * pageSize), page: p, pages };
}
