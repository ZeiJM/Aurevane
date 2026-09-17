begin;

create table app_private.master_panel_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','content-staff')),
  enabled boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default clock_timestamp(),
  note text check (note is null or char_length(note) between 1 and 240)
);

alter table app_private.master_panel_operators enable row level security;
revoke all on table app_private.master_panel_operators from public, anon, authenticated, service_role;
grant select on table app_private.master_panel_operators to service_role;

comment on table app_private.master_panel_operators is
  'Explicit server-only Master Panel authorization. No account is implicitly privileged.';

create or replace function app_private.assert_master_panel_operator_v1(
  p_actor_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_role text;
begin
  select mp_operator.role
  into v_role
  from app_private.master_panel_operators as mp_operator
  where mp_operator.user_id = p_actor_user_id
    and mp_operator.enabled = true;

  if v_role is null then
    raise exception using
      errcode = '42501',
      message = 'MASTER_PANEL_OPERATOR_REQUIRED';
  end if;

  return v_role;
end;
$$;

revoke all on function app_private.assert_master_panel_operator_v1(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.read_master_panel_operator_v1(
  p_user_id uuid
)
returns table (
  user_id uuid,
  role text,
  enabled boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select mp_operator.user_id, mp_operator.role, mp_operator.enabled
  from app_private.master_panel_operators as mp_operator
  where mp_operator.user_id = p_user_id
    and mp_operator.enabled = true
  limit 1;
$$;

create or replace function public.read_combat_content_draft_v1(
  p_actor_user_id uuid,
  p_content_key text
)
returns table (
  content_key text,
  content_kind text,
  definition jsonb,
  base_version integer,
  draft_version bigint,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.assert_master_panel_operator_v1(p_actor_user_id);
  return query
  select
    draft.content_key,
    draft.content_kind,
    draft.definition,
    draft.base_version,
    draft.draft_version,
    draft.updated_by,
    draft.updated_at
  from app_private.combat_content_drafts as draft
  where draft.content_key = p_content_key
  limit 1;
end;
$$;

create or replace function public.list_combat_content_versions_v1(
  p_actor_user_id uuid,
  p_content_key text
)
returns table (
  id uuid,
  content_key text,
  content_kind text,
  content_version integer,
  definition jsonb,
  published_by uuid,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.assert_master_panel_operator_v1(p_actor_user_id);
  return query
  select
    version.id,
    version.content_key,
    version.content_kind,
    version.content_version,
    version.definition,
    version.published_by,
    version.published_at
  from app_private.combat_content_versions as version
  where version.content_key = p_content_key
  order by version.content_version asc;
end;
$$;

create or replace function public.save_combat_content_draft_v1(
  p_actor_user_id uuid,
  p_content_key text,
  p_content_kind text,
  p_definition jsonb,
  p_base_version integer,
  p_expected_draft_version bigint
)
returns table (
  content_key text,
  content_kind text,
  definition jsonb,
  base_version integer,
  draft_version bigint,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_current_draft_version bigint;
begin
  perform app_private.assert_master_panel_operator_v1(p_actor_user_id);
  if p_content_kind not in ('skill','status','effect-profile') then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_KIND_INVALID';
  end if;
  if p_definition is null or jsonb_typeof(p_definition) <> 'object' then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_DEFINITION_INVALID';
  end if;
  if p_base_version is not null and p_base_version < 1 then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_BASE_VERSION_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('combat-draft:' || p_content_key, 0));

  select draft.draft_version
  into v_current_draft_version
  from app_private.combat_content_drafts as draft
  where draft.content_key = p_content_key;

  if v_current_draft_version is null then
    if p_expected_draft_version is not null then
      raise exception using errcode = '40001', message = 'COMBAT_CONTENT_DRAFT_VERSION_CONFLICT';
    end if;

    insert into app_private.combat_content_drafts (
      content_key,
      content_kind,
      definition,
      base_version,
      draft_version,
      updated_by
    ) values (
      p_content_key,
      p_content_kind,
      p_definition,
      p_base_version,
      1,
      p_actor_user_id
    );
  else
    if p_expected_draft_version is distinct from v_current_draft_version then
      raise exception using errcode = '40001', message = 'COMBAT_CONTENT_DRAFT_VERSION_CONFLICT';
    end if;

    update app_private.combat_content_drafts as draft
    set
      content_kind = p_content_kind,
      definition = p_definition,
      base_version = p_base_version,
      draft_version = draft.draft_version + 1,
      updated_by = p_actor_user_id,
      updated_at = clock_timestamp()
    where draft.content_key = p_content_key;
  end if;

  return query
  select
    draft.content_key,
    draft.content_kind,
    draft.definition,
    draft.base_version,
    draft.draft_version,
    draft.updated_by,
    draft.updated_at
  from app_private.combat_content_drafts as draft
  where draft.content_key = p_content_key;
end;
$$;

create or replace function public.publish_combat_content_v1(
  p_actor_user_id uuid,
  p_content_key text,
  p_content_kind text,
  p_definition jsonb,
  p_expected_base_version integer
)
returns table (
  id uuid,
  content_key text,
  content_kind text,
  content_version integer,
  definition jsonb,
  published_by uuid,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_current_version integer;
  v_highest_version integer;
  v_next_version integer;
  v_version_id uuid;
  v_versioned_definition jsonb;
begin
  perform app_private.assert_master_panel_operator_v1(p_actor_user_id);
  if p_content_kind not in ('skill','status','effect-profile') then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_KIND_INVALID';
  end if;
  if p_definition is null or jsonb_typeof(p_definition) <> 'object' then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_DEFINITION_INVALID';
  end if;
  if p_expected_base_version is not null and p_expected_base_version < 1 then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_BASE_VERSION_INVALID';
  end if;
  if p_content_kind = 'skill' and p_definition ->> 'id' is distinct from p_content_key then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_IDENTITY_MISMATCH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('combat-publish:' || p_content_key, 0));

  select version.content_version
  into v_current_version
  from app_private.combat_content_publications as publication
  join app_private.combat_content_versions as version
    on publication.version_id = version.id
  where publication.content_key = p_content_key
    and publication.content_kind = p_content_kind;

  if v_current_version is not null
    and p_expected_base_version is distinct from v_current_version then
    raise exception using errcode = '40001', message = 'COMBAT_CONTENT_BASE_VERSION_CONFLICT';
  end if;

  select coalesce(max(version.content_version), 0)
  into v_highest_version
  from app_private.combat_content_versions as version
  where version.content_key = p_content_key;

  v_next_version := greatest(v_highest_version, coalesce(p_expected_base_version, 0)) + 1;
  v_version_id := gen_random_uuid();
  v_versioned_definition := jsonb_set(p_definition, '{contentVersion}', to_jsonb(v_next_version), true);

  insert into app_private.combat_content_versions (
    id,
    content_key,
    content_kind,
    content_version,
    definition,
    published_by
  ) values (
    v_version_id,
    p_content_key,
    p_content_kind,
    v_next_version,
    v_versioned_definition,
    p_actor_user_id
  );

  insert into app_private.combat_content_publications (
    content_key,
    content_kind,
    version_id,
    updated_by
  ) values (
    p_content_key,
    p_content_kind,
    v_version_id,
    p_actor_user_id
  )
  on conflict (content_key) do update
  set
    content_kind = excluded.content_kind,
    version_id = excluded.version_id,
    updated_by = excluded.updated_by,
    updated_at = clock_timestamp();

  delete from app_private.combat_content_drafts as draft
  where draft.content_key = p_content_key;

  return query
  select
    version.id,
    version.content_key,
    version.content_kind,
    version.content_version,
    version.definition,
    version.published_by,
    version.published_at
  from app_private.combat_content_versions as version
  where version.id = v_version_id;
end;
$$;

create or replace function public.set_combat_content_publication_v1(
  p_actor_user_id uuid,
  p_content_key text,
  p_content_kind text,
  p_target_version integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_version_id uuid;
begin
  perform app_private.assert_master_panel_operator_v1(p_actor_user_id);
  if p_content_kind not in ('skill','status','effect-profile') then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_KIND_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('combat-publish:' || p_content_key, 0));

  if p_target_version is null then
    delete from app_private.combat_content_publications as publication
    where publication.content_key = p_content_key
      and publication.content_kind = p_content_kind;
    return;
  end if;

  select version.id
  into v_version_id
  from app_private.combat_content_versions as version
  where version.content_key = p_content_key
    and version.content_kind = p_content_kind
    and version.content_version = p_target_version;

  if v_version_id is null then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_VERSION_NOT_FOUND';
  end if;

  insert into app_private.combat_content_publications (
    content_key,
    content_kind,
    version_id,
    updated_by
  ) values (
    p_content_key,
    p_content_kind,
    v_version_id,
    p_actor_user_id
  )
  on conflict (content_key) do update
  set
    content_kind = excluded.content_kind,
    version_id = excluded.version_id,
    updated_by = excluded.updated_by,
    updated_at = clock_timestamp();
end;
$$;

revoke all on function public.read_master_panel_operator_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.read_combat_content_draft_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function public.list_combat_content_versions_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function public.save_combat_content_draft_v1(uuid, text, text, jsonb, integer, bigint)
  from public, anon, authenticated;
revoke all on function public.publish_combat_content_v1(uuid, text, text, jsonb, integer)
  from public, anon, authenticated;
revoke all on function public.set_combat_content_publication_v1(uuid, text, text, integer)
  from public, anon, authenticated;

grant execute on function public.read_master_panel_operator_v1(uuid) to service_role;
grant execute on function public.read_combat_content_draft_v1(uuid, text) to service_role;
grant execute on function public.list_combat_content_versions_v1(uuid, text) to service_role;
grant execute on function public.save_combat_content_draft_v1(uuid, text, text, jsonb, integer, bigint)
  to service_role;
grant execute on function public.publish_combat_content_v1(uuid, text, text, jsonb, integer)
  to service_role;
grant execute on function public.set_combat_content_publication_v1(uuid, text, text, integer)
  to service_role;

comment on function public.read_master_panel_operator_v1(uuid) is
  'Service-only lookup for explicit enabled Master Panel operator authorization.';
comment on function public.save_combat_content_draft_v1(uuid, text, text, jsonb, integer, bigint) is
  'Authorized optimistic combat-content draft save. Drafts may reference static fallback base versions.';
comment on function public.publish_combat_content_v1(uuid, text, text, jsonb, integer) is
  'Authorized atomic immutable publish; serializes by content key and advances the current publication pointer.';
comment on function public.set_combat_content_publication_v1(uuid, text, text, integer) is
  'Authorized pointer-only rollback. A null target clears DB publication so static fallback becomes current.';

commit;