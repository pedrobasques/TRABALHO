import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeJobs, detectPrimaryCountry, normalizeJob } from '../src/ingest/normalize.ts';
import { triageJob } from '../src/ingest/triage.ts';
import { extractRequirements } from '../src/ingest/jd-extract.ts';
import { scanHistoryToJobs } from '../src/data/career-ops/parse.ts';
import { matchJob } from '../src/matching/engine.ts';
import { buildDemoJobs } from '../src/data/demo/jobs.ts';
import { buildProfileFromCareerOps } from '../src/data/career-ops/profile.ts';

const H = 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\tfingerprint\tposted_at\ttrust_score\ttrust_flags\tnormalized_company\trequisition_id\tlanguage\tlisting_key';
const row = (url: string, title: string, status: string, loc: string, req = '') => [url, '2026-11-05', 'greenhouse-api', title, 'Acme', status, loc, 'fp-shared', '2026-10-30', '', '', 'acme', req, '', ''].join('\t');

test('scan-history: scanner-filtered rows are not openings; added rows are open and verified; id from URL, not content fingerprint', () => {
  const jobs = scanHistoryToJobs([H, row('https://x.test/1', 'Project Engineer', 'added', 'Milan, Italy', 'R1'), row('https://x.test/2', 'Project Engineer', 'added', 'Turin, Italy', 'R2'), row('https://x.test/3', 'DevOps', 'skipped_title', 'Rome, Italy')].join('\n'));
  assert.equal(jobs.length, 2);
  assert.notEqual(jobs[0]!.id, jobs[1]!.id, 'shared content fingerprint must not collapse ids');
  assert.equal(jobs[0]!.status, 'open');
  assert.equal(jobs[0]!.verifiedAt, '2026-11-05');
  assert.equal(jobs[0]!.source.externalId, 'R1');
});

test('dedupe: same company|title|country with different native URLs = distinct jobs flagged as possible repost', () => {
  const jobs = scanHistoryToJobs([H, row('https://x.test/1', 'Project Engineer', 'added', 'Milan, Italy'), row('https://x.test/9', 'Project Engineer', 'added', 'Milan, Italy'), row('https://x.test/1/', 'Project Engineer', 'added', 'Milan, Italy')].join('\n'));
  const r = dedupeJobs(jobs.map(normalizeJob));
  assert.equal(r.jobs.length, 2, 'URL twin merged, different URL kept');
  assert.equal(r.duplicates.length, 1);
  assert.equal(r.possibleReposts.length, 1);
});

test('primary country = first listed location; unknown places never mapped to a priority country', () => {
  assert.equal(detectPrimaryCountry('Kiln Farm, England, United Kingdom · Barcelona, Spain'), 'GB');
  assert.equal(detectPrimaryCountry('Katowice, Poland · Rotterdam, Netherlands'), 'PL');
  assert.equal(detectPrimaryCountry('Berlin · Germany'), 'DE');
  assert.equal(detectPrimaryCountry('Remote'), null);
});

test('triage: priority tiers in several languages; software/devops excluded', () => {
  assert.equal(triageJob({ title: 'Gerente de Projetos Sênior' }).tier, 'A');
  assert.equal(triageJob({ title: 'Projektleiter Klimaanlagen (w/m/d)' }).tier, 'A');
  assert.equal(triageJob({ title: 'Lean/ Six Sigma Project Manager' }).tier, 'A');
  assert.equal(triageJob({ title: 'Continuous Improvement Engineer' }).tier, 'C');
  assert.ok(triageJob({ title: 'Senior DevOps Engineer' }).excluded);
  assert.ok(triageJob({ title: 'Software Engineer, Backend' }).excluded);
});

const JD = `Manufacturing Engineering Technician
Your Responsibilities:
- Drive continuous improvement and lean projects on the shop floor
The Essentials - You Will Have:
- Bachelor's degree in Mechanical Engineering
- 5+ years of experience in manufacturing
- Fluent English and Italian
- Experience with SAP and PFMEA
The Preferred - You Might Also Have:
- Six Sigma Green Belt
- Power BI
Pay range: $95,000 - $120,000
Visa sponsorship is not available for this role.`;

test('JD extraction: must vs nice sections, years, degree, languages, salary, visa; responsibilities are not requirements', () => {
  const x = extractRequirements('j1', JD, 'IT');
  const by = (k: string) => x.requirements.filter((r) => r.kind === k).map((r) => r.text);
  assert.ok(by('must').includes('5+ anos de experiência'));
  assert.ok(by('must').includes('Graduação em engenharia'));
  assert.ok(by('must').some((t) => /English C1/.test(t)) && by('must').some((t) => /Italian C1/.test(t)));
  assert.ok(by('must').includes('SAP') && by('must').includes('PFMEA / APQP / PPAP'));
  assert.ok(by('nice').includes('Lean Six Sigma') && by('nice').includes('Power BI'));
  assert.ok(!x.requirements.some((r) => r.key === 'continuous_improvement'), 'a responsibility is not a requirement');
  assert.deepEqual(x.salary, { min: 95000, max: 120000, currency: 'USD', period: 'year' });
  assert.equal(x.visaSponsorship, 'not_offered');
  assert.equal(extractRequirements('j2', 'Just a title, no structure at all here.', 'IT').requirements.length, 0);
});

test('matching: no CV → requirements unknown (not unmet); title-only posting → "Dados insuficientes"', () => {
  const prof = buildProfileFromCareerOps(null, null, 'eligibility:\n  - { country: IT, status: in_progress }\n').profile;
  const base = buildDemoJobs()[0]!;
  const withReqs = { ...base, description: JD, requirements: extractRequirements(base.id, JD, 'IT').requirements };
  const m = matchJob(withReqs, prof);
  assert.equal(m.missingRequirements.filter((r) => r.requirement.category !== 'eligibility').length, 0, 'absence of CV is not "not met"');
  assert.equal(m.technicalScore, null, 'nothing verifiable → no technical number');
  assert.equal(m.blockers.length, 0, 'unknown language is not a blocker');
  assert.equal(m.eligibilityStatus, 'unknown', 'Italy in progress ≠ eligible');
  const titleOnly = matchJob({ ...base, description: '', requirements: [] }, prof);
  assert.equal(titleOnly.insufficientData, true);
  assert.equal(titleOnly.recommendation, 'insufficient_data');
});
