import type { Job, JobArea, LanguageLevel, Requirement, Salary, Seniority, WorkMode } from '../../domain/types.ts';
import { addDays } from '../../application/period.ts';

/** Reference date of the demo dataset — all relative dates are computed from it. */
export const DEMO_AS_OF = '2026-11-01';

/**
 * Requirement shorthand:
 *   "m:skill_key"           must-have skill        "n:skill_key"  nice-to-have
 *   "mc:pmp" / "nc:pmp"     certification
 *   "me:engineering_degree" education (must)     "ne:…" nice
 *   "x:5"                   ≥5 years experience (must)
 *   "l:m:en:C1"             language (must|nice) code level
 *   "w:IT"                  must hold work authorisation for country
 */
const SKILL_TEXT: Record<string, string> = {
  project_management: 'Gestão de projetos de engenharia',
  pmo: 'Governança PMO / portfólio',
  continuous_improvement: 'Melhoria contínua (Lean/Kaizen)',
  process_engineering: 'Engenharia de processos',
  power_bi: 'Power BI',
  power_apps: 'Power Apps',
  power_automate: 'Power Automate',
  sharepoint: 'SharePoint / M365',
  data_analysis: 'Análise de dados',
  supply_chain: 'Supply chain',
  automotive: 'Experiência no setor automotivo',
  ai_agents: 'IA aplicada / agentes',
  lean_six_sigma: 'Lean Six Sigma (Green/Black Belt)',
  stakeholder_management: 'Gestão de stakeholders',
  python: 'Python',
  sap: 'SAP (PP/MM)',
  plc: 'Programação de CLP (PLC)',
  mes: 'Sistemas MES',
  mining: 'Experiência em mineração',
  capex: 'Gestão de projetos CAPEX',
  agile: 'Metodologias ágeis',
  wms: 'WMS / sistemas de armazém',
  simulation: 'Simulação de processos',
  pmp: 'Certificação PMP',
  engineering_degree: 'Graduação em Engenharia',
  mba: 'MBA / pós-graduação',
};
const LANG_TEXT: Record<string, string> = { en: 'Inglês', de: 'Alemão', it: 'Italiano', es: 'Espanhol', nl: 'Holandês', pt: 'Português', fr: 'Francês' };

function reqs(id: string, spec: string): Requirement[] {
  return spec
    .split(' ')
    .filter(Boolean)
    .map((tok, i): Requirement => {
      const rid = `${id}-r${i + 1}`;
      const [a, b, c, d] = tok.split(':');
      switch (a) {
        case 'm':
        case 'n':
          return { id: rid, kind: a === 'm' ? 'must' : 'nice', category: 'skill', key: b!, text: SKILL_TEXT[b!] ?? b! };
        case 'mc':
        case 'nc':
          return { id: rid, kind: a === 'mc' ? 'must' : 'nice', category: 'certification', key: b!, text: SKILL_TEXT[b!] ?? b! };
        case 'me':
        case 'ne':
          return { id: rid, kind: a === 'me' ? 'must' : 'nice', category: 'education', key: b!, text: SKILL_TEXT[b!] ?? b! };
        case 'x':
          return { id: rid, kind: 'must', category: 'experience', minYears: Number(b), text: `${b}+ anos de experiência relevante` };
        case 'l':
          return {
            id: rid,
            kind: b === 'm' ? 'must' : 'nice',
            category: 'language',
            language: { code: c!, level: d as LanguageLevel },
            text: `${LANG_TEXT[c!] ?? c} ${d}`,
          };
        case 'w':
          return { id: rid, kind: 'must', category: 'eligibility', country: b!, text: `Autorização de trabalho em ${b}` };
        default:
          throw new Error(`bad requirement token ${tok}`);
      }
    });
}

type Row = [
  id: string,
  title: string,
  family: string,
  company: string,
  sector: string,
  area: JobArea,
  country: string,
  city: string | null,
  mode: WorkMode,
  seniority: Seniority,
  discoveredDaysAgo: number,
  postedDaysAgo: number | null,
  status: Job['status'],
  salary: Salary | null,
  visa: Job['visaSponsorship'],
  requirements: string,
  careerOpsScore: number | null,
];

const yr = (min: number | null, max: number | null, currency: string): Salary => ({ min, max, currency, period: 'year' });
const mo = (min: number | null, max: number | null, currency: string): Salary => ({ min, max, currency, period: 'month' });

// prettier-ignore
const ROWS: Row[] = [
  ['d01','Engineering Project Manager','Project Manager','Northwind Automotive','Automotivo','project_management','IT','Turim','hybrid','manager',3,5,'open',yr(65000,80000,'EUR'),'unknown','m:project_management m:automotive x:6 l:m:en:C1 l:n:it:B2 n:power_bi nc:pmp me:engineering_degree w:IT',4.4],
  ['d02','Industrial Project Engineer','Project Engineer','Tessaro Engineering','Engenharia','industrial_engineering','IT','Milão','onsite','senior',6,8,'open',null,'unknown','m:project_management m:process_engineering l:m:it:B2 l:m:en:B2 n:capex me:engineering_degree',null],
  ['d03','PMO Lead — Manufacturing','PMO Lead','Meridian Manufacturing','Manufatura','project_management','DE','Stuttgart','hybrid','lead',2,4,'open',yr(78000,92000,'EUR'),'offered','m:pmo m:project_management l:m:en:C1 l:n:de:B2 n:power_bi n:sap x:5',4.2],
  ['d04','Digital Manufacturing Manager','Digital Manufacturing Manager','Kestrel Robotics','Robótica','digital_manufacturing','DE','Munique','onsite','manager',9,12,'open',yr(85000,100000,'EUR'),'not_offered','m:mes m:project_management l:m:de:C1 l:m:en:B2 n:plc x:8',null],
  ['d05','Gerente de Projetos de Engenharia','Project Manager','Aurora Components','Automotivo','project_management','BR','Betim','onsite','manager',1,2,'open',mo(22000,28000,'BRL'),'unknown','m:project_management m:automotive m:pmo x:7 l:m:en:B2 n:power_bi nc:pmp me:engineering_degree',null],
  ['d06','Coordenador de PMO','PMO Lead','Ironbridge Steel','Siderurgia','project_management','BR','Belo Horizonte','hybrid','lead',4,6,'open',mo(18000,23000,'BRL'),'unknown','m:pmo m:power_bi m:project_management n:power_apps n:sharepoint l:n:en:B2 x:5',4.0],
  ['d07','Especialista em Melhoria Contínua','Continuous Improvement Lead','Riverstone Foods','Alimentos','operational_excellence','BR','São Paulo','hybrid','senior',12,15,'open',mo(15000,19000,'BRL'),'unknown','m:continuous_improvement m:lean_six_sigma n:power_bi n:data_analysis x:4',null],
  ['d08','Engenheiro de Projetos — Mineração','Project Engineer','Atlas Mining Co.','Mineração','industrial_engineering','BR','Itabira','onsite','senior',20,22,'open',mo(16000,20000,'BRL'),'unknown','m:project_management m:mining m:capex l:n:en:B2 me:engineering_degree x:5',null],
  ['d09','Operational Excellence Manager','Operational Excellence Manager','Fjord Industrial','Industrial','operational_excellence','NL','Eindhoven','hybrid','manager',5,7,'open',yr(80000,95000,'EUR'),'offered','m:continuous_improvement m:lean_six_sigma l:m:en:C1 n:data_analysis x:7',null],
  ['d10','Technical Project Manager — Automation','Technical Project Manager','Lumen Process Systems','Automação','automation','NL','Roterdã','hybrid','senior',15,18,'open',null,'unknown','m:project_management m:plc l:m:en:C1 l:n:nl:B1 n:agile x:5',null],
  ['d11','Supply Chain Engineering Lead','Supply Chain Engineer','Orbis Logistics','Logística','supply_chain','ES','Barcelona','hybrid','lead',8,10,'open',yr(55000,65000,'EUR'),'unknown','m:supply_chain m:wms l:m:es:B2 l:m:en:B2 n:power_bi n:simulation',null],
  ['d12','Industry 4.0 Program Manager','Program Manager','Vertex Mobility','Automotivo','digital_manufacturing','ES','Valência','onsite','manager',25,30,'open',yr(70000,85000,'EUR'),'unknown','m:project_management m:mes m:automotive l:m:es:C1 l:m:en:C1 n:ai_agents x:8',null],
  ['d13','Manufacturing Project Manager','Project Manager','Helix Energy','Energia','project_management','BE','Antuérpia','onsite','manager',18,20,'open',yr(72000,88000,'EUR'),'unknown','m:project_management m:capex l:m:en:C1 l:n:fr:B1 x:7 me:engineering_degree',null],
  ['d14','Process Engineer — Battery Plant','Process Engineer','Solara Renewables','Energia','process_engineering','DE','Berlim','onsite','mid',40,45,'closed',null,'unknown','m:process_engineering l:m:de:B2 n:simulation x:3',null],
  ['d15','Senior Project Engineer — Rail','Project Engineer','Cobalt Rail','Ferroviário','industrial_engineering','GB','Glasgow','hybrid','senior',11,13,'open',yr(52000,62000,'GBP'),'not_offered','m:project_management l:m:en:C1 w:GB x:5 nc:pmp',null],
  ['d16','Engineering Program Manager','Program Manager','Pinnacle Aerospace Parts','Aeroespacial','project_management','US','Wichita','onsite','manager',7,9,'open',yr(125000,150000,'USD'),'not_offered','m:project_management m:pmo l:m:en:C1 w:US x:8 mc:pmp',null],
  ['d17','Industrial Engineering Manager','Industrial Engineering Manager','Northwind Automotive','Automotivo','industrial_engineering','US','Detroit','onsite','manager',14,16,'open',yr(115000,135000,'USD'),'offered','m:process_engineering m:automotive m:lean_six_sigma l:m:en:C1 x:8',null],
  ['d18','Project Manager — Mining Infrastructure','Project Manager','Atlas Mining Co.','Mineração','project_management','AU','Perth','onsite','manager',10,12,'open',yr(150000,175000,'AUD'),'offered','m:project_management m:mining m:capex l:m:en:C1 x:8',null],
  ['d19','Continuous Improvement Engineer','Continuous Improvement Lead','Riverstone Foods','Alimentos','operational_excellence','AU','Melbourne','onsite','senior',30,33,'open',yr(110000,125000,'AUD'),'unknown','m:continuous_improvement n:lean_six_sigma l:m:en:B2',null],
  ['d20','Analista de Transformação Digital','Digital Transformation','Aurora Components','Automotivo','digital_manufacturing','BR','Sete Lagoas','hybrid','senior',2,3,'open',mo(14000,17000,'BRL'),'unknown','m:power_apps m:power_automate m:power_bi n:ai_agents n:python n:sharepoint',null],
  ['d21','Engenheiro de Processos Sênior','Process Engineer','Ironbridge Steel','Siderurgia','process_engineering','BR','Ipatinga','onsite','senior',35,40,'open',null,'unknown','m:process_engineering m:continuous_improvement n:sap x:5',null],
  ['d22','Gerente de Engenharia Industrial','Industrial Engineering Manager','Vertex Mobility','Automotivo','industrial_engineering','BR','Campinas','onsite','manager',45,47,'open',mo(26000,32000,'BRL'),'unknown','m:process_engineering m:automotive m:project_management l:m:en:C1 x:10',3.8],
  ['d23','Smart Factory Project Lead','Project Lead','Kestrel Robotics','Robótica','digital_manufacturing','IT','Bolonha','hybrid','lead',4,4,'open',yr(60000,72000,'EUR'),'unknown','m:project_management m:mes l:m:en:B2 l:n:it:B1 n:power_bi n:ai_agents',null],
  ['d24','Logistics Engineer','Supply Chain Engineer','Orbis Logistics','Logística','supply_chain','NL','Venlo','onsite','mid',60,62,'open',yr(48000,56000,'EUR'),'unknown','m:supply_chain m:wms l:m:en:B2 n:simulation',null],
  ['d25','Project Engineer — Automotive Tooling','Project Engineer','Aurora Components','Automotivo','industrial_engineering','DE','Wolfsburg','onsite','senior',75,80,'closed',yr(62000,70000,'EUR'),'unknown','m:project_management m:automotive l:m:de:B2 l:m:en:B2',null],
  ['d26','PMO Analyst — Energy Transition','PMO Analyst','Helix Energy','Energia','project_management','ES','Madri','hybrid','mid',50,55,'open',yr(38000,45000,'EUR'),'unknown','m:pmo m:power_bi l:m:es:B2 l:m:en:B2',null],
  ['d27','Senior Manufacturing Engineer','Manufacturing Engineer','Pinnacle Aerospace Parts','Aeroespacial','process_engineering','IT','Nápoles','onsite','senior',22,24,'open',yr(45000,55000,'EUR'),'unknown','m:process_engineering l:m:it:C1 n:lean_six_sigma',null],
  ['d28','Operations Excellence Lead','Operational Excellence Manager','Meridian Manufacturing','Manufatura','operational_excellence','BE','Gante','hybrid','lead',85,88,'open',null,'unknown','m:continuous_improvement m:stakeholder_management l:m:en:C1 l:n:nl:B1',null],
  ['d29','Engineering Project Manager — Mining','Project Manager','Tessaro Engineering','Mineração','project_management','BR','Belo Horizonte','hybrid','manager',95,100,'open',mo(24000,30000,'BRL'),'unknown','m:project_management m:mining m:capex m:pmo x:8 me:engineering_degree',null],
  ['d30','Automation Project Manager','Technical Project Manager','Lumen Process Systems','Automação','automation','DE','Hamburgo','hybrid','manager',110,115,'open',yr(80000,95000,'EUR'),'unknown','m:project_management m:plc l:m:de:C1',null],
  ['d31','Digital Transformation Lead','Digital Transformation','Fjord Industrial','Industrial','digital_manufacturing','NL','Amsterdã','remote','lead',1,1,'open',yr(85000,100000,'EUR'),'offered','m:power_apps m:project_management m:ai_agents l:m:en:C1 n:power_bi n:python x:5',null],
  ['d32','Project Coordinator','Project Coordinator','Cobalt Rail','Ferroviário','project_management','ES','Bilbao','onsite','junior',16,19,'open',yr(30000,34000,'EUR'),'unknown','m:project_management l:m:es:B2',null],
  ['d33','Engineering Manager — Process Plant','Engineering Manager','Solara Renewables','Energia','process_engineering','AU','Brisbane','onsite','director',27,29,'open',yr(190000,220000,'AUD'),'not_offered','m:process_engineering m:capex l:m:en:C1 w:AU x:12',null],
  ['d34','Lean Manufacturing Specialist','Continuous Improvement Lead','Vertex Mobility','Automotivo','operational_excellence','IT','Modena','onsite','senior',13,14,'open',yr(48000,58000,'EUR'),'unknown','m:continuous_improvement m:lean_six_sigma m:automotive l:m:it:B2',null],
  ['d35','Program Manager — EV Platform','Program Manager','Northwind Automotive','Automotivo','project_management','DE','Colônia','hybrid','manager',3,6,'open',yr(95000,110000,'EUR'),'unknown','m:project_management m:automotive m:stakeholder_management l:m:en:C1 l:m:de:B2 x:8',null],
  ['d36','Supply Chain Project Manager','Project Manager','Orbis Logistics','Logística','supply_chain','BR','Contagem','hybrid','senior',5,5,'open',mo(15000,18000,'BRL'),'unknown','m:supply_chain m:project_management n:power_bi n:wms',null],
  ['d37','Industrial Engineer','Industrial Engineer','Riverstone Foods','Alimentos','industrial_engineering','US','Chicago','onsite','mid',65,70,'unverified',null,'unknown','m:process_engineering l:m:en:B2',null],
  ['d38','Head of PMO','PMO Lead','Ironbridge Steel','Siderurgia','project_management','IT','Gênova','onsite','director',19,21,'open',null,'unknown','m:pmo m:capex l:m:it:C1 l:m:en:C1 x:12',null],
  ['d39','Engenheiro de Automação Industrial','Automation Engineer','Kestrel Robotics','Robótica','automation','BR','Curitiba','onsite','mid',55,58,'open',mo(11000,14000,'BRL'),'unknown','m:plc m:mes',null],
  ['d40','Project Manager (vaga com descrição incompleta)','Project Manager','Helix Energy','Energia','project_management','IT','Roma','unknown','unknown',2,null,'unverified',yr(70000,60000,'EUR'),'unknown','',null],
];

function describe(r: Row, requirements: Requirement[]): string {
  const [, title, , company, sector, , country, city] = r;
  if (!requirements.length) return `Vaga DEMO para ${title}. Detalhes não publicados.`;
  const must = requirements.filter((x) => x.kind === 'must').map((x) => x.text);
  const nice = requirements.filter((x) => x.kind === 'nice').map((x) => x.text);
  return [
    `[DEMO — vaga fictícia] ${company} (empresa fictícia, setor ${sector}) procura ${title} para ${city ?? country}.`,
    `A posição atua em projetos de engenharia e operações, com interface entre produção, qualidade, manutenção e áreas corporativas.`,
    `Obrigatório: ${must.join('; ') || '—'}.`,
    nice.length ? `Desejável: ${nice.join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildDemoJobs(asOf = DEMO_AS_OF): Job[] {
  return ROWS.map((r) => {
    const [id, title, family, company, sector, area, country, city, mode, seniority, disc, posted, status, salary, visa, spec, coScore] = r;
    const requirements = reqs(id, spec);
    return {
      id,
      origin: 'demo',
      title,
      normalizedTitle: family,
      company,
      sector,
      area,
      country,
      city,
      workMode: mode,
      seniority,
      description: describe(r, requirements),
      requirements,
      salary,
      postedAt: posted == null ? null : addDays(asOf, -posted),
      discoveredAt: addDays(asOf, -disc),
      verifiedAt: status === 'unverified' ? null : addDays(asOf, -Math.min(disc, 1)),
      status,
      source: { name: 'DEMO (fictícia)', url: null },
      careerOpsScore: coScore,
      visaSponsorship: visa,
    };
  });
}
