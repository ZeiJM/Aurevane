begin;

alter table app_private.discipline_definitions
  add column enabled_for_secondary boolean not null default false;

update app_private.discipline_definitions
set enabled_for_secondary = true;

comment on column app_private.discipline_definitions.enabled_for_secondary is
  'Whether this versioned Discipline may be selected as Secondary after authoritative mastery eligibility is satisfied.';

create table app_private.character_discipline_masteries (
  character_id uuid not null references public.characters(id) on delete cascade,
  discipline_id text not null,
  mastered_definition_version integer not null,
  mastered_at timestamptz not null default clock_timestamp(),
  source_kind text not null,
  source_id text not null,
  primary key (character_id, discipline_id),
  foreign key (discipline_id, mastered_definition_version)
    references app_private.discipline_definitions(discipline_id, definition_version),
  constraint character_discipline_masteries_source_kind check (
    source_kind in ('system', 'gameplay', 'support', 'owner', 'migration')
  ),
  constraint character_discipline_masteries_source_id_length check (
    char_length(source_id) between 1 and 160
  )
);

comment on table app_private.character_discipline_masteries is
  'Server-only completed Discipline mastery facts. P3.2 consumes these facts for Secondary eligibility; Mastery XP/stage progression remains a later integration.';

revoke all on table app_private.character_discipline_masteries from public, anon, authenticated;
grant select on table app_private.character_discipline_masteries to service_role;

create table app_private.character_build_attunement_policies (
  version integer primary key,
  primary_cooldown_seconds integer not null,
  secondary_cooldown_seconds integer not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint character_build_attunement_policy_version_positive check (version > 0),
  constraint character_build_attunement_primary_range check (
    primary_cooldown_seconds between 0 and 604800
  ),
  constraint character_build_attunement_secondary_range check (
    secondary_cooldown_seconds between 0 and 604800
  )
);

create table app_private.character_build_attunement_policy_state (
  singleton boolean primary key default true,
  current_policy_version integer not null
    references app_private.character_build_attunement_policies(version),
  updated_at timestamptz not null default clock_timestamp(),
  constraint character_build_attunement_policy_state_singleton check (singleton)
);

comment on table app_private.character_build_attunement_policies is
  'Versioned server-only Primary/Secondary attunement durations. P3.2 production default is four real hours for each independent slot.';
comment on table app_private.character_build_attunement_policy_state is
  'Server-only pointer to the policy used for future Discipline changes. Existing lock deadlines remain absolute and are not shortened by later policy changes.';

revoke all on table app_private.character_build_attunement_policies from public, anon, authenticated;
revoke all on table app_private.character_build_attunement_policy_state from public, anon, authenticated;
grant select on table app_private.character_build_attunement_policies to service_role;
grant select on table app_private.character_build_attunement_policy_state to service_role;

insert into app_private.character_build_attunement_policies (
  version,
  primary_cooldown_seconds,
  secondary_cooldown_seconds
)
values (1, 14400, 14400);

insert into app_private.character_build_attunement_policy_state (
  singleton,
  current_policy_version
)
values (true, 1);

alter table app_private.character_active_builds
  add column secondary_discipline_id text,
  add column secondary_definition_version integer,
  add column primary_attunement_locked_until timestamptz,
  add column secondary_attunement_locked_until timestamptz,
  add column last_attunement_policy_version integer not null default 1,
  add constraint character_active_builds_secondary_definition_fk
    foreign key (secondary_discipline_id, secondary_definition_version)
    references app_private.discipline_definitions(discipline_id, definition_version),
  add constraint character_active_builds_attunement_policy_fk
    foreign key (last_attunement_policy_version)
    references app_private.character_build_attunement_policies(version),
  add constraint character_active_builds_secondary_pair_complete check (
    (secondary_discipline_id is null and secondary_definition_version is null)
    or (secondary_discipline_id is not null and secondary_definition_version is not null)
  ),
  add constraint character_active_builds_discipline_slots_distinct check (
    secondary_discipline_id is null or secondary_discipline_id <> primary_discipline_id
  );

alter table app_private.character_active_builds
  alter column schema_version set default 2;

update app_private.character_active_builds
set schema_version = 2;

comment on column app_private.character_active_builds.secondary_discipline_id is
  'Optional committed mastered Secondary Discipline. It contributes no second Primary base-stat profile.';
comment on column app_private.character_active_builds.primary_attunement_locked_until is
  'Trusted absolute deadline for the independent Primary attunement lock.';
comment on column app_private.character_active_builds.secondary_attunement_locked_until is
  'Trusted absolute deadline for the independent Secondary attunement lock.';

alter table app_private.character_build_change_audit
  add column change_primary boolean not null default true,
  add column change_secondary boolean not null default false,
  add column from_secondary_discipline_id text,
  add column from_secondary_definition_version integer,
  add column to_secondary_discipline_id text,
  add column to_secondary_definition_version integer,
  add column attunement_policy_version integer not null default 1,
  add column primary_attunement_locked_until_after timestamptz,
  add column secondary_attunement_locked_until_after timestamptz,
  add constraint character_build_change_audit_from_secondary_fk
    foreign key (from_secondary_discipline_id, from_secondary_definition_version)
    references app_private.discipline_definitions(discipline_id, definition_version),
  add constraint character_build_change_audit_to_secondary_fk
    foreign key (to_secondary_discipline_id, to_secondary_definition_version)
    references app_private.discipline_definitions(discipline_id, definition_version),
  add constraint character_build_change_audit_policy_fk
    foreign key (attunement_policy_version)
    references app_private.character_build_attunement_policies(version),
  add constraint character_build_change_audit_from_secondary_complete check (
    (from_secondary_discipline_id is null and from_secondary_definition_version is null)
    or (from_secondary_discipline_id is not null and from_secondary_definition_version is not null)
  ),
  add constraint character_build_change_audit_to_secondary_complete check (
    (to_secondary_discipline_id is null and to_secondary_definition_version is null)
    or (to_secondary_discipline_id is not null and to_secondary_definition_version is not null)
  ),
  add constraint character_build_change_audit_has_change check (change_primary or change_secondary);

create or replace function public.record_character_discipline_mastery_v1(
  p_character_id uuid,
  p_discipline_id text,
  p_source_kind text,
  p_source_id text
)
returns table (
  character_id uuid,
  discipline_id text,
  mastered_definition_version integer,
  mastered_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_definition app_private.discipline_definitions%rowtype;
  v_rows_inserted integer;
begin
  if p_source_kind is null
    or p_source_kind not in ('system', 'gameplay', 'support', 'owner', 'migration')
    or p_source_id is null
    or char_length(p_source_id) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'DISCIPLINE_MASTERY_PROVENANCE_INVALID';
  end if;

  if not exists (
    select 1
    from public.characters character
    where character.id = p_character_id
  ) then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  select definition.* into v_definition
  from app_private.discipline_definitions definition
  where definition.discipline_id = p_discipline_id
  order by definition.definition_version desc
  limit 1;

  if not found then
    raise exception using errcode = '22023', message = 'DISCIPLINE_UNAVAILABLE';
  end if;

  insert into app_private.character_discipline_masteries (
    character_id,
    discipline_id,
    mastered_definition_version,
    source_kind,
    source_id
  ) values (
    p_character_id,
    v_definition.discipline_id,
    v_definition.definition_version,
    p_source_kind,
    p_source_id
  )
  on conflict on constraint character_discipline_masteries_pkey do nothing;

  get diagnostics v_rows_inserted = row_count;

  return query
  select
    mastery.character_id,
    mastery.discipline_id,
    mastery.mastered_definition_version,
    mastery.mastered_at,
    v_rows_inserted = 0
  from app_private.character_discipline_masteries mastery
  where mastery.character_id = p_character_id
    and mastery.discipline_id = p_discipline_id;
end;
$$;

revoke all on function public.record_character_discipline_mastery_v1(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_character_discipline_mastery_v1(uuid, text, text, text)
  to service_role;

create or replace function public.get_character_discipline_catalog_v2(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  discipline_id text,
  definition_version integer,
  name text,
  summary text,
  enabled_for_primary boolean,
  enabled_for_secondary boolean,
  profile_version integer,
  stat_offsets jsonb,
  mastered_at timestamptz
)
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  with latest as (
    select distinct on (definition.discipline_id)
      definition.discipline_id,
      definition.definition_version,
      definition.name,
      definition.summary,
      definition.enabled_for_primary,
      definition.enabled_for_secondary,
      profile.profile_version,
      profile.stat_offsets
    from app_private.discipline_definitions definition
    join app_private.discipline_primary_profiles profile
      on profile.discipline_id = definition.discipline_id
     and profile.profile_version = definition.primary_profile_version
    where definition.enabled_for_primary or definition.enabled_for_secondary
    order by definition.discipline_id, definition.definition_version desc
  )
  select
    latest.discipline_id,
    latest.definition_version,
    latest.name,
    latest.summary,
    latest.enabled_for_primary,
    latest.enabled_for_secondary,
    latest.profile_version,
    latest.stat_offsets,
    mastery.mastered_at
  from latest
  left join app_private.character_discipline_masteries mastery
    on mastery.character_id = p_character_id
   and mastery.discipline_id = latest.discipline_id
  where exists (
    select 1
    from public.characters character
    where character.id = p_character_id
      and character.user_id = p_user_id
  )
  order by latest.name, latest.discipline_id;
$$;

revoke all on function public.get_character_discipline_catalog_v2(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_discipline_catalog_v2(uuid, uuid)
  to service_role;

create or replace function public.get_character_active_build_v2(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  character_id uuid,
  schema_version integer,
  build_version bigint,
  primary_discipline_id text,
  primary_definition_version integer,
  primary_profile_version integer,
  primary_name text,
  primary_summary text,
  primary_enabled_for_primary boolean,
  primary_enabled_for_secondary boolean,
  primary_stat_offsets jsonb,
  secondary_discipline_id text,
  secondary_definition_version integer,
  secondary_name text,
  secondary_summary text,
  secondary_enabled_for_primary boolean,
  secondary_enabled_for_secondary boolean,
  primary_attunement_locked_until timestamptz,
  secondary_attunement_locked_until timestamptz,
  attunement_policy_version integer,
  primary_cooldown_seconds integer,
  secondary_cooldown_seconds integer,
  server_now timestamptz,
  updated_at timestamptz
)
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select
    build.character_id,
    build.schema_version,
    build.build_version,
    build.primary_discipline_id,
    build.primary_definition_version,
    build.primary_profile_version,
    primary_definition.name,
    primary_definition.summary,
    primary_definition.enabled_for_primary,
    primary_definition.enabled_for_secondary,
    primary_profile.stat_offsets,
    build.secondary_discipline_id,
    build.secondary_definition_version,
    secondary_definition.name,
    secondary_definition.summary,
    secondary_definition.enabled_for_primary,
    secondary_definition.enabled_for_secondary,
    build.primary_attunement_locked_until,
    build.secondary_attunement_locked_until,
    policy.version,
    policy.primary_cooldown_seconds,
    policy.secondary_cooldown_seconds,
    statement_timestamp(),
    build.updated_at
  from app_private.character_active_builds build
  join app_private.discipline_definitions primary_definition
    on primary_definition.discipline_id = build.primary_discipline_id
   and primary_definition.definition_version = build.primary_definition_version
  join app_private.discipline_primary_profiles primary_profile
    on primary_profile.discipline_id = build.primary_discipline_id
   and primary_profile.profile_version = build.primary_profile_version
  left join app_private.discipline_definitions secondary_definition
    on secondary_definition.discipline_id = build.secondary_discipline_id
   and secondary_definition.definition_version = build.secondary_definition_version
  join app_private.character_build_attunement_policy_state policy_state
    on policy_state.singleton
  join app_private.character_build_attunement_policies policy
    on policy.version = policy_state.current_policy_version
  where build.user_id = p_user_id
    and build.character_id = p_character_id;
$$;

revoke all on function public.get_character_active_build_v2(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_active_build_v2(uuid, uuid)
  to service_role;

create or replace function public.change_character_disciplines_v2(
  p_user_id uuid,
  p_character_id uuid,
  p_expected_build_version bigint,
  p_change_primary boolean,
  p_primary_discipline_id text,
  p_change_secondary boolean,
  p_secondary_discipline_id text,
  p_idempotency_key uuid,
  p_request_fingerprint text
)
returns table (
  character_id uuid,
  schema_version integer,
  build_version bigint,
  primary_discipline_id text,
  primary_definition_version integer,
  primary_profile_version integer,
  primary_name text,
  primary_summary text,
  primary_enabled_for_primary boolean,
  primary_enabled_for_secondary boolean,
  primary_stat_offsets jsonb,
  secondary_discipline_id text,
  secondary_definition_version integer,
  secondary_name text,
  secondary_summary text,
  secondary_enabled_for_primary boolean,
  secondary_enabled_for_secondary boolean,
  primary_attunement_locked_until timestamptz,
  secondary_attunement_locked_until timestamptz,
  attunement_policy_version integer,
  primary_cooldown_seconds integer,
  secondary_cooldown_seconds integer,
  server_now timestamptz,
  changed_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_command_name constant text := 'character.disciplines.change.v2';
  v_actor_key text := 'user:' || p_user_id::text;
  v_change_id uuid := gen_random_uuid();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
  v_build app_private.character_active_builds%rowtype;
  v_primary_definition app_private.discipline_definitions%rowtype;
  v_primary_profile app_private.discipline_primary_profiles%rowtype;
  v_secondary_definition app_private.discipline_definitions%rowtype;
  v_policy app_private.character_build_attunement_policies%rowtype;
  v_now timestamptz := clock_timestamp();
  v_primary_locked_until timestamptz;
  v_secondary_locked_until timestamptz;
begin
  if p_expected_build_version is null or p_expected_build_version < 1 then
    raise exception using errcode = '22023', message = 'CHARACTER_BUILD_EXPECTED_VERSION_INVALID';
  end if;
  if p_change_primary is null or p_change_secondary is null then
    raise exception using errcode = '22023', message = 'CHARACTER_BUILD_CHANGE_FLAGS_INVALID';
  end if;
  if not p_change_primary and not p_change_secondary then
    raise exception using errcode = '22023', message = 'CHARACTER_BUILD_NO_CHANGE';
  end if;

  insert into app_private.idempotency_records (
    actor_key,
    command_name,
    idempotency_key,
    request_fingerprint,
    result
  ) values (
    v_actor_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object('change_id', v_change_id)
  )
  on conflict (actor_key, command_name, idempotency_key) do nothing;

  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select * into v_existing
    from app_private.idempotency_records
    where actor_key = v_actor_key
      and command_name = v_command_name
      and idempotency_key = p_idempotency_key;

    if not found then
      raise exception using errcode = '40001', message = 'CHARACTER_BUILD_IDEMPOTENCY_UNAVAILABLE';
    end if;
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '22023', message = 'CHARACTER_BUILD_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      audit.character_id,
      2,
      audit.build_version_after,
      audit.to_primary_discipline_id,
      audit.to_primary_definition_version,
      audit.to_primary_profile_version,
      primary_definition.name,
      primary_definition.summary,
      primary_definition.enabled_for_primary,
      primary_definition.enabled_for_secondary,
      primary_profile.stat_offsets,
      audit.to_secondary_discipline_id,
      audit.to_secondary_definition_version,
      secondary_definition.name,
      secondary_definition.summary,
      secondary_definition.enabled_for_primary,
      secondary_definition.enabled_for_secondary,
      audit.primary_attunement_locked_until_after,
      audit.secondary_attunement_locked_until_after,
      policy.version,
      policy.primary_cooldown_seconds,
      policy.secondary_cooldown_seconds,
      v_now,
      audit.changed_at,
      true
    from app_private.character_build_change_audit audit
    join app_private.discipline_definitions primary_definition
      on primary_definition.discipline_id = audit.to_primary_discipline_id
     and primary_definition.definition_version = audit.to_primary_definition_version
    join app_private.discipline_primary_profiles primary_profile
      on primary_profile.discipline_id = audit.to_primary_discipline_id
     and primary_profile.profile_version = audit.to_primary_profile_version
    left join app_private.discipline_definitions secondary_definition
      on secondary_definition.discipline_id = audit.to_secondary_discipline_id
     and secondary_definition.definition_version = audit.to_secondary_definition_version
    join app_private.character_build_attunement_policies policy
      on policy.version = audit.attunement_policy_version
    where audit.id = (v_existing.result ->> 'change_id')::uuid;

    if not found then
      raise exception using errcode = '40001', message = 'CHARACTER_BUILD_IDEMPOTENT_RESULT_UNAVAILABLE';
    end if;
    return;
  end if;

  select * into v_build
  from app_private.character_active_builds build
  where build.character_id = p_character_id
    and build.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_NOT_FOUND';
  end if;

  if v_build.build_version <> p_expected_build_version then
    raise exception using
      errcode = '40001',
      message = 'CHARACTER_BUILD_VERSION_CONFLICT',
      detail = v_build.build_version::text;
  end if;

  select policy.* into v_policy
  from app_private.character_build_attunement_policy_state policy_state
  join app_private.character_build_attunement_policies policy
    on policy.version = policy_state.current_policy_version
  where policy_state.singleton;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_ATTUNEMENT_POLICY_UNAVAILABLE';
  end if;

  if p_change_primary then
    if p_primary_discipline_id is null or btrim(p_primary_discipline_id) = '' then
      raise exception using errcode = '22023', message = 'PRIMARY_DISCIPLINE_UNAVAILABLE';
    end if;

    select definition.* into v_primary_definition
    from app_private.discipline_definitions definition
    where definition.discipline_id = p_primary_discipline_id
      and definition.enabled_for_primary
    order by definition.definition_version desc
    limit 1;

    if not found then
      raise exception using errcode = '22023', message = 'PRIMARY_DISCIPLINE_UNAVAILABLE';
    end if;

    if v_build.primary_discipline_id = v_primary_definition.discipline_id then
      raise exception using errcode = '22023', message = 'PRIMARY_DISCIPLINE_ALREADY_ACTIVE';
    end if;

    if v_build.primary_attunement_locked_until is not null
      and v_build.primary_attunement_locked_until > v_now then
      raise exception using
        errcode = 'P0001',
        message = 'PRIMARY_ATTUNEMENT_LOCKED',
        detail = v_build.primary_attunement_locked_until::text;
    end if;

    select profile.* into v_primary_profile
    from app_private.discipline_primary_profiles profile
    where profile.discipline_id = v_primary_definition.discipline_id
      and profile.profile_version = v_primary_definition.primary_profile_version;

    if not found then
      raise exception using errcode = 'P0001', message = 'PRIMARY_PROFILE_UNAVAILABLE';
    end if;
  else
    select definition.* into v_primary_definition
    from app_private.discipline_definitions definition
    where definition.discipline_id = v_build.primary_discipline_id
      and definition.definition_version = v_build.primary_definition_version;

    if not found then
      raise exception using errcode = 'P0001', message = 'PRIMARY_DISCIPLINE_PIN_UNAVAILABLE';
    end if;

    select profile.* into v_primary_profile
    from app_private.discipline_primary_profiles profile
    where profile.discipline_id = v_build.primary_discipline_id
      and profile.profile_version = v_build.primary_profile_version;

    if not found then
      raise exception using errcode = 'P0001', message = 'PRIMARY_PROFILE_PIN_UNAVAILABLE';
    end if;
  end if;

  if p_change_secondary then
    if p_secondary_discipline_id is null then
      if v_build.secondary_discipline_id is null then
        raise exception using errcode = '22023', message = 'SECONDARY_DISCIPLINE_ALREADY_ACTIVE';
      end if;
      v_secondary_definition := null;
    else
      select definition.* into v_secondary_definition
      from app_private.discipline_definitions definition
      where definition.discipline_id = p_secondary_discipline_id
        and definition.enabled_for_secondary
      order by definition.definition_version desc
      limit 1;

      if not found then
        raise exception using errcode = '22023', message = 'SECONDARY_DISCIPLINE_UNAVAILABLE';
      end if;

      if not exists (
        select 1
        from app_private.character_discipline_masteries mastery
        where mastery.character_id = v_build.character_id
          and mastery.discipline_id = v_secondary_definition.discipline_id
      ) then
        raise exception using errcode = '22023', message = 'SECONDARY_DISCIPLINE_NOT_MASTERED';
      end if;

      if v_build.secondary_discipline_id = v_secondary_definition.discipline_id then
        raise exception using errcode = '22023', message = 'SECONDARY_DISCIPLINE_ALREADY_ACTIVE';
      end if;
    end if;

    if v_build.secondary_attunement_locked_until is not null
      and v_build.secondary_attunement_locked_until > v_now then
      raise exception using
        errcode = 'P0001',
        message = 'SECONDARY_ATTUNEMENT_LOCKED',
        detail = v_build.secondary_attunement_locked_until::text;
    end if;
  elsif v_build.secondary_discipline_id is not null then
    select definition.* into v_secondary_definition
    from app_private.discipline_definitions definition
    where definition.discipline_id = v_build.secondary_discipline_id
      and definition.definition_version = v_build.secondary_definition_version;

    if not found then
      raise exception using errcode = 'P0001', message = 'SECONDARY_DISCIPLINE_PIN_UNAVAILABLE';
    end if;
  else
    v_secondary_definition := null;
  end if;

  if v_secondary_definition.discipline_id is not null
    and v_secondary_definition.discipline_id = v_primary_definition.discipline_id then
    raise exception using errcode = '22023', message = 'DISCIPLINE_SLOTS_MUST_DIFFER';
  end if;

  v_primary_locked_until := case
    when p_change_primary then v_now + (v_policy.primary_cooldown_seconds * interval '1 second')
    else v_build.primary_attunement_locked_until
  end;
  v_secondary_locked_until := case
    when p_change_secondary then v_now + (v_policy.secondary_cooldown_seconds * interval '1 second')
    else v_build.secondary_attunement_locked_until
  end;

  update app_private.character_active_builds build
  set
    schema_version = 2,
    build_version = v_build.build_version + 1,
    primary_discipline_id = v_primary_definition.discipline_id,
    primary_definition_version = v_primary_definition.definition_version,
    primary_profile_version = v_primary_profile.profile_version,
    secondary_discipline_id = v_secondary_definition.discipline_id,
    secondary_definition_version = v_secondary_definition.definition_version,
    primary_attunement_locked_until = v_primary_locked_until,
    secondary_attunement_locked_until = v_secondary_locked_until,
    last_attunement_policy_version = v_policy.version,
    updated_at = v_now
  where build.character_id = v_build.character_id;

  insert into app_private.character_build_change_audit (
    id,
    character_id,
    user_id,
    command_name,
    build_version_before,
    build_version_after,
    from_primary_discipline_id,
    from_primary_definition_version,
    from_primary_profile_version,
    to_primary_discipline_id,
    to_primary_definition_version,
    to_primary_profile_version,
    request_fingerprint,
    changed_at,
    change_primary,
    change_secondary,
    from_secondary_discipline_id,
    from_secondary_definition_version,
    to_secondary_discipline_id,
    to_secondary_definition_version,
    attunement_policy_version,
    primary_attunement_locked_until_after,
    secondary_attunement_locked_until_after
  ) values (
    v_change_id,
    v_build.character_id,
    p_user_id,
    v_command_name,
    v_build.build_version,
    v_build.build_version + 1,
    v_build.primary_discipline_id,
    v_build.primary_definition_version,
    v_build.primary_profile_version,
    v_primary_definition.discipline_id,
    v_primary_definition.definition_version,
    v_primary_profile.profile_version,
    p_request_fingerprint,
    v_now,
    p_change_primary,
    p_change_secondary,
    v_build.secondary_discipline_id,
    v_build.secondary_definition_version,
    v_secondary_definition.discipline_id,
    v_secondary_definition.definition_version,
    v_policy.version,
    v_primary_locked_until,
    v_secondary_locked_until
  );

  return query
  select
    v_build.character_id,
    2,
    v_build.build_version + 1,
    v_primary_definition.discipline_id,
    v_primary_definition.definition_version,
    v_primary_profile.profile_version,
    v_primary_definition.name,
    v_primary_definition.summary,
    v_primary_definition.enabled_for_primary,
    v_primary_definition.enabled_for_secondary,
    v_primary_profile.stat_offsets,
    v_secondary_definition.discipline_id,
    v_secondary_definition.definition_version,
    v_secondary_definition.name,
    v_secondary_definition.summary,
    v_secondary_definition.enabled_for_primary,
    v_secondary_definition.enabled_for_secondary,
    v_primary_locked_until,
    v_secondary_locked_until,
    v_policy.version,
    v_policy.primary_cooldown_seconds,
    v_policy.secondary_cooldown_seconds,
    v_now,
    v_now,
    false;
end;
$$;

revoke all on function public.change_character_disciplines_v2(
  uuid, uuid, bigint, boolean, text, boolean, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.change_character_disciplines_v2(
  uuid, uuid, bigint, boolean, text, boolean, text, uuid, text
) to service_role;

create or replace function public.change_character_primary_discipline_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_expected_build_version bigint,
  p_primary_discipline_id text,
  p_idempotency_key uuid,
  p_request_fingerprint text
)
returns table (
  character_id uuid,
  build_version bigint,
  primary_discipline_id text,
  primary_definition_version integer,
  primary_profile_version integer,
  primary_name text,
  primary_summary text,
  primary_stat_offsets jsonb,
  changed_at timestamptz,
  replayed boolean
)
language sql
security definer
set search_path = pg_catalog, public, app_private
as $$
  select
    changed.character_id,
    changed.build_version,
    changed.primary_discipline_id,
    changed.primary_definition_version,
    changed.primary_profile_version,
    changed.primary_name,
    changed.primary_summary,
    changed.primary_stat_offsets,
    changed.changed_at,
    changed.replayed
  from public.change_character_disciplines_v2(
    p_user_id,
    p_character_id,
    p_expected_build_version,
    true,
    p_primary_discipline_id,
    false,
    null,
    p_idempotency_key,
    p_request_fingerprint
  ) changed;
$$;

revoke all on function public.change_character_primary_discipline_v1(
  uuid, uuid, bigint, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.change_character_primary_discipline_v1(
  uuid, uuid, bigint, text, uuid, text
) to service_role;

commit;
