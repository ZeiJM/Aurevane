begin;

-- Master Panel combat authoring persistence. Browser roles never access these
-- tables directly; protected server code owns validation, publication and rollback.
create table app_private.combat_content_versions (
  id uuid primary key default gen_random_uuid(),
  content_key text not null check (char_length(content_key) between 3 and 160),
  content_kind text not null check (content_kind in ('skill','status','effect-profile')),
  content_version integer not null check (content_version > 0),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default clock_timestamp(),
  unique (content_key, content_version),
  unique (id, content_key, content_kind)
);

create table app_private.combat_content_drafts (
  content_key text primary key check (char_length(content_key) between 3 and 160),
  content_kind text not null check (content_kind in ('skill','status','effect-profile')),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  base_version integer check (base_version is null or base_version > 0),
  draft_version bigint not null default 1 check (draft_version > 0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (content_key, base_version)
    references app_private.combat_content_versions(content_key, content_version)
    on update restrict on delete restrict
);

create table app_private.combat_content_publications (
  content_key text primary key check (char_length(content_key) between 3 and 160),
  content_kind text not null check (content_kind in ('skill','status','effect-profile')),
  version_id uuid not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (version_id, content_key, content_kind)
    references app_private.combat_content_versions(id, content_key, content_kind)
    on update restrict on delete restrict
);

create index combat_content_versions_key_published_idx
  on app_private.combat_content_versions(content_key, published_at desc);

alter table app_private.combat_content_drafts enable row level security;
alter table app_private.combat_content_versions enable row level security;
alter table app_private.combat_content_publications enable row level security;

revoke all on table app_private.combat_content_drafts from public, anon, authenticated, service_role;
revoke all on table app_private.combat_content_versions from public, anon, authenticated, service_role;
revoke all on table app_private.combat_content_publications from public, anon, authenticated, service_role;

grant select, insert, update, delete on table app_private.combat_content_drafts to service_role;
grant select, insert on table app_private.combat_content_versions to service_role;
grant select, insert, update on table app_private.combat_content_publications to service_role;

-- Published rows are history. Rollback changes only the publication pointer and
-- must never rewrite or delete a historical definition, even through service code.
create or replace function app_private.prevent_combat_content_version_mutation_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'COMBAT_CONTENT_VERSION_IMMUTABLE';
end;
$$;

revoke all on function app_private.prevent_combat_content_version_mutation_v1()
  from public, anon, authenticated;

create trigger prevent_combat_content_version_mutation_v1
before update or delete on app_private.combat_content_versions
for each row execute function app_private.prevent_combat_content_version_mutation_v1();

comment on table app_private.combat_content_drafts is
  'Mutable server-only Master Panel combat drafts with optimistic draft_version concurrency.';
comment on table app_private.combat_content_versions is
  'Immutable published combat-content definitions. Historical rows are never updated or deleted.';
comment on table app_private.combat_content_publications is
  'Current publication pointer for each combat content key; rollback repoints this row only.';

commit;
