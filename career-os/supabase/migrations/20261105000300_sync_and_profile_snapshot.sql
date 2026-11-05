-- Career OS — write-back sync state + profile snapshot (ADR-008)

-- Sync state lives beside the immutable history: application_events stay append-only.
create table public.event_sync (
  event_id    bigint primary key references public.application_events (id) on delete cascade,
  owner_id    uuid not null references public.app_users (id) on delete cascade,
  state       text not null check (state in ('applied', 'not_applicable', 'failed', 'external')),
  detail      text,
  updated_at  timestamptz not null default now()
);
alter table public.event_sync enable row level security;
create policy event_sync_select on public.event_sync for select to authenticated using (owner_id = auth.uid());
create policy event_sync_insert on public.event_sync for insert to authenticated
  with check (owner_id = auth.uid() and exists (select 1 from public.application_events e where e.id = event_id and e.owner_id = auth.uid()));
create policy event_sync_update on public.event_sync for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update on public.event_sync to authenticated;

-- Events written by career-ops itself (import / pull) never need write-back.
create or replace function public.mark_external_events() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.actor in ('import', 'career-ops') then
    insert into public.event_sync (event_id, owner_id, state, detail) values (new.id, new.owner_id, 'external', null);
  end if;
  return new;
end $$;
create trigger trg_events_external after insert on public.application_events
  for each row execute function public.mark_external_events();

-- Full CandidateProfile snapshot (as imported from career-ops files) so a deployment
-- without those files (Vercel) can run matching. Normalized rows stay in skills/experiences.
alter table public.professional_profiles add column snapshot jsonb;
alter table public.professional_profiles add column snapshot_hash text;
