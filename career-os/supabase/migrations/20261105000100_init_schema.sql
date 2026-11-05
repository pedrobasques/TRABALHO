-- Career OS — initial schema (Supabase / PostgreSQL 15+)
--
-- Source-of-truth policy (ADR-007):
--   * career-ops files stay canonical for what career-ops writes (tracker, reports, scan history).
--     Those rows are MIRRORED here (origin = 'career-ops') by the ingest job, one-way, idempotently.
--   * Career OS owns what career-ops does not model: pipeline actions taken in the dashboard,
--     match evaluations (derived, recomputable), documents metadata, automation runs.
-- Every table carries owner_id and is protected by Row Level Security (owner_id = auth.uid()).

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ helpers
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ------------------------------------------------------------------ users
create table public.app_users (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------------ profile
create table public.professional_profiles (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.app_users (id) on delete cascade,
  headline          text,
  summary           text,
  years_experience  numeric(4,1) check (years_experience is null or years_experience between 0 and 60),
  current_seniority text,
  target_seniority  text[] not null default '{}',
  preferences       jsonb not null default '{}'::jsonb,
  eligibility       jsonb not null default '[]'::jsonb,
  source            text not null check (source in ('career-ops', 'manual', 'demo')),
  source_ref        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (owner_id)
);

create table public.experiences (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.app_users (id) on delete cascade,
  profile_id  uuid not null references public.professional_profiles (id) on delete cascade,
  company     text not null,
  role        text not null,
  start_date  text,
  end_date    text,
  summary     text,
  provenance  text not null check (provenance in ('proven', 'declared', 'interpretation', 'pending_validation')),
  evidence    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.skills (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.app_users (id) on delete cascade,
  profile_id  uuid not null references public.professional_profiles (id) on delete cascade,
  key         text not null,
  label       text not null,
  level       smallint check (level between 1 and 5),
  provenance  text not null check (provenance in ('proven', 'declared', 'interpretation', 'pending_validation')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, key)
);

-- ------------------------------------------------------------------ jobs
create table public.job_sources (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.app_users (id) on delete cascade,
  kind        text not null check (kind in ('ats_api', 'rss', 'career-ops-scan', 'career-ops-tracker', 'email_alert', 'manual', 'demo')),
  name        text not null,
  base_url    text,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.jobs (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.app_users (id) on delete cascade,
  source_id          uuid references public.job_sources (id) on delete set null,
  external_id        text,                    -- id used by the producing system (e.g. career-ops listing key, demo id)
  dedupe_key         text not null,           -- normalized company|title|country (see packages/core ingest)
  url_key            text,                    -- normalized posting URL, when known
  origin             text not null check (origin in ('demo', 'career-ops', 'manual')),
  title              text not null,
  normalized_title   text not null,
  company            text not null,
  normalized_company text not null,
  country            text check (country is null or country ~ '^[A-Z]{2}$'),
  city               text,
  work_mode          text not null default 'unknown' check (work_mode in ('onsite', 'hybrid', 'remote', 'unknown')),
  seniority          text not null default 'unknown',
  area               text not null default 'other',
  description        text not null default '',
  requirements       jsonb not null default '[]'::jsonb,
  salary             jsonb,
  posted_at          date,
  discovered_at      timestamptz not null,
  verified_at        timestamptz,
  status             text not null default 'unverified' check (status in ('open', 'closed', 'unverified')),
  career_ops_score   numeric(2,1) check (career_ops_score is null or career_ops_score between 1 and 5),
  quality_issues     text[] not null default '{}',
  raw                jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (owner_id, dedupe_key)
);
create unique index jobs_owner_url_key on public.jobs (owner_id, url_key) where url_key is not null;
create unique index jobs_owner_external_id on public.jobs (owner_id, external_id) where external_id is not null;
create index jobs_owner_country on public.jobs (owner_id, country);
create index jobs_owner_discovered on public.jobs (owner_id, discovered_at desc);

create table public.match_evaluations (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.app_users (id) on delete cascade,
  job_id             uuid not null references public.jobs (id) on delete cascade,
  config_version     text not null,
  profile_hash       text not null,           -- evaluations are invalidated when the profile changes
  overall_score      smallint not null check (overall_score between 0 and 100),
  technical_score    smallint check (technical_score between 0 and 100),
  career_score       smallint check (career_score between 0 and 100),
  eligibility_status text not null check (eligibility_status in ('eligible', 'requires_sponsorship', 'not_eligible', 'unknown')),
  confidence         text not null check (confidence in ('high', 'medium', 'low')),
  category           text not null check (category in ('excellent', 'high', 'moderate', 'low', 'blocked')),
  recommendation     text not null,
  result             jsonb not null,
  computed_at        timestamptz not null default now(),
  unique (job_id, config_version, profile_hash)
);

-- ------------------------------------------------------------------ pipeline
create table public.applications (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.app_users (id) on delete cascade,
  job_id           uuid not null references public.jobs (id) on delete restrict,
  origin           text not null check (origin in ('demo', 'career-ops', 'manual')),
  stage            text not null check (stage in ('discovered', 'qualified', 'preparing', 'ready_for_review', 'submitted', 'responded', 'interview', 'offer', 'closed')),
  closed_reason    text check (closed_reason in ('rejected', 'withdrawn', 'discarded', 'hired', 'expired')),
  next_action      text,
  next_action_due  date,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (owner_id, job_id)                   -- no duplicate applications for the same job
);

-- Append-only history. Written by trigger on every stage change; no UPDATE/DELETE grants or policies.
-- The writer may set transaction-local career_os.event_note / career_os.actor / career_os.event_at.
create table public.application_events (
  id              bigint generated always as identity primary key,
  owner_id        uuid not null references public.app_users (id) on delete cascade,
  application_id  uuid not null references public.applications (id) on delete cascade,
  from_stage      text,
  to_stage        text not null,
  note            text,
  actor           text not null default 'dashboard',
  occurred_at     timestamptz not null default now()
);
create index application_events_app on public.application_events (application_id, occurred_at);

create or replace function public.log_application_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (owner_id, application_id, from_stage, to_stage, note, actor, occurred_at)
    values (new.owner_id, new.id, null, new.stage,
            nullif(current_setting('career_os.event_note', true), ''),
            coalesce(nullif(current_setting('career_os.actor', true), ''), 'dashboard'),
            coalesce(nullif(current_setting('career_os.event_at', true), '')::timestamptz, now()));
  elsif new.stage is distinct from old.stage then
    insert into public.application_events (owner_id, application_id, from_stage, to_stage, note, actor, occurred_at)
    values (new.owner_id, new.id, old.stage, new.stage,
            nullif(current_setting('career_os.event_note', true), ''),
            coalesce(nullif(current_setting('career_os.actor', true), ''), 'dashboard'),
            coalesce(nullif(current_setting('career_os.event_at', true), '')::timestamptz, now()));
  end if;
  return new;
end $$;

-- ------------------------------------------------------------------ documents
-- Metadata only; file bytes live in a PRIVATE Supabase Storage bucket at storage_path.
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.app_users (id) on delete cascade,
  kind          text not null check (kind in ('cv_master', 'cv_tailored', 'cover_letter', 'evidence', 'other')),
  title         text not null,
  storage_path  text not null,
  sha256        text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  mime_type     text,
  size_bytes    bigint check (size_bytes is null or size_bytes >= 0),
  job_id        uuid references public.jobs (id) on delete set null,
  provenance    text not null default 'declared' check (provenance in ('proven', 'declared', 'interpretation', 'pending_validation')),
  created_at    timestamptz not null default now(),
  unique (owner_id, storage_path)
);

-- ------------------------------------------------------------------ automation
create table public.automation_runs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.app_users (id) on delete cascade,
  kind         text not null check (kind in ('scan', 'ingest', 'liveness', 'matching', 'report', 'sync', 'diagnostic')),
  status       text not null check (status in ('running', 'ok', 'partial', 'failed')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  summary      text not null default '',
  stats        jsonb not null default '{}'::jsonb,
  errors       jsonb not null default '[]'::jsonb,
  check (finished_at is null or finished_at >= started_at)
);
create index automation_runs_owner_started on public.automation_runs (owner_id, started_at desc);

-- ------------------------------------------------------------------ audit log (generic change history)
create table public.audit_log (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null,
  table_name  text not null,
  row_id      uuid not null,
  op          text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  old_row     jsonb,
  new_row     jsonb,
  changed_at  timestamptz not null default now()
);
create index audit_log_row on public.audit_log (table_name, row_id, changed_at);

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (owner_id, table_name, row_id, op, old_row, new_row)
  values (coalesce(new.owner_id, old.owner_id), tg_table_name, coalesce(new.id, old.id), tg_op,
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- ------------------------------------------------------------------ triggers
create trigger trg_profiles_updated before update on public.professional_profiles for each row execute function public.set_updated_at();
create trigger trg_experiences_updated before update on public.experiences for each row execute function public.set_updated_at();
create trigger trg_skills_updated before update on public.skills for each row execute function public.set_updated_at();
create trigger trg_jobs_updated before update on public.jobs for each row execute function public.set_updated_at();
create trigger trg_applications_updated before update on public.applications for each row execute function public.set_updated_at();
create trigger trg_applications_stage after insert or update of stage on public.applications for each row execute function public.log_application_stage();

create trigger trg_audit_profiles after insert or update or delete on public.professional_profiles for each row execute function public.audit_row();
create trigger trg_audit_jobs after insert or update or delete on public.jobs for each row execute function public.audit_row();
create trigger trg_audit_applications after insert or update or delete on public.applications for each row execute function public.audit_row();
create trigger trg_audit_documents after insert or update or delete on public.documents for each row execute function public.audit_row();
