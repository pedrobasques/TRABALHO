-- Career OS — job identity = native/source id (Sprint 4.5)
-- Two different requisitions can share company|title|country (e.g. same role in two plants).
-- dedupe_key stays as an index for repost detection; identity is (owner_id, external_id).
alter table public.jobs drop constraint if exists jobs_owner_id_dedupe_key_key;
create index if not exists jobs_owner_dedupe_key on public.jobs (owner_id, dedupe_key);
update public.jobs set external_id = id::text where external_id is null;
alter table public.jobs alter column external_id set not null;
drop index if exists public.jobs_owner_external_id;
alter table public.jobs add constraint jobs_owner_external_id unique (owner_id, external_id);
