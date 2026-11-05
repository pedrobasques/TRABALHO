-- Career OS — Row Level Security. Owner-only access for the `authenticated` role; `anon` gets nothing.
-- History tables (application_events, audit_log) are append-only from the API's point of view:
-- SELECT only for owners; rows are written by SECURITY DEFINER triggers.

alter table public.app_users             enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.experiences           enable row level security;
alter table public.skills                enable row level security;
alter table public.job_sources           enable row level security;
alter table public.jobs                  enable row level security;
alter table public.match_evaluations     enable row level security;
alter table public.applications          enable row level security;
alter table public.application_events    enable row level security;
alter table public.documents             enable row level security;
alter table public.automation_runs       enable row level security;
alter table public.audit_log             enable row level security;

-- NOTE: no FORCE ROW LEVEL SECURITY — history rows are written by SECURITY DEFINER triggers owned by the
-- migration role. The application never connects as table owner: it runs every query after
-- `SET LOCAL ROLE authenticated` with the user's JWT claims (packages/db), so these policies apply.

-- app_users: a user sees and edits only their own row
create policy app_users_self on public.app_users
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- owner-scoped CRUD tables
do $$
declare t text;
begin
  foreach t in array array['professional_profiles', 'experiences', 'skills', 'job_sources', 'jobs',
                           'match_evaluations', 'applications', 'documents', 'automation_runs']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (owner_id = auth.uid())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (owner_id = auth.uid())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (owner_id = auth.uid())', t || '_delete', t);
  end loop;
end $$;

-- history: read-only for owners
create policy application_events_select on public.application_events for select to authenticated using (owner_id = auth.uid());
create policy audit_log_select on public.audit_log for select to authenticated using (owner_id = auth.uid());

-- grants (Supabase grants broad defaults; we tighten explicitly)
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.app_users, public.professional_profiles, public.experiences, public.skills, public.job_sources,
  public.jobs, public.match_evaluations, public.applications, public.documents, public.automation_runs
  to authenticated;
grant select on public.application_events, public.audit_log to authenticated;
revoke insert, update, delete on public.application_events, public.audit_log from authenticated;

-- cross-owner integrity: an application may only reference the owner's own job
create or replace function public.check_application_job_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.jobs j where j.id = new.job_id and j.owner_id = new.owner_id) then
    raise exception 'job % does not belong to owner %', new.job_id, new.owner_id using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_applications_job_owner before insert or update of job_id, owner_id on public.applications
  for each row execute function public.check_application_job_owner();
