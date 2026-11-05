import type { JobArea, JobStatus, PipelineStage, Seniority, WorkMode, Provenance } from '../domain/types.ts';
import type { EligibilityStatus, MatchCategory, Recommendation, Confidence, RequirementStatus } from '../matching/engine.ts';
import type { ComponentKey } from '../matching/config.ts';

export const AREA_LABEL: Record<JobArea, string> = {
  project_management: 'Gestão de Projetos / PMO',
  industrial_engineering: 'Engenharia Industrial',
  digital_manufacturing: 'Manufatura Digital / Ind. 4.0',
  operational_excellence: 'Excelência Operacional',
  supply_chain: 'Supply Chain / Logística',
  process_engineering: 'Engenharia de Processos',
  automation: 'Automação',
  other: 'Outras',
};

export const SENIORITY_LABEL: Record<Seniority, string> = {
  junior: 'Júnior',
  mid: 'Pleno',
  senior: 'Sênior',
  lead: 'Lead',
  manager: 'Gerente',
  director: 'Diretor',
  unknown: 'Não informado',
};

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  onsite: 'Presencial',
  hybrid: 'Híbrido',
  remote: 'Remoto',
  unknown: 'Não informado',
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  open: 'Aberta',
  closed: 'Encerrada',
  unverified: 'Não verificada',
};

export const STAGE_LABEL: Record<PipelineStage, string> = {
  discovered: 'Descoberta',
  qualified: 'Qualificada',
  preparing: 'Preparação',
  ready_for_review: 'Pronta p/ revisão',
  submitted: 'Enviada',
  responded: 'Resposta recebida',
  interview: 'Entrevista',
  offer: 'Oferta',
  closed: 'Encerrada',
};

export const CATEGORY_LABEL: Record<MatchCategory, string> = {
  excellent: 'Excelente oportunidade',
  high: 'Alta aderência',
  moderate: 'Aderência moderada',
  low: 'Baixa prioridade',
  blocked: 'Bloqueada',
};

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  prioritize: 'Priorizar candidatura',
  apply: 'Candidatar-se',
  consider: 'Avaliar com cautela',
  verify_eligibility: 'Verificar elegibilidade antes',
  low_priority: 'Baixa prioridade',
  do_not_apply: 'Não recomendada',
  job_closed: 'Vaga encerrada',
  insufficient_data: 'Dados insuficientes para avaliação',
};

export const ELIGIBILITY_LABEL: Record<EligibilityStatus, string> = {
  eligible: 'Elegível',
  requires_sponsorship: 'Requer patrocínio',
  not_eligible: 'Não elegível',
  unknown: 'Não confirmada',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export const REQ_STATUS_LABEL: Record<RequirementStatus, string> = {
  met: 'Atendido',
  not_met: 'Não atendido',
  unknown: 'Desconhecido',
};

export const COMPONENT_LABEL: Record<ComponentKey, string> = {
  technical: 'Técnico',
  experience: 'Experiência',
  area: 'Área',
  seniority: 'Senioridade',
  location: 'Localização',
  language: 'Idioma',
  career: 'Carreira',
  compensation: 'Remuneração',
};

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  proven: 'Comprovado',
  declared: 'Declarado',
  interpretation: 'Interpretação',
  pending_validation: 'Pendente de validação',
};

const COUNTRY_NAMES: Record<string, string> = {
  BR: 'Brasil',
  IT: 'Itália',
  DE: 'Alemanha',
  ES: 'Espanha',
  NL: 'Países Baixos',
  BE: 'Bélgica',
  GB: 'Reino Unido',
  US: 'Estados Unidos',
  AU: 'Austrália',
  PT: 'Portugal',
  FR: 'França',
  CH: 'Suíça',
  IE: 'Irlanda',
  CA: 'Canadá',
};

export function countryName(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return 'País não informado';
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

export function countryFlag(code: string): string {
  const c = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
