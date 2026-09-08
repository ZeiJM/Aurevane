begin;

create table app_private.character_secondary_access_policies (
  version integer primary key,
  mastery_required boolean not null,
  label text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint character_secondary_access_policy_version_positive check (version > 0),
  constraint character_secondary_access_policy_label_length check (char_length(label) between 1 and 120)
);

create table app_private.character_secondary_access_policy_state (
  singleton boolean primary key default true,
  current_policy_version integer not null
    references app_private.character_secondary_access_policies(version),
  updated_at timestamptz not null default clock_timestamp(),
  constraint character_secondary_access_policy_state_singleton check (singleton)
);

comment on table app_private.character_secondary_access_policies is
  'Versioned server-only Secondary Discipline access policy. Mastery facts remain authoritative progression data, while the active policy decides whether mastery gates Secondary selection.';
comment on table app_private.character_secondary_access_policy_state is
  'Server-only pointer to the Secondary Discipline access policy used for new build changes.';

revoke all on table app_private.character_secondary_access_policies from public, anon, authenticated;
revoke all on table app_private.character_secondary_access_policy_state from public, anon, authenticated;
grant select on table app_private.character_secondary_access_policies to service_role;
grant select on table app_private.character_secondary_access_policy_state to service_role;

insert into app_private.character_secondary_access_policies (
  version,
  mastery_required,
  label
)
values
  (1, true, 'Mastery-gated progression'),
  (2, false, 'All-player testing access');

insert into app_private.character_secondary_access_policy_state (
  singleton,
  current_policy_version
)
values (true, 2);

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
  v_secondary_access_policy app_private.character_secondary_access_policies%rowtype;
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

  select policy.* into v_secondary_access_policy
  from app_private.character_secondary_access_policy_state policy_state
  join app_private.character_secondary_access_policies policy
    on policy.version = policy_state.current_policy_version
  where policy_state.singleton;

  if not found then
    raise exception using errcode = 'P0001', message = 'SECONDARY_ACCESS_POLICY_UNAVAILABLE';
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

      if v_secondary_access_policy.mastery_required and not exists (
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

commit;
