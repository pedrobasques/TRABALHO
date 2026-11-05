import type { CandidateProfile } from '../../domain/types.ts';

/**
 * DEMO candidate profile — synthetic, NOT the owner's CV.
 * It is shaped like the target domain (projects / industrial / digital
 * manufacturing) so the matching engine has something realistic to work on,
 * but every value is invented and labelled DEMO in the UI. Several facts are
 * deliberately marked `pending_validation` / `in_progress` to exercise the
 * "unknown is not met" rules.
 */
export const DEMO_PROFILE: CandidateProfile = {
  origin: 'demo',
  displayName: 'Perfil demonstrativo',
  headline: 'Engenharia de projetos industriais · PMO · Transformação digital',
  summary:
    'Perfil fictício usado para demonstrar o motor de matching. Substitua importando seu cv.md e config/profile.yml do career-ops (Fase 1.5).',
  yearsExperience: 7,
  currentSeniority: 'senior',
  targetSeniority: ['senior', 'lead', 'manager'],
  skills: [
    { key: 'project_management', label: 'Project management', level: 4, provenance: 'proven', aliases: ['pm', 'gestao de projetos'] },
    { key: 'pmo', label: 'PMO / governança de portfólio', level: 4, provenance: 'proven' },
    { key: 'continuous_improvement', label: 'Melhoria contínua', level: 4, provenance: 'proven', aliases: ['kaizen'] },
    { key: 'process_engineering', label: 'Engenharia de processos', level: 3, provenance: 'proven' },
    { key: 'power_bi', label: 'Power BI', level: 4, provenance: 'declared' },
    { key: 'power_apps', label: 'Power Apps', level: 4, provenance: 'declared' },
    { key: 'power_automate', label: 'Power Automate', level: 4, provenance: 'declared' },
    { key: 'sharepoint', label: 'SharePoint / M365', level: 3, provenance: 'declared' },
    { key: 'data_analysis', label: 'Análise de dados', level: 3, provenance: 'declared' },
    { key: 'supply_chain', label: 'Supply chain / logística', level: 3, provenance: 'proven' },
    { key: 'automotive', label: 'Setor automotivo', level: 3, provenance: 'proven' },
    { key: 'ai_agents', label: 'Agentes de IA / Copilot Studio', level: 3, provenance: 'declared', aliases: ['copilot_studio'] },
    { key: 'lean_six_sigma', label: 'Lean Six Sigma', level: 3, provenance: 'pending_validation' },
    { key: 'stakeholder_management', label: 'Gestão de stakeholders', level: 4, provenance: 'interpretation' },
    { key: 'python', label: 'Python', level: 2, provenance: 'pending_validation' },
  ],
  languages: [
    { code: 'pt', label: 'Português', level: 'native', provenance: 'declared' },
    { code: 'en', label: 'Inglês', level: 'C1', provenance: 'declared' },
    { code: 'es', label: 'Espanhol', level: 'B1', provenance: 'pending_validation' },
    { code: 'it', label: 'Italiano', level: 'A2', provenance: 'declared' },
  ],
  eligibility: [
    { country: 'BR', status: 'authorized', basis: 'DEMO — nacionalidade' },
    { country: 'IT', status: 'in_progress', basis: 'DEMO — cidadania em processo' },
    { country: 'US', status: 'not_authorized', basis: null },
    { country: 'AU', status: 'not_authorized', basis: null },
  ],
  education: [
    { id: 'edu-1', institution: 'Universidade (DEMO)', degree: 'Engenharia Mecânica', key: 'engineering_degree', status: 'completed', provenance: 'declared' },
    { id: 'edu-2', institution: 'Universidade (DEMO)', degree: 'MBA em Gerenciamento de Projetos', key: 'mba', status: 'unverified', provenance: 'pending_validation' },
  ],
  experience: [
    { id: 'exp-1', company: 'Empresa A (DEMO)', role: 'Engenheiro de Projetos / PMO', start: '2021-03', end: null, summary: 'Experiência fictícia para demonstração.', provenance: 'declared' },
    { id: 'exp-2', company: 'Empresa B (DEMO)', role: 'Engenheiro de Processos', start: '2018-01', end: '2021-02', summary: 'Experiência fictícia para demonstração.', provenance: 'declared' },
  ],
  achievements: [
    {
      id: 'ach-1',
      description: 'Implantação de app Power Apps para controle de projetos (exemplo sem métricas — resultado a validar).',
      company: 'Empresa A (DEMO)',
      period: '2023',
      skills: ['power_apps', 'pmo'],
      evidence: [],
      provenance: 'pending_validation',
    },
    {
      id: 'ach-2',
      description: 'Condução de workshops kaizen em linha de montagem (exemplo).',
      company: 'Empresa B (DEMO)',
      period: '2019–2020',
      skills: ['continuous_improvement'],
      evidence: ['Relatório interno (não anexável — confidencial)'],
      provenance: 'declared',
    },
  ],
  certifications: [{ key: 'pmp', label: 'PMP', provenance: 'pending_validation' }],
  preferences: {
    countries: { IT: 1, BR: 0.9, DE: 0.9, ES: 0.8, NL: 0.8, BE: 0.7, GB: 0.7, AU: 0.7, US: 0.6 },
    areas: {
      project_management: 1,
      industrial_engineering: 0.9,
      digital_manufacturing: 0.9,
      operational_excellence: 0.7,
      process_engineering: 0.7,
      automation: 0.7,
      supply_chain: 0.5,
    },
    workModes: ['onsite', 'hybrid', 'remote'],
    minAnnualSalaryEur: 50000,
  },
  goals: ['Gerência de projetos de engenharia em ambiente internacional', 'Transformação digital industrial'],
};
