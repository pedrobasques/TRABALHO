import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyJobFilter,
  buildActions,
  buildDemoDataset,
  cohort,
  countByStage,
  EMPTY_FILTER,
  executiveReport,
  funnel,
  jobsToCsv,
  kpis,
  matchAll,
  maxStageReached,
  parseApplicationsMd,
  parseStatusLog,
  scanHistoryToJobs,
  timeInStage,
  trackerToDomain,
  weeklyTimeline,
  inPeriod,
  countryName,
  type JobRow,
} from '../src/index.ts';

const ds = buildDemoDataset();
const matches = matchAll(ds.jobs, ds.profile);
const rows: JobRow[] = ds.jobs.map((job) => ({ job, match: matches.get(job.id)! }));

test('demo dataset is internally consistent', () => {
  const jobIds = new Set(ds.jobs.map((j) => j.id));
  assert.equal(jobIds.size, ds.jobs.length, 'unique job ids');
  for (const a of ds.applications) {
    assert.ok(jobIds.has(a.jobId), `${a.id} → missing job ${a.jobId}`);
    const job = ds.jobs.find((j) => j.id === a.jobId)!;
    assert.equal(a.history[a.history.length - 1]!.stage, a.stage, `${a.id}: last event = stage`);
    for (let i = 1; i < a.history.length; i++) assert.ok(a.history[i]!.at >= a.history[i - 1]!.at, `${a.id}: chronological`);
    assert.ok(a.history[0]!.at >= job.discoveredAt, `${a.id}: history after discovery`);
    assert.ok(a.history.every((h) => h.at <= ds.asOf), `${a.id}: no future events`);
    assert.equal(a.origin, 'demo');
  }
  assert.ok(ds.jobs.every((j) => j.origin === 'demo' && j.source.url === null), 'demo jobs never carry real links');
  assert.equal(ds.runs.length, 0, 'no invented automation runs');
});

test('funnel is monotonic and conversion uses the previous step', () => {
  for (const p of ['7d', '30d', '90d', 'all'] as const) {
    const f = funnel(cohort(ds, p));
    for (let i = 1; i < f.length; i++) {
      assert.ok(f[i]!.count <= f[i - 1]!.count, `${p}: ${f[i]!.key} ≤ ${f[i - 1]!.key}`);
      if (f[i - 1]!.count > 0) assert.equal(f[i]!.rateFromPrev, f[i]!.count / f[i - 1]!.count);
      else assert.equal(f[i]!.rateFromPrev, null);
    }
  }
});

test('KPIs change with the period and match the funnel', () => {
  const all = kpis(ds, cohort(ds, 'all'), matches);
  const week = kpis(ds, cohort(ds, '7d'), matches);
  assert.equal(all.identified, ds.jobs.length);
  assert.ok(week.identified < all.identified);
  const f = funnel(cohort(ds, 'all'));
  assert.equal(all.submitted, f.find((s) => s.key === 'submitted')!.count);
  assert.equal(all.interviews, f.find((s) => s.key === 'interview')!.count);
  assert.equal(all.responseRate, all.responded / all.submitted);
});

test('closed application keeps the highest stage it reached', () => {
  const a12 = ds.applications.find((a) => a.id === 'a12')!;
  assert.equal(a12.stage, 'closed');
  assert.equal(maxStageReached(a12), 'interview');
});

test('stage counts sum to the number of applications', () => {
  const c = countByStage(ds.applications);
  assert.equal(Object.values(c).reduce((s, x) => s + x, 0), ds.applications.length);
  const t = timeInStage(ds.applications, ds.asOf);
  assert.ok(Object.values(t).every((x) => x! >= 0));
});

test('weekly timeline totals match discovery counts within range', () => {
  const tl = weeklyTimeline(ds, 4);
  const sum = tl.reduce((s, p) => s + p.discovered, 0);
  const expected = ds.jobs.filter((j) => inPeriod(j.discoveredAt, '30d', ds.asOf) && j.discoveredAt >= tl[0]!.weekStart).length;
  assert.equal(sum, expected);
});

test('filters: country, score, query, sort, clear', () => {
  const it = applyJobFilter(rows, { ...EMPTY_FILTER, countries: ['IT'] });
  assert.ok(it.length > 0 && it.every((r) => r.job.country === 'IT'));
  const hi = applyJobFilter(rows, { ...EMPTY_FILTER, minScore: 70 });
  assert.ok(hi.every((r) => r.match.overallScore >= 70));
  const q = applyJobFilter(rows, { ...EMPTY_FILTER, query: 'mineracao' }); // accent-insensitive
  assert.ok(q.length > 0);
  const sorted = applyJobFilter(rows, EMPTY_FILTER);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i - 1]!.match.overallScore >= sorted[i]!.match.overallScore);
  assert.equal(applyJobFilter(rows, EMPTY_FILTER).length, rows.length);
  const blocked = applyJobFilter(rows, { ...EMPTY_FILTER, eligibility: ['not_eligible'] });
  assert.ok(blocked.every((r) => r.match.eligibilityStatus === 'not_eligible'));
});

test('demo data exercises every category including blocked', () => {
  const cats = new Set([...matches.values()].map((m) => m.category));
  for (const c of ['high', 'moderate', 'blocked'] as const) assert.ok(cats.has(c), `missing category ${c}`);
});

test('action center is derived from data', () => {
  const actions = buildActions(ds, matches);
  assert.ok(actions.some((a) => a.kind === 'review'));
  assert.ok(actions.some((a) => a.kind === 'profile'));
  assert.ok(actions.every((a) => a.href.startsWith('/')));
});

test('exports: CSV escapes formulas, Markdown flags DEMO', () => {
  const csv = jobsToCsv(ds, matches);
  assert.equal(csv.trim().split('\n').length, ds.jobs.length + 1);
  const md = executiveReport(ds, matches, '30d');
  assert.match(md, /DEMO/);
  assert.match(md, /## Top Opportunities/);
});

/* ---------------------------------------------------- career-ops adapter */

const TRACKER = `# Applications Tracker

| # | Date | Company | Via | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|-----|------|-------|--------|-----|--------|-------|
| 1 | 2026-06-20 | Acme | — | Senior Platform Engineer | 4.2/5 | Applied | ✅ | [1](../reports/001-acme-2026-06-20.md) | Strong fit |
| 2 | 2026-06-25 | Globex | Hays | Staff Engineer | 4.5/5 | **Interview** | ✅ | [2](../reports/002.md) | Referral |
| 3 | 2026-06-26 | Initech | — | SRE | 3.1/5 | SKIP | ❌ | — | Below bar |
| 4 | 2026-06-28 | Hooli | — | DevOps Lead | 3.8/5 | Rechazado | ✅ | — | Auto-rejection |
| 5 | not-a-date | Umbrella | — | Engineer | n/a | Mystery | ❌ | — | pipe \\| inside |
`;

test('parses applications.md (synthetic fixture in upstream format)', () => {
  const rows = parseApplicationsMd(TRACKER);
  assert.equal(rows.length, 5);
  assert.equal(rows[0]!.score, 4.2);
  assert.equal(rows[0]!.report, '../reports/001-acme-2026-06-20.md');
  assert.equal(rows[4]!.score, null);
  assert.equal(rows[4]!.notes, 'pipe | inside');
  const { jobs, applications, warnings } = trackerToDomain(rows);
  assert.equal(jobs.length, 5);
  assert.equal(applications.find((a) => a.id === 'co-app-2')!.stage, 'interview');
  assert.equal(applications.find((a) => a.id === 'co-app-3')!.closedReason, 'discarded');
  const rejected = applications.find((a) => a.id === 'co-app-4')!;
  assert.equal(rejected.closedReason, 'rejected');
  assert.equal(maxStageReached(rejected), 'submitted');
  assert.equal(warnings.length, 2, warnings.join(' | '));
  assert.ok(jobs.every((j) => j.origin === 'career-ops' && j.requirements.length === 0));
  assert.equal(jobs[0]!.careerOpsScore, 4.2);
});

test('status-log builds history', () => {
  const log = parseStatusLog('1\t2026-06-20\t-\tEvaluated\tmanual\t\n1\t2026-06-22\tEvaluated\tApplied\tset-status\tsent\nbad line\n');
  assert.equal(log.length, 2);
  const { applications } = trackerToDomain(parseApplicationsMd(TRACKER), log);
  const a1 = applications.find((a) => a.id === 'co-app-1')!;
  assert.deepEqual(a1.history.map((h) => h.stage), ['qualified', 'submitted']);
});

test('scan-history.tsv → jobs, header and junk skipped, formula escape undone', () => {
  const tsv = [
    'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation',
    'https://boards.example/1\t2026-10-01T10:00:00Z\tgreenhouse\tProject Engineer\tAcme\tadded\tMilan, Italy\tfp1',
    "https://boards.example/2\t2026-10-02\tlever\t'=Formula Title\tBeta\tclosed\tRemote",
    'garbage',
  ].join('\n');
  const jobs = scanHistoryToJobs(tsv);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0]!.country, 'IT');
  assert.equal(jobs[0]!.discoveredAt, '2026-10-01');
  assert.equal(jobs[1]!.title, '=Formula Title');
  assert.equal(jobs[1]!.status, 'closed');
  assert.equal(jobs[1]!.workMode, 'remote');
});

test('legacy 3-column scan-history (career-ops ≤ v1.18) is read correctly', () => {
  const jobs = scanHistoryToJobs('https://boards.example.test/acme/jobs/1\t2026-06-19\tSenior Platform Engineer\n');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]!.title, 'Senior Platform Engineer');
  assert.equal(jobs[0]!.company, 'Empresa não informada');
  assert.equal(jobs[0]!.discoveredAt, '2026-06-19');
  assert.equal(countryName(jobs[0]!.country), 'País não informado');
});

test('empty / missing inputs are safe', () => {
  assert.deepEqual(parseApplicationsMd(''), []);
  assert.deepEqual(scanHistoryToJobs(''), []);
  const empty = { ...ds, jobs: [], applications: [] };
  const f = funnel(cohort(empty, 'all'));
  assert.ok(f.every((s) => s.count === 0));
  assert.equal(kpis(empty, cohort(empty, 'all'), new Map()).responseRate, null);
});
