'use client';

import Link from 'next/link';
import { Building2, MapPin, ShieldAlert, ShieldCheck, ShieldQuestion, Star } from 'lucide-react';
import {
  CATEGORY_LABEL,
  ELIGIBILITY_LABEL,
  JOB_STATUS_LABEL,
  PROVENANCE_LABEL,
  RECOMMENDATION_LABEL,
  SENIORITY_LABEL,
  STAGE_LABEL,
  WORK_MODE_LABEL,
  countryFlag,
  countryName,
  type EligibilityStatus,
  type Job,
  type JobStatus,
  type MatchCategory,
  type MatchResult,
  type PipelineStage,
  type Provenance,
  type Recommendation,
} from '@career-os/core';
import { cn } from '@/lib/format';
import { ScoreIndicator, StatusBadge, type Tone } from './primitives';

export const CATEGORY_TONE: Record<MatchCategory, Tone> = { excellent: 'success', high: 'accent', moderate: 'warning', low: 'neutral', blocked: 'danger' };
export const ELIGIBILITY_TONE: Record<EligibilityStatus, Tone> = { eligible: 'success', requires_sponsorship: 'warning', not_eligible: 'danger', unknown: 'warning' };
export const STAGE_TONE: Record<PipelineStage, Tone> = {
  discovered: 'neutral', qualified: 'info', preparing: 'info', ready_for_review: 'warning', submitted: 'accent', responded: 'accent', interview: 'success', offer: 'success', closed: 'neutral',
};
export const RECO_TONE: Record<Recommendation, Tone> = {
  prioritize: 'success', apply: 'accent', consider: 'warning', verify_eligibility: 'warning', low_priority: 'neutral', do_not_apply: 'danger', job_closed: 'neutral',
};
export const PROVENANCE_TONE: Record<Provenance, Tone> = { proven: 'success', declared: 'accent', interpretation: 'info', pending_validation: 'warning' };

export const CategoryBadge = ({ c }: { c: MatchCategory }) => <StatusBadge tone={CATEGORY_TONE[c]}>{CATEGORY_LABEL[c]}</StatusBadge>;
export const StageBadge = ({ s }: { s: PipelineStage }) => <StatusBadge tone={STAGE_TONE[s]} dot>{STAGE_LABEL[s]}</StatusBadge>;
export const RecoBadge = ({ r }: { r: Recommendation }) => <StatusBadge tone={RECO_TONE[r]}>{RECOMMENDATION_LABEL[r]}</StatusBadge>;
export const ProvenanceBadge = ({ p }: { p: Provenance }) => <StatusBadge tone={PROVENANCE_TONE[p]}>{PROVENANCE_LABEL[p]}</StatusBadge>;
export const JobStatusBadge = ({ s }: { s: JobStatus }) => (
  <StatusBadge tone={s === 'open' ? 'success' : s === 'closed' ? 'neutral' : 'warning'} dot>
    {JOB_STATUS_LABEL[s]}
  </StatusBadge>
);

export function EligibilityBadge({ e, detail }: { e: EligibilityStatus; detail?: string }) {
  const Icon = e === 'eligible' ? ShieldCheck : e === 'not_eligible' ? ShieldAlert : ShieldQuestion;
  return (
    <StatusBadge tone={ELIGIBILITY_TONE[e]} title={detail}>
      <Icon className="size-3" aria-hidden />
      {ELIGIBILITY_LABEL[e]}
    </StatusBadge>
  );
}

export function CountryLabel({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <span aria-hidden>{countryFlag(code)}</span>
      {countryName(code)}
    </span>
  );
}

export function OpportunityCard({ job, match, favorite, compact }: { job: Job; match: MatchResult; favorite?: boolean; compact?: boolean }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group flex items-center gap-3.5 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-surface-hover"
      data-testid="opportunity-card"
    >
      <ScoreIndicator score={match.overallScore} size="sm" blocked={match.category === 'blocked'} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-fg group-hover:text-accent">{job.title}</span>
          {favorite && <Star className="size-3 shrink-0 fill-warning text-warning" aria-label="Favorita" />}
        </div>
        {match.category !== 'blocked' && match.eligibilityStatus !== 'eligible' && match.overallScore >= 65 && (
          <div className="mt-0.5 text-[11px] font-medium text-warning" data-testid="eligibility-pending">
            Aderência alta, mas autorização de trabalho {match.eligibilityStatus === 'requires_sponsorship' ? 'depende de patrocínio' : 'não confirmada'} — verificar antes de aplicar
          </div>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3" aria-hidden />
            {job.company}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" aria-hidden />
            <CountryLabel code={job.country} />
          </span>
          {!compact && <span>{SENIORITY_LABEL[job.seniority]}</span>}
          {!compact && <span>{WORK_MODE_LABEL[job.workMode]}</span>}
        </div>
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <EligibilityBadge e={match.eligibilityStatus} detail={match.eligibilityDetail} />
        {match.confidence === 'low' && <StatusBadge tone="warning" title="Poucos dados na vaga — score pouco confiável">confiança baixa</StatusBadge>}
        {!compact && match.technicalScore != null && <span className="tabular text-[11px] text-subtle">técnico {match.technicalScore}</span>}
      </div>
    </Link>
  );
}
