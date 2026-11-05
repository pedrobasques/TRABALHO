import type { Dataset, IsoDate } from '../domain/types.ts';
import type { MatchResult } from '../matching/engine.ts';
import { toTime } from './period.ts';

export type ActionKind = 'triage' | 'review' | 'eligibility' | 'profile' | 'interview' | 'followup' | 'automation';

export interface ActionItem {
  id: string;
  kind: ActionKind;
  title: string;
  detail: string;
  due: IsoDate | null;
  overdue: boolean;
  href: string;
  priority: number; // lower = more urgent
}

/** Derives the Action Center queue from the dataset — nothing is hand-written. */
export function buildActions(ds: Dataset, matches: Map<string, MatchResult>): ActionItem[] {
  const items: ActionItem[] = [];
  const jobById = new Map(ds.jobs.map((j) => [j.id, j]));
  const tracked = new Set(ds.applications.map((a) => a.jobId));
  const now = toTime(ds.asOf);

  for (const j of ds.jobs) {
    const m = matches.get(j.id);
    if (!m || tracked.has(j.id) || j.status === 'closed') continue;
    if (m.category === 'excellent' || m.category === 'high') {
      items.push({ id: `triage-${j.id}`, kind: 'triage', title: `Analisar: ${j.title}`, detail: `${j.company} · score ${m.overallScore}`, due: null, overdue: false, href: `/jobs/${j.id}`, priority: 3 });
    }
  }
  for (const a of ds.applications) {
    const j = jobById.get(a.jobId);
    if (!j) continue;
    const overdue = a.nextActionDue != null && toTime(a.nextActionDue) < now;
    if (a.stage === 'ready_for_review') {
      items.push({ id: `review-${a.id}`, kind: 'review', title: `Revisar candidatura: ${j.title}`, detail: `${j.company} — aguardando aprovação humana`, due: a.nextActionDue, overdue, href: `/applications?open=${a.id}`, priority: 1 });
    } else if (a.stage === 'interview') {
      items.push({ id: `int-${a.id}`, kind: 'interview', title: `Entrevista: ${j.title}`, detail: a.nextAction ?? j.company, due: a.nextActionDue, overdue, href: `/applications?open=${a.id}`, priority: 1 });
    } else if (a.stage !== 'closed' && a.nextAction) {
      const m = matches.get(j.id);
      const elig = m && m.recommendation === 'verify_eligibility';
      items.push({ id: `next-${a.id}`, kind: elig ? 'eligibility' : 'followup', title: a.nextAction, detail: `${j.title} · ${j.company}`, due: a.nextActionDue, overdue, href: `/applications?open=${a.id}`, priority: overdue ? 0 : 2 });
    }
  }
  const pending = [
    ...ds.profile.skills.filter((s) => s.provenance === 'pending_validation').map((s) => s.label),
    ...ds.profile.languages.filter((l) => l.provenance === 'pending_validation').map((l) => l.label),
    ...ds.profile.education.filter((e) => e.provenance === 'pending_validation').map((e) => e.degree),
    ...ds.profile.certifications.filter((c) => c.provenance === 'pending_validation').map((c) => c.label),
  ];
  if (pending.length) {
    items.push({ id: 'profile-pending', kind: 'profile', title: `${pending.length} informações do perfil pendentes de validação`, detail: pending.slice(0, 4).join(', ') + (pending.length > 4 ? '…' : ''), due: null, overdue: false, href: '/profile', priority: 2 });
  }
  for (const a of ds.automations.filter((x) => x.state === 'blocked')) {
    items.push({ id: `auto-${a.id}`, kind: 'automation', title: `Automação bloqueada: ${a.name}`, detail: a.blockedBy ?? '', due: null, overdue: false, href: '/automations', priority: 4 });
  }
  for (const r of ds.runs.filter((x) => x.status === 'failed')) {
    items.push({ id: `run-${r.id}`, kind: 'automation', title: `Falha de execução: ${r.jobId}`, detail: r.summary, due: r.finishedAt, overdue: false, href: '/automations', priority: 1 });
  }
  return items.sort((a, b) => a.priority - b.priority || (a.due ?? '9999').localeCompare(b.due ?? '9999'));
}
