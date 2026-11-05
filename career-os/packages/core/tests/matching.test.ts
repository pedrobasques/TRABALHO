import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchJob, resolveConfig, DEMO_PROFILE, type CandidateProfile, type Job, type Requirement } from '../src/index.ts';

const LONG = 'Descrição completa da vaga com responsabilidades, contexto da equipe, escopo dos projetos, interfaces com operações e indicadores de desempenho esperados para a posição. '.repeat(2);

let n = 0;
const r = (p: Partial<Requirement> & Pick<Requirement, 'category' | 'kind' | 'text'>): Requirement => ({ id: `r${++n}`, ...p });

function job(over: Partial<Job> = {}): Job {
  return {
    id: 'j1',
    origin: 'demo',
    title: 'Engineering Project Manager',
    normalizedTitle: 'Project Manager',
    company: 'Test Co',
    sector: 'Automotivo',
    area: 'project_management',
    country: 'BR',
    city: 'Betim',
    workMode: 'hybrid',
    seniority: 'lead',
    description: LONG,
    requirements: [
      r({ category: 'skill', kind: 'must', key: 'project_management', text: 'PM' }),
      r({ category: 'skill', kind: 'must', key: 'pmo', text: 'PMO' }),
      r({ category: 'skill', kind: 'nice', key: 'power_bi', text: 'Power BI' }),
      r({ category: 'experience', kind: 'must', minYears: 5, text: '5 anos' }),
      r({ category: 'language', kind: 'must', language: { code: 'en', level: 'B2' }, text: 'EN B2' }),
    ],
    salary: { min: 22000, max: 28000, currency: 'BRL', period: 'month' },
    postedAt: '2026-10-28',
    discoveredAt: '2026-10-29',
    verifiedAt: '2026-10-30',
    status: 'open',
    source: { name: 'test', url: null },
    careerOpsScore: null,
    visaSponsorship: 'unknown',
    ...over,
  };
}

const profile: CandidateProfile = DEMO_PROFILE;

function inRange(x: number | null) {
  if (x == null) return;
  assert.ok(x >= 0 && x <= 100, `score ${x} out of 0–100`);
}

test('1. high-fit job → high score, eligible, positive recommendation', () => {
  const m = matchJob(job(), profile);
  assert.ok(m.overallScore >= 80, `expected ≥80, got ${m.overallScore}`);
  assert.equal(m.eligibilityStatus, 'eligible');
  assert.equal(m.category, 'excellent');
  assert.equal(m.recommendation, 'prioritize');
  assert.equal(m.missingRequirements.length, 0);
  assert.equal(m.confidence, 'high');
});

test('2. low-fit job → low score and low priority', () => {
  const m = matchJob(
    job({
      area: 'automation',
      seniority: 'junior',
      requirements: [
        r({ category: 'skill', kind: 'must', key: 'plc', text: 'PLC' }),
        r({ category: 'skill', kind: 'must', key: 'mes', text: 'MES' }),
        r({ category: 'skill', kind: 'must', key: 'sap', text: 'SAP' }),
      ],
    }),
    profile,
  );
  assert.ok(m.overallScore < 50, `expected <50, got ${m.overallScore}`);
  assert.ok(['low', 'moderate'].includes(m.category));
  assert.equal(m.missingRequirements.length, 3);
  assert.notEqual(m.recommendation, 'prioritize');
});

test('3. unmet mandatory work authorisation blocks the job regardless of technical fit', () => {
  const m = matchJob(
    job({ country: 'US', visaSponsorship: 'not_offered', requirements: [...job().requirements, r({ category: 'eligibility', kind: 'must', country: 'US', text: 'US work authorization' })] }),
    profile,
  );
  assert.equal(m.technicalScore, 100);
  assert.equal(m.category, 'blocked');
  assert.equal(m.recommendation, 'do_not_apply');
  assert.equal(m.eligibilityStatus, 'not_eligible');
  assert.ok(m.blockers.length >= 1);
});

test('3b. unmet mandatory language is a hard blocker', () => {
  const m = matchJob(job({ requirements: [...job().requirements, r({ category: 'language', kind: 'must', language: { code: 'de', level: 'C1' }, text: 'DE C1' })] }), profile);
  assert.equal(m.category, 'blocked');
  assert.ok(m.blockers.some((b) => b.includes('DE C1')));
});

test('4. unknown eligibility is never "excellent" and never treated as met', () => {
  const m = matchJob(job({ country: 'IT' }), profile); // IT = in_progress in demo profile
  assert.equal(m.eligibilityStatus, 'unknown');
  assert.notEqual(m.category, 'excellent');
  assert.equal(m.recommendation, 'verify_eligibility');
  const withReq = matchJob(job({ country: 'IT', requirements: [...job().requirements, r({ category: 'eligibility', kind: 'must', country: 'IT', text: 'EU' })] }), profile);
  assert.equal(withReq.unknownRequirements.filter((x) => x.requirement.category === 'eligibility').length, 1);
  assert.equal(withReq.matchedRequirements.filter((x) => x.requirement.category === 'eligibility').length, 0);
});

test('4b. unknown requirement scores strictly less than a met one', () => {
  const met = matchJob(job({ requirements: [r({ category: 'skill', kind: 'must', key: 'project_management', text: 'PM' })] }), profile);
  const unk = matchJob(job({ requirements: [r({ category: 'skill', kind: 'must', key: 'lean_six_sigma', text: 'LSS' })] }), profile); // pending_validation
  assert.equal(unk.unknownRequirements.length, 1);
  assert.ok(unk.technicalScore! < met.technicalScore!);
  assert.ok(unk.overallScore < met.overallScore);
});

test('5. no salary → compensation not evaluated (neither penalty nor match)', () => {
  const withSalary = matchJob(job(), profile);
  const without = matchJob(job({ salary: null }), profile);
  assert.equal(without.components.find((c) => c.key === 'compensation')!.value, null);
  assert.ok(without.explanation.some((e) => e.includes('compensation')));
  inRange(without.overallScore);
  assert.ok(Math.abs(without.overallScore - withSalary.overallScore) <= 5);
});

test('6. no requirements → technical null, low confidence', () => {
  const m = matchJob(job({ requirements: [] }), profile);
  assert.equal(m.technicalScore, null);
  assert.notEqual(m.confidence, 'high');
  assert.equal(m.matchedRequirements.length, 0);
  assert.ok(['moderate', 'low'].includes(m.category), 'no requirements can never rank high');
  inRange(m.overallScore);
});

test('7. incomplete description and unknown seniority lower confidence', () => {
  const full = matchJob(job(), profile);
  const thin = matchJob(job({ description: 'Vaga.', seniority: 'unknown', workMode: 'unknown' }), profile);
  assert.ok(thin.confidenceValue < full.confidenceValue);
  assert.equal(thin.careerScore, null);
});

test('8. inconsistent data is reported and does not crash', () => {
  const m = matchJob(
    job({
      salary: { min: 90000, max: 10000, currency: 'EUR', period: 'year' },
      verifiedAt: '2026-01-01',
      careerOpsScore: 9,
      requirements: [r({ category: 'experience', kind: 'must', minYears: -3, text: 'bad' })],
    }),
    profile,
  );
  assert.ok(m.dataIssues.length >= 3, m.dataIssues.join(' | '));
  assert.equal(m.confidence, 'low');
  inRange(m.overallScore);
});

test('9. weights are configurable and change the score', () => {
  const j = job({ country: 'US', visaSponsorship: 'offered' });
  const base = matchJob(j, profile);
  const locHeavy = matchJob(j, profile, resolveConfig({ weights: { ...resolveConfig().weights, location: 200 } }));
  assert.notEqual(base.overallScore, locHeavy.overallScore);
  const techOnly = matchJob(j, profile, resolveConfig({ weights: { technical: 1, experience: 0, area: 0, seniority: 0, location: 0, language: 0, career: 0, compensation: 0 } }));
  assert.equal(techOnly.overallScore, techOnly.technicalScore);
});

test('10. every score stays within 0–100 across all demo jobs and extreme configs', async () => {
  const { buildDemoJobs } = await import('../src/data/demo/jobs.ts');
  const cfgs = [resolveConfig(), resolveConfig({ missingMustPenalty: 100 }), resolveConfig({ weights: { technical: 0, experience: 0, area: 0, seniority: 0, location: 0, language: 0, career: 0, compensation: 0 } })];
  for (const j of buildDemoJobs()) {
    for (const cfg of cfgs) {
      const m = matchJob(j, profile, cfg);
      inRange(m.overallScore);
      inRange(m.technicalScore);
      inRange(m.careerScore);
      for (const c of m.components) inRange(c.value);
      assert.ok(Number.isInteger(m.overallScore));
    }
  }
});

test('career-ops 1–5 score is kept on its own scale, not merged', () => {
  const a = matchJob(job({ careerOpsScore: 1.5 }), profile);
  const b = matchJob(job({ careerOpsScore: 4.9 }), profile);
  assert.equal(a.overallScore, b.overallScore);
  assert.equal(b.careerOpsScore, 4.9);
});

test('requires_sponsorship when not authorised but sponsorship is offered', () => {
  const m = matchJob(job({ country: 'AU', visaSponsorship: 'offered' }), profile);
  assert.equal(m.eligibilityStatus, 'requires_sponsorship');
  assert.equal(m.recommendation, 'verify_eligibility');
});

test('closed job → job_closed recommendation', () => {
  assert.equal(matchJob(job({ status: 'closed' }), profile).recommendation, 'job_closed');
});
