/**
 * Career OS domain model.
 *
 * Plain data types only (no classes) so they serialise across the
 * Next.js server/client boundary and can be produced by any adapter
 * (demo fixtures, career-ops files, a future database).
 */

/** ISO 3166-1 alpha-2 country code, upper case (e.g. "BR", "IT"). */
export type CountryCode = string;

/** ISO date (YYYY-MM-DD) or full ISO timestamp. */
export type IsoDate = string;

export type WorkMode = 'onsite' | 'hybrid' | 'remote' | 'unknown';

export type Seniority =
  | 'junior'
  | 'mid'
  | 'senior'
  | 'lead'
  | 'manager'
  | 'director'
  | 'unknown';

export const SENIORITY_ORDER: readonly Seniority[] = [
  'junior',
  'mid',
  'senior',
  'lead',
  'manager',
  'director',
];

export type JobArea =
  | 'project_management'
  | 'industrial_engineering'
  | 'digital_manufacturing'
  | 'operational_excellence'
  | 'supply_chain'
  | 'process_engineering'
  | 'automation'
  | 'other';

export type JobStatus = 'open' | 'closed' | 'unverified';

/** Where a record came from. `demo` records must always be labelled in the UI. */
export type DataOrigin = 'demo' | 'career-ops' | 'manual';

export type RequirementKind = 'must' | 'nice';

export type RequirementCategory =
  | 'skill'
  | 'experience'
  | 'language'
  | 'education'
  | 'eligibility'
  | 'certification';

/** CEFR levels plus native. */
export type LanguageLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'native';

export const LANGUAGE_LEVEL_ORDER: readonly LanguageLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
  'native',
];

export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  category: RequirementCategory;
  /** Canonical skill / certification / degree key for skill-like categories. */
  key?: string;
  /** For `language`: ISO 639-1 code + minimum level. */
  language?: { code: string; level: LanguageLevel };
  /** For `experience`: minimum years. */
  minYears?: number;
  /** For `eligibility`: the country whose work authorisation is required. */
  country?: CountryCode;
}

export interface Salary {
  min: number | null;
  max: number | null;
  currency: string;
  period: 'year' | 'month' | 'hour';
}

export interface JobSource {
  name: string;
  /** Native identifier in the source ATS (requisition id / listing key), when published. */
  externalId?: string | null;
  /** Original posting URL. `null` for demo records — never invent real links. */
  url: string | null;
}

export interface Job {
  id: string;
  origin: DataOrigin;
  title: string;
  /** Normalised family used for filtering ("Project Manager", "Process Engineer", …). */
  normalizedTitle: string;
  company: string;
  sector: string;
  area: JobArea;
  country: CountryCode;
  city: string | null;
  workMode: WorkMode;
  seniority: Seniority;
  description: string;
  requirements: Requirement[];
  salary: Salary | null;
  postedAt: IsoDate | null;
  discoveredAt: IsoDate;
  verifiedAt: IsoDate | null;
  status: JobStatus;
  source: JobSource;
  /** Native career-ops global score (1–5) when an A–H report exists. Kept on its own scale. */
  careerOpsScore: number | null;
  /** Visa sponsorship explicitly offered / refused / not stated. */
  visaSponsorship: 'offered' | 'not_offered' | 'unknown';
  /** Data-quality gaps found during normalization (real sources only). */
  qualityIssues?: string[];
}

/* ---------------------------------------------------------------- profile */

/** Provenance of a professional fact (see docs/DATA_MODEL.md). */
export type Provenance = 'proven' | 'declared' | 'interpretation' | 'pending_validation';

export interface ProfileSkill {
  key: string;
  label: string;
  /** 1 (basic) … 5 (expert); null when the source does not state it (never defaulted). */
  level: number | null;
  provenance: Provenance;
  aliases?: string[];
}

export type EligibilityState = 'authorized' | 'not_authorized' | 'in_progress' | 'unknown';

export interface CountryEligibility {
  country: CountryCode;
  status: EligibilityState;
  basis: string | null;
}

export interface Achievement {
  id: string;
  description: string;
  company: string;
  period: string;
  skills: string[];
  evidence: string[];
  provenance: Provenance;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  start: string;
  end: string | null;
  summary: string;
  provenance: Provenance;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  key: string;
  status: 'completed' | 'in_progress' | 'unverified';
  provenance: Provenance;
}

export interface CandidateProfile {
  origin: DataOrigin;
  displayName: string;
  headline: string;
  summary: string;
  /** Total relevant years of experience; null = unknown. */
  yearsExperience: number | null;
  currentSeniority: Seniority;
  targetSeniority: Seniority[];
  skills: ProfileSkill[];
  languages: { code: string; label: string; level: LanguageLevel | null; provenance: Provenance }[];
  eligibility: CountryEligibility[];
  education: Education[];
  experience: Experience[];
  achievements: Achievement[];
  certifications: { key: string; label: string; provenance: Provenance }[];
  preferences: {
    /** Country → priority 0..1 (1 = top). Missing = 0.3 (open to exceptional). */
    countries: Record<CountryCode, number>;
    /** Area → priority 0..1. */
    areas: Partial<Record<JobArea, number>>;
    workModes: WorkMode[];
    /** Minimum acceptable annual salary in EUR-equivalent; null = not set. */
    minAnnualSalaryEur: number | null;
  };
  goals: string[];
  /** Present when the profile was imported from real files: what is missing, estimates, and which files were read. */
  importReport?: { unknowns: string[]; notes: string[]; sources: string[] };
}

/* ------------------------------------------------------------ applications */

export type PipelineStage =
  | 'discovered'
  | 'qualified'
  | 'preparing'
  | 'ready_for_review'
  | 'submitted'
  | 'responded'
  | 'interview'
  | 'offer'
  | 'closed';

/** Linear order of the active stages (closed is terminal and off-axis). */
export const STAGE_ORDER: readonly PipelineStage[] = [
  'discovered',
  'qualified',
  'preparing',
  'ready_for_review',
  'submitted',
  'responded',
  'interview',
  'offer',
];

export interface StageEvent {
  stage: PipelineStage;
  at: IsoDate;
  note?: string;
  /** Write-back state towards the career-ops tracker (ADR-008); absent for source records. */
  sync?: 'pending' | 'applied' | 'not_applicable' | 'failed' | 'external';
  syncDetail?: string | null;
  actor?: string;
}

export interface Application {
  id: string;
  origin: DataOrigin;
  jobId: string;
  stage: PipelineStage;
  /** Chronological stage history; the last event equals `stage`. */
  history: StageEvent[];
  nextAction: string | null;
  nextActionDue: IsoDate | null;
  closedReason?: 'rejected' | 'withdrawn' | 'discarded' | 'hired' | 'expired';
  /** Free-text notes from career-ops or the user. */
  notes: string;
}

/* ------------------------------------------------------------- automation */

export interface AutomationJob {
  id: string;
  name: string;
  kind: 'scan' | 'liveness' | 'matching' | 'report' | 'sync' | 'diagnostic';
  level: 1 | 2 | 3 | 4 | 5;
  schedule: string | null;
  enabled: boolean;
  state: 'not_configured' | 'manual' | 'scheduled' | 'blocked';
  blockedBy: string | null;
  command: string | null;
  description: string;
}

export interface AutomationRun {
  id: string;
  jobId: string;
  startedAt: IsoDate;
  finishedAt: IsoDate | null;
  status: 'ok' | 'failed' | 'partial';
  summary: string;
}

/** Everything the dashboard needs, produced by one data source. */
export interface Dataset {
  origin: DataOrigin;
  /** Reference "now" for period calculations (demo data uses a fixed date). */
  asOf: IsoDate;
  jobs: Job[];
  applications: Application[];
  profile: CandidateProfile;
  automations: AutomationJob[];
  runs: AutomationRun[];
  /** Human-readable notes about the source (e.g. which files were read, what was missing). */
  sourceNotes: string[];
}
