# Modelo de dados — Career OS (proposta Fase 2)

## Fontes canônicas (career-ops — não duplicar)
| Entidade | Arquivo | Escrita via |
|---|---|---|
| Vaga descoberta | `data/pipeline.md`, `data/scan-history.tsv` | `scan.mjs` |
| Candidatura | `data/applications.md` (+ `status-log.tsv`) | `tracker.mjs`, `set-status.mjs` |
| Avaliação | `reports/NNN-company-date.md` | modes `oferta` |
| Perfil | `cv.md`, `config/profile.yml`, `data/career-profile.yml`, `modes/_profile.md` | intake / usuário |
| Histórias | `interview-prep/story-bank.md` | usuário / modes |
| Follow-ups, entrevistas | `data/follow-ups.md`, `data/active-interviews.md` | modes |

## Dados novos do Career OS (`career-os/private/`, gitignored)
```ts
// Proveniência de cada fato profissional
type Provenance = 'proven' | 'declared' | 'interpretation' | 'pending_validation';

interface CareerFact { id; kind: 'achievement'|'project'|'education'|'certification'|'language'|'eligibility';
  text; provenance: Provenance; evidenceRefs: string[]; confidential: boolean; validatedAt?: string; }

interface Eligibility { country: string; status: 'authorized'|'not_authorized'|'in_progress'|'unknown';
  basis?: string; evidenceRef?: string; }       // ex.: { country:'IT', status:'in_progress', basis:'cidadania' }

interface MatchScore { jobKey: string /* url-key.mjs */; score: number /*0-100*/;
  components: Record<'technical'|'experience'|'mustHave'|'niceToHave'|'seniority'|'career'|'location'|'language'|'eligibility'|'sector'|'comp'|'legitimacy'|'interest', {value:number; weight:number; evidence:string[]; unknown:boolean}>;
  blockers: string[]; confidence: 'high'|'medium'|'low';
  category: 'excellent'|'high'|'moderate'|'low'|'blocked'; reportRef?: string; computedAt: string; configHash: string; }

interface Consent { id; action: 'submit_application'|'send_email'|'create_event'; target: string; grantedAt; scope; }
interface AutomationRun { id; kind; startedAt; finishedAt?; status: 'ok'|'failed'|'partial'; errors: string[]; }
```
Regras: `category='excellent'` é impossível se houver `blockers`; componente `unknown:true` nunca soma como atendido.
Chave de vaga reutiliza `url-key.mjs`/`fingerprint-core.mjs` do career-ops.
