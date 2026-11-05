import type { Application, PipelineStage, StageEvent } from '../../domain/types.ts';
import { addDays } from '../../application/period.ts';
import { DEMO_AS_OF } from './jobs.ts';

/**
 * DEMO applications. Each history is a list of [stage, daysAgo] pairs, all
 * after the job's discovery date, so funnel/KPI numbers stay consistent.
 * No real interviews, recruiters or submissions are represented.
 */
type Spec = [
  id: string,
  jobId: string,
  history: [PipelineStage, number][],
  nextAction: string | null,
  nextDueDaysFromNow: number | null,
  closedReason?: Application['closedReason'],
];

// prettier-ignore
const SPECS: Spec[] = [
  ['a01','d01',[['discovered',3],['qualified',2],['preparing',1]],'Adaptar CV (EN) e validar requisitos de idioma',2],
  ['a02','d03',[['discovered',2],['qualified',1]],'Rodar análise aprofundada (career-ops A–H)',1],
  ['a03','d05',[['discovered',1],['qualified',1],['preparing',0]],'Revisar evidências de gestão de portfólio',3],
  ['a04','d06',[['discovered',4],['qualified',3],['preparing',2],['ready_for_review',1]],'Revisão humana do pacote de candidatura',0],
  ['a05','d20',[['discovered',2],['qualified',1],['preparing',1],['ready_for_review',0]],'Revisão humana do pacote de candidatura',1],
  ['a06','d07',[['discovered',12],['qualified',11],['preparing',10],['ready_for_review',9],['submitted',8]],'Follow-up se sem resposta',6],
  ['a07','d09',[['discovered',5],['qualified',5],['preparing',4],['ready_for_review',3],['submitted',2]],'Aguardar retorno',12],
  ['a08','d21',[['discovered',35],['qualified',33],['preparing',31],['ready_for_review',30],['submitted',29],['responded',20]],'Responder solicitação de documentos',-1],
  ['a09','d22',[['discovered',45],['qualified',44],['preparing',42],['ready_for_review',41],['submitted',40],['responded',33],['interview',26]],'Preparar 2ª entrevista (STAR)',4],
  ['a10','d29',[['discovered',95],['qualified',93],['preparing',90],['ready_for_review',89],['submitted',88],['responded',80],['interview',70],['offer',10]],'Analisar proposta (negociação)',5],
  ['a11','d24',[['discovered',60],['qualified',58],['preparing',57],['ready_for_review',56],['submitted',55],['closed',40]],null,null,'rejected'],
  ['a12','d30',[['discovered',110],['qualified',108],['preparing',105],['ready_for_review',104],['submitted',103],['responded',95],['interview',85],['closed',70]],null,null,'rejected'],
  ['a13','d14',[['discovered',40],['qualified',39],['closed',38]],null,null,'discarded'],
  ['a14','d23',[['discovered',4],['qualified',3]],'Confirmar elegibilidade IT antes de preparar',2],
  ['a15','d31',[['discovered',1]],'Triagem: ler descrição completa',1],
  ['a16','d36',[['discovered',5]],'Triagem: verificar senioridade',2],
  ['a17','d26',[['discovered',50],['qualified',48],['preparing',46],['ready_for_review',45],['submitted',44],['responded',30]],'Agendar conversa com recrutador',3],
  ['a18','d34',[['discovered',13],['qualified',12],['preparing',11],['ready_for_review',10],['submitted',9]],'Aguardar retorno',10],
];

export function buildDemoApplications(asOf = DEMO_AS_OF): Application[] {
  return SPECS.map(([id, jobId, hist, nextAction, due, closedReason]) => {
    const history: StageEvent[] = hist.map(([stage, ago]) => ({ stage, at: addDays(asOf, -ago) }));
    const app: Application = {
      id,
      origin: 'demo',
      jobId,
      stage: history[history.length - 1]!.stage,
      history,
      nextAction,
      nextActionDue: due == null ? null : addDays(asOf, due),
      notes: 'DEMO — registro fictício.',
    };
    if (closedReason) app.closedReason = closedReason;
    return app;
  });
}
