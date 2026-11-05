/**
 * Deterministic job-matching engine (Level 3 in the processing tiers).
 *
 * Principles (see docs/adr/ADR-003-score-0-100.md):
 *  - Every requirement is classified as met / not_met / unknown. Unknown is
 *    never treated as met: it earns only `UNKNOWN_CREDIT` and lowers confidence.
 *  - Components that cannot be evaluated (no salary, no seniority…) are left
 *    out and the remaining weights are re-normalised — absence is neither a
 *    penalty nor a match.
 *  - Hard gates (work authorisation, mandatory language) override the score:
 *    a blocked job is never recommended, whatever its technical fit.
 *  - The native career-ops 1–5 score is reported side by side and NOT folded
 *    into the 0–100 score (different semantics: LLM holistic judgement vs.
 *    rule-based fit).
 */
import {
  LANGUAGE_LEVEL_ORDER,
  SENIORITY_ORDER,
  type CandidateProfile,
  type CountryCode,
  type Job,
  type Requirement,
  type Seniority,
} from '../domain/types.ts';
import { DEFAULT_MATCHING_CONFIG, type ComponentKey, type MatchingConfig } from './config.ts';

/** Share of a requirement's weight credited when its status is unknown. */
export const UNKNOWN_CREDIT = 0.25;

/** Minimum share of component weight that must be evaluable before a job can rank above "moderate". */
export const MIN_COVERAGE = 0.6;

export type RequirementStatus = 'met' | 'not_met' | 'unknown';

export interface RequirementResult {
  requirement: Requirement;
  status: RequirementStatus;
  reason: string;
}

export type EligibilityStatus = 'eligible' | 'requires_sponsorship' | 'not_eligible' | 'unknown';
export type Confidence = 'high' | 'medium' | 'low';
export type MatchCategory = 'excellent' | 'high' | 'moderate' | 'low' | 'blocked';
export type Recommendation =
  | 'prioritize'
  | 'apply'
  | 'consider'
  | 'verify_eligibility'
  | 'low_priority'
  | 'do_not_apply'
  | 'job_closed';

export interface ComponentResult {
  key: ComponentKey;
  /** 0–100, or null when the job lacks the data to evaluate it. */
  value: number | null;
  weight: number;
  detail: string;
}

export interface MatchResult {
  jobId: string;
  overallScore: number;
  technicalScore: number | null;
  careerScore: number | null;
  eligibilityStatus: EligibilityStatus;
  eligibilityDetail: string;
  confidence: Confidence;
  confidenceValue: number;
  category: MatchCategory;
  recommendation: Recommendation;
  matchedRequirements: RequirementResult[];
  missingRequirements: RequirementResult[];
  unknownRequirements: RequirementResult[];
  blockers: string[];
  dataIssues: string[];
  components: ComponentResult[];
  explanation: string[];
  /** career-ops native 1–5 score, untouched. */
  careerOpsScore: number | null;
  configVersion: string;
}

const norm = (s: string) => s.trim().toLowerCase();
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

function seniorityIndex(s: Seniority): number | null {
  const i = SENIORITY_ORDER.indexOf(s);
  return i < 0 ? null : i;
}

/* ------------------------------------------------------------ requirements */

export function evaluateEligibility(
  job: Job,
  profile: CandidateProfile,
  country: CountryCode = job.country,
): { status: EligibilityStatus; detail: string } {
  const entry = profile.eligibility.find((e) => e.country === country);
  if (!entry || entry.status === 'unknown') {
    return { status: 'unknown', detail: `Work authorisation for ${country} not documented.` };
  }
  if (entry.status === 'authorized') {
    return { status: 'eligible', detail: `Authorised to work in ${country}${entry.basis ? ` (${entry.basis})` : ''}.` };
  }
  if (entry.status === 'in_progress') {
    return {
      status: 'unknown',
      detail: `Authorisation for ${country} in progress${entry.basis ? ` (${entry.basis})` : ''} — not yet valid.`,
    };
  }
  // not_authorized
  if (job.visaSponsorship === 'offered') {
    return { status: 'requires_sponsorship', detail: `No authorisation for ${country}; employer states it sponsors visas.` };
  }
  if (job.visaSponsorship === 'not_offered') {
    return { status: 'not_eligible', detail: `No authorisation for ${country} and the posting excludes sponsorship.` };
  }
  return { status: 'unknown', detail: `No authorisation for ${country}; sponsorship not stated in the posting.` };
}

function findSkill(profile: CandidateProfile, key: string) {
  const k = norm(key);
  return profile.skills.find((s) => norm(s.key) === k || (s.aliases ?? []).some((a) => norm(a) === k));
}

export function evaluateRequirement(req: Requirement, job: Job, profile: CandidateProfile): RequirementResult {
  const r = (status: RequirementStatus, reason: string): RequirementResult => ({ requirement: req, status, reason });
  switch (req.category) {
    case 'skill': {
      if (!req.key) return r('unknown', 'Requirement not mapped to a known skill.');
      const s = findSkill(profile, req.key);
      if (!s) return r('not_met', 'Not present in profile.');
      if (s.provenance === 'pending_validation') return r('unknown', `"${s.label}" is in the profile but pending validation.`);
      return r('met', `"${s.label}" (${s.provenance}, level ${s.level}/5).`);
    }
    case 'certification': {
      if (!req.key) return r('unknown', 'Certification not mapped.');
      const c = profile.certifications.find((x) => norm(x.key) === norm(req.key!));
      if (!c) return r('not_met', 'Certification not in profile.');
      if (c.provenance === 'pending_validation') return r('unknown', `"${c.label}" pending validation.`);
      return r('met', `"${c.label}" (${c.provenance}).`);
    }
    case 'education': {
      if (!req.key) return r('unknown', 'Degree requirement not mapped.');
      const e = profile.education.find((x) => norm(x.key) === norm(req.key!));
      if (!e) return r('not_met', 'Degree not in profile.');
      if (e.status !== 'completed' || e.provenance === 'pending_validation') {
        return r('unknown', `"${e.degree}" status ${e.status} / ${e.provenance} — confirm before claiming.`);
      }
      return r('met', `"${e.degree}" — ${e.institution}.`);
    }
    case 'experience': {
      if (req.minYears == null) return r('unknown', 'No minimum stated.');
      if (profile.yearsExperience == null) return r('unknown', 'Years of experience not documented in profile.');
      return profile.yearsExperience >= req.minYears
        ? r('met', `${profile.yearsExperience} years ≥ ${req.minYears}.`)
        : r('not_met', `${profile.yearsExperience} years < ${req.minYears}.`);
    }
    case 'language': {
      if (!req.language) return r('unknown', 'Language not specified.');
      const l = profile.languages.find((x) => norm(x.code) === norm(req.language!.code));
      if (!l) return r('not_met', `${req.language.code.toUpperCase()} not in profile.`);
      if (l.level == null) return r('unknown', `${l.label}: level not documented.`);
      const have = LANGUAGE_LEVEL_ORDER.indexOf(l.level);
      const need = LANGUAGE_LEVEL_ORDER.indexOf(req.language.level);
      const tag = l.provenance === 'pending_validation' ? ' (pending validation)' : '';
      if (have >= need) {
        return l.provenance === 'pending_validation'
          ? r('unknown', `${l.label} ${l.level}${tag} vs ${req.language.level} required.`)
          : r('met', `${l.label} ${l.level} ≥ ${req.language.level}.`);
      }
      return r('not_met', `${l.label} ${l.level}${tag} < ${req.language.level}.`);
    }
    case 'eligibility': {
      const e = evaluateEligibility(job, profile, req.country ?? job.country);
      if (e.status === 'eligible') return r('met', e.detail);
      if (e.status === 'not_eligible') return r('not_met', e.detail);
      if (e.status === 'requires_sponsorship') return r('unknown', e.detail);
      return r('unknown', e.detail);
    }
  }
}

/* --------------------------------------------------------------- components */

function weightedFraction(results: RequirementResult[], cfg: MatchingConfig): number | null {
  if (results.length === 0) return null;
  let got = 0;
  let total = 0;
  for (const x of results) {
    const w = x.requirement.kind === 'must' ? cfg.mustWeight : cfg.niceWeight;
    total += w;
    if (x.status === 'met') got += w;
    else if (x.status === 'unknown') got += w * UNKNOWN_CREDIT;
  }
  return total === 0 ? null : (got / total) * 100;
}

function toAnnualEur(amount: number, currency: string, period: 'year' | 'month' | 'hour', cfg: MatchingConfig): number | null {
  const rate = cfg.eurRates[currency.toUpperCase()];
  if (rate == null) return null;
  const annual = period === 'year' ? amount : period === 'month' ? amount * 12 : amount * 1800;
  return annual * rate;
}

export function detectDataIssues(job: Job): string[] {
  const issues: string[] = [];
  if (job.salary) {
    const { min, max } = job.salary;
    if (min != null && max != null && min > max) issues.push('Salary minimum is greater than maximum.');
    if ((min != null && min < 0) || (max != null && max < 0)) issues.push('Negative salary value.');
  }
  for (const r of job.requirements) {
    if (r.minYears != null && (r.minYears < 0 || r.minYears > 50)) issues.push(`Implausible years requirement (${r.minYears}).`);
  }
  if (job.postedAt && job.verifiedAt && job.verifiedAt < job.postedAt) {
    issues.push('Verification date precedes publication date.');
  }
  if (job.postedAt && job.postedAt > job.discoveredAt.slice(0, 10) && job.postedAt > (job.verifiedAt ?? job.discoveredAt)) {
    issues.push('Publication date is after discovery date.');
  }
  if (job.careerOpsScore != null && (job.careerOpsScore < 1 || job.careerOpsScore > 5)) {
    issues.push(`career-ops score ${job.careerOpsScore} outside the 1–5 scale.`);
  }
  return issues;
}

/* --------------------------------------------------------------------- main */

export function matchJob(job: Job, profile: CandidateProfile, config: MatchingConfig = DEFAULT_MATCHING_CONFIG): MatchResult {
  const cfg = config;
  const dataIssues = detectDataIssues(job);
  const reqResults = job.requirements.map((req) => evaluateRequirement(req, job, profile));
  const byCat = (...cats: Requirement['category'][]) => reqResults.filter((x) => cats.includes(x.requirement.category));

  const eligibility = evaluateEligibility(job, profile);
  const components: ComponentResult[] = [];
  const add = (key: ComponentKey, value: number | null, detail: string) =>
    components.push({ key, value: value == null ? null : clamp(value), weight: cfg.weights[key], detail });

  // technical: skills, certifications, education
  const tech = byCat('skill', 'certification', 'education');
  const technical = weightedFraction(tech, cfg);
  add('technical', technical, tech.length ? `${tech.filter((t) => t.status === 'met').length}/${tech.length} technical requirements met` : 'No technical requirements stated');

  const exp = byCat('experience');
  add('experience', weightedFraction(exp, cfg), exp.length ? exp.map((e) => e.reason).join(' ') : 'No experience requirement stated');

  const lang = byCat('language');
  add('language', weightedFraction(lang, cfg), lang.length ? lang.map((e) => e.reason).join(' ') : 'No language requirement stated');

  const areaPriority = profile.preferences.areas[job.area] ?? cfg.defaultAreaPriority;
  add('area', areaPriority * 100, `Area "${job.area}" priority ${Math.round(areaPriority * 100)}%`);

  const jobSen = seniorityIndex(job.seniority);
  if (jobSen == null) {
    add('seniority', null, 'Seniority not stated');
  } else {
    const targets = profile.targetSeniority.map(seniorityIndex).filter((x): x is number => x != null);
    const dist = targets.length ? Math.min(...targets.map((t) => Math.abs(t - jobSen))) : null;
    add('seniority', dist == null ? null : dist === 0 ? 100 : dist === 1 ? 60 : 20, `Job level ${job.seniority}; targets ${profile.targetSeniority.join(', ') || 'not set'}`);
  }

  const countryPriority = profile.preferences.countries[job.country] ?? cfg.defaultCountryPriority;
  const modeOk = job.workMode === 'unknown' || profile.preferences.workModes.length === 0 || profile.preferences.workModes.includes(job.workMode);
  add('location', countryPriority * 100 * (modeOk ? 1 : 0.8), `${job.country} priority ${Math.round(countryPriority * 100)}%; ${job.workMode}${modeOk ? '' : ' (not a preferred work mode)'}`);

  const cur = seniorityIndex(profile.currentSeniority);
  if (jobSen == null || cur == null) {
    add('career', null, 'Cannot assess progression (seniority unknown)');
  } else {
    const step = jobSen - cur;
    const progression = step >= 1 && step <= 2 ? 100 : step === 0 ? 70 : step > 2 ? 50 : 30;
    add('career', 0.7 * progression + 0.3 * areaPriority * 100, step > 0 ? `Step up of ${step} level(s)` : step === 0 ? 'Lateral move' : 'Step down');
  }

  if (!job.salary || profile.preferences.minAnnualSalaryEur == null) {
    add('compensation', null, job.salary ? 'Salary floor not set in preferences' : 'Salary not published');
  } else {
    const { min, max, currency, period } = job.salary;
    const top = Math.max(min ?? -Infinity, max ?? -Infinity);
    const annual = Number.isFinite(top) ? toAnnualEur(top, currency, period, cfg) : null;
    if (annual == null) add('compensation', null, `Cannot convert ${currency}`);
    else {
      const ratio = annual / profile.preferences.minAnnualSalaryEur;
      add('compensation', ratio >= 1 ? 100 : ratio >= 0.85 ? 60 : 20, `≈ €${Math.round(annual / 1000)}k/yr vs floor €${Math.round(profile.preferences.minAnnualSalaryEur / 1000)}k`);
    }
  }

  // weighted mean over evaluable components
  const evaluable = components.filter((c) => c.value != null && c.weight > 0);
  const totalWeight = components.reduce((s, c) => s + Math.max(0, c.weight), 0);
  const evalWeight = evaluable.reduce((s, c) => s + c.weight, 0);
  let overall = evalWeight > 0 ? evaluable.reduce((s, c) => s + c.value! * c.weight, 0) / evalWeight : 0;

  const missing = reqResults.filter((x) => x.status === 'not_met');
  const unknown = reqResults.filter((x) => x.status === 'unknown');
  const matched = reqResults.filter((x) => x.status === 'met');

  const missingMustTech = missing.filter(
    (x) => x.requirement.kind === 'must' && ['skill', 'certification', 'education', 'experience'].includes(x.requirement.category),
  );
  overall -= missingMustTech.length * cfg.missingMustPenalty;
  overall = Math.round(clamp(overall));

  // hard gates
  const blockers: string[] = [];
  if (eligibility.status === 'not_eligible') blockers.push(eligibility.detail);
  for (const x of missing) {
    if (x.requirement.kind !== 'must') continue;
    if (x.requirement.category === 'eligibility' && !blockers.includes(x.reason)) blockers.push(x.reason);
    if (x.requirement.category === 'language') blockers.push(`Mandatory language: ${x.requirement.text} — ${x.reason}`);
  }
  const eligibilityReqUnknown = reqResults.some((x) => x.requirement.category === 'eligibility' && x.status === 'unknown');
  // An explicit, unmet eligibility requirement (e.g. "EU work permit required") overrides the country-level view.
  const eligibilityStatus: EligibilityStatus = missing.some((m) => m.requirement.category === 'eligibility' && m.requirement.kind === 'must')
    ? 'not_eligible'
    : eligibility.status;

  // confidence
  let conf = totalWeight > 0 ? evalWeight / totalWeight : 0;
  if (reqResults.length) conf -= (unknown.length / reqResults.length) * 0.4;
  else conf -= 0.3;
  if (job.description.trim().length < 200) conf -= 0.15;
  conf -= dataIssues.length * 0.15;
  if (eligibilityStatus === 'unknown' || eligibilityStatus === 'requires_sponsorship' || eligibilityReqUnknown) conf -= 0.25;
  conf = Math.max(0, Math.min(1, conf));
  const confidence: Confidence = conf >= 0.7 ? 'high' : conf >= 0.45 ? 'medium' : 'low';

  // category
  const t = cfg.thresholds;
  let category: MatchCategory = blockers.length
    ? 'blocked'
    : overall >= t.excellent
      ? 'excellent'
      : overall >= t.high
        ? 'high'
        : overall >= t.moderate
          ? 'moderate'
          : 'low';
  // never "excellent" while authorisation is unresolved, or with ≥2 unmet must-haves
  if (category === 'excellent' && (eligibilityStatus !== 'eligible' || eligibilityReqUnknown)) category = 'high';
  if ((category === 'excellent' || category === 'high') && missingMustTech.length >= 2) category = 'moderate';
  // too little evidence to call it a strong match
  const coverage = totalWeight > 0 ? evalWeight / totalWeight : 0;
  const insufficient = coverage < MIN_COVERAGE || reqResults.length === 0;
  if (insufficient && (category === 'excellent' || category === 'high')) category = 'moderate';

  let recommendation: Recommendation;
  if (job.status === 'closed') recommendation = 'job_closed';
  else if (category === 'blocked') recommendation = 'do_not_apply';
  else if ((eligibilityStatus !== 'eligible' || eligibilityReqUnknown) && category !== 'low') recommendation = 'verify_eligibility';
  else if (category === 'excellent') recommendation = 'prioritize';
  else if (category === 'high') recommendation = 'apply';
  else if (category === 'moderate') recommendation = 'consider';
  else recommendation = 'low_priority';

  const explanation: string[] = [];
  explanation.push(`Fit score ${overall}/100 from ${evaluable.length} of ${components.length} evaluable components (config ${cfg.version}).`);
  if (matched.length) explanation.push(`${matched.length} requirement(s) met.`);
  if (missingMustTech.length) explanation.push(`${missingMustTech.length} mandatory requirement(s) not met (−${cfg.missingMustPenalty} each).`);
  if (unknown.length) explanation.push(`${unknown.length} requirement(s) could not be verified — treated as unknown, not as met.`);
  if (blockers.length) explanation.push(`Blocked: ${blockers.join(' ')}`);
  else explanation.push(`Eligibility: ${eligibility.detail}`);
  const skipped = components.filter((c) => c.value == null).map((c) => c.key);
  if (skipped.length) explanation.push(`Not evaluated (missing data): ${skipped.join(', ')}.`);
  if (insufficient) explanation.push('Insufficient data for a strong recommendation — category capped at "moderate".');
  if (dataIssues.length) explanation.push(`Data issues: ${dataIssues.join(' ')}`);
  if (job.careerOpsScore != null) explanation.push(`career-ops report score: ${job.careerOpsScore}/5 (shown separately, not merged).`);

  const technicalScore = technical == null ? null : Math.round(clamp(technical));
  const careerC = components.find((c) => c.key === 'career')!;

  return {
    jobId: job.id,
    overallScore: overall,
    technicalScore,
    careerScore: careerC.value == null ? null : Math.round(careerC.value),
    eligibilityStatus,
    eligibilityDetail: eligibility.detail,
    confidence,
    confidenceValue: Math.round(conf * 100) / 100,
    category,
    recommendation,
    matchedRequirements: matched,
    missingRequirements: missing,
    unknownRequirements: unknown,
    blockers,
    dataIssues,
    components,
    explanation,
    careerOpsScore: job.careerOpsScore,
    configVersion: cfg.version,
  };
}

export function matchAll(jobs: Job[], profile: CandidateProfile, config?: MatchingConfig): Map<string, MatchResult> {
  return new Map(jobs.map((j) => [j.id, matchJob(j, profile, config)]));
}
