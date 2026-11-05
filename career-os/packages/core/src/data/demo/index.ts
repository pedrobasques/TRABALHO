import type { Dataset } from '../../domain/types.ts';
import { AUTOMATION_CATALOG } from '../../automation/catalog.ts';
import { buildDemoApplications } from './applications.ts';
import { buildDemoJobs, DEMO_AS_OF } from './jobs.ts';
import { DEMO_PROFILE } from './profile.ts';

export { DEMO_AS_OF } from './jobs.ts';

/** The single, internally consistent DEMO dataset used by every screen. */
export function buildDemoDataset(asOf = DEMO_AS_OF): Dataset {
  return {
    origin: 'demo',
    asOf,
    jobs: buildDemoJobs(asOf),
    applications: buildDemoApplications(asOf),
    profile: DEMO_PROFILE,
    automations: AUTOMATION_CATALOG,
    runs: [],
    sourceNotes: [
      'Dados DEMONSTRATIVOS: empresas, vagas, candidaturas e perfil são fictícios.',
      'Nenhuma vaga possui link real; nenhum salário ou data representa o mercado.',
    ],
  };
}
export { DEMO_PROFILE } from './profile.ts';
export { buildDemoJobs } from './jobs.ts';
