import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildProfileFromCareerOps, parseCvMarkdown } from '../src/data/career-ops/profile.ts';
import { matchJob } from '../src/matching/engine.ts';
import { buildDemoJobs } from '../src/data/demo/jobs.ts';

const UP = join(import.meta.dirname, '..', '..', '..', 'upstream', 'career-ops');
const upstreamCv = readFileSync(join(UP, 'examples', 'cv-technical-project-manager.md'), 'utf8'); // fictional reference CV shipped by career-ops
const upstreamProfile = readFileSync(join(UP, 'config', 'profile.example.yml'), 'utf8'); // fictional "Jane Smith"

// Synthetic Portuguese CV (no real person).
const PT_CV = `# CV — Pessoa Fictícia

## Resumo
Engenheiro de projetos fictício para testes.

## Experiência

### Empresa Exemplo SA — Belo Horizonte, MG
**Engenheiro de Projetos Sênior**
2019 -- atual

- Coordenou 12 projetos de melhoria contínua.

## Formação
- **Engenharia Mecânica** — Universidade Exemplo (2015)
- **MBA em Gerenciamento de Projetos** — Escola Exemplo (cursando)
- **Lean Six Sigma Green Belt** — Instituto Exemplo

## Competências
- **Gestão:** Gestão de Projetos, PMO, Melhoria Contínua
- **Ferramentas:** Power BI, Power Apps, Power Automate, SharePoint

## Idiomas
- Português — nativo
- Inglês (C1)
- Italiano — intermediário
`;

test('parses the upstream fictional CV (experience, skills, certifications)', () => {
  const cv = parseCvMarkdown(upstreamCv);
  assert.ok(cv.summary.length > 50);
  assert.ok(cv.experience.length >= 3);
  assert.equal(cv.experience[0]!.company, 'Apex Enterprise Solutions');
  assert.equal(cv.experience[0]!.role, 'Senior Technical Project Manager');
  assert.equal(cv.experience[0]!.start, '2022');
  assert.equal(cv.experience[0]!.end, null, '"Present" → open-ended');
  assert.ok(cv.skills.some((s) => s.key === 'power_bi'));
  assert.ok(cv.skills.some((s) => s.key === 'agile'));
  assert.ok(cv.certifications.some((c) => c.key === 'pmp'));
  assert.ok(cv.skills.every((s) => s.provenance === 'declared' && s.level === null), 'levels are never invented');
  assert.ok(cv.achievementsWithNumbers > 0);
});

test('parses a Portuguese CV: languages with CEFR/native, unknown level kept null, degrees and in-progress MBA', () => {
  const cv = parseCvMarkdown(PT_CV);
  assert.deepEqual(cv.languages.map((l) => [l.code, l.level]), [['pt', 'native'], ['en', 'C1'], ['it', null]]);
  assert.equal(cv.education.find((e) => e.key === 'engineering_degree')!.status, 'unverified');
  assert.equal(cv.education.find((e) => e.key === 'mba')!.status, 'in_progress');
  assert.ok(cv.certifications.some((c) => c.key === 'lean_six_sigma'));
  assert.ok(['project_management', 'pmo', 'continuous_improvement', 'power_apps', 'sharepoint'].every((k) => cv.skills.some((s) => s.key === k)));
  assert.equal(cv.experience[0]!.role, 'Engenheiro de Projetos Sênior');
});

test('profile.yml authorized_in becomes declared eligibility; nothing else is assumed', () => {
  const r = buildProfileFromCareerOps(upstreamCv, upstreamProfile);
  assert.deepEqual(r.profile.eligibility.map((e) => [e.country, e.status]), [['US', 'authorized']]);
  assert.equal(r.profile.origin, 'career-ops');
  assert.equal(r.profile.yearsExperience, null, 'years are not inferred into a fact');
  assert.ok(r.notes.some((n) => n.includes('interpretação')), 'CV-date estimate is reported as interpretation');
  assert.deepEqual(r.sources, ['cv.md', 'config/profile.yml']);
});

test('extension can mark eligibility as in progress — still never "eligible" in matching', () => {
  const ext = `eligibility:\n  - { country: BR, status: authorized, basis: "nacionalidade (declarado)" }\n  - { country: IT, status: in_progress, basis: "cidadania em processo" }\nyears_experience: 7\ntarget_seniority: [senior, manager]\ncurrent_seniority: senior\n`;
  const r = buildProfileFromCareerOps(PT_CV, null, ext);
  assert.equal(r.profile.eligibility.find((e) => e.country === 'IT')!.status, 'in_progress');
  const itJob = buildDemoJobs().find((j) => j.country === 'IT' && j.requirements.length)!;
  const m = matchJob(itJob, r.profile);
  assert.equal(m.eligibilityStatus, 'unknown');
  assert.notEqual(m.category, 'excellent');
  const brJob = buildDemoJobs().find((j) => j.id === 'd06')!;
  assert.equal(matchJob(brJob, r.profile).eligibilityStatus, 'eligible');
});

test('older layout: role — company (dates) headings and unbulleted skills/education', () => {
  const cv = parseCvMarkdown(readFileSync(join(UP, 'test-fixtures', 'upgrade', 'state-v1.18', 'cv.md'), 'utf8'));
  assert.deepEqual(cv.experience.map((e) => [e.role, e.company, e.start, e.end]), [
    ['Senior Platform Engineer', 'Acme Corp', '2022', '2026'],
    ['DevOps Engineer', 'Globex GmbH', '2019', '2022'],
  ]);
  assert.ok(cv.skills.some((s) => s.label === 'Kubernetes'));
  assert.equal(cv.education.length, 1);
  assert.equal(cv.earliestYear, 2019);
});

test('missing files are reported as unknowns, not filled with defaults', () => {
  const r = buildProfileFromCareerOps(null, null);
  assert.equal(r.profile.skills.length, 0);
  assert.equal(r.profile.eligibility.length, 0);
  assert.ok(r.unknowns.some((u) => u.includes('cv.md')));
  assert.ok(r.unknowns.some((u) => u.includes('Autorização de trabalho')));
  // Matching still works and reports eligibility as unknown
  const m = matchJob(buildDemoJobs()[0]!, r.profile);
  assert.equal(m.eligibilityStatus, 'unknown');
  assert.ok(m.overallScore >= 0 && m.overallScore <= 100);
});

test('malformed YAML surfaces an error instead of a silently empty profile', () => {
  assert.throws(() => buildProfileFromCareerOps(null, 'candidate: [unclosed'));
});
