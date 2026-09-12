begin;

-- Phase-4 testing remains deliberately open, but test entitlement must never masquerade as earned
-- Discipline Mastery. This policy is server-owned so disabling testing later restores the authored
-- prerequisite graph without a browser-side bypass.
create table if not exists app_private.discipline_unlock_policy_state (
  singleton boolean primary key default true,
  policy_version integer not null,
  testing_open boolean not null,
  updated_at timestamptz not null default clock_timestamp(),
  constraint discipline_unlock_policy_state_singleton check (singleton),
  constraint discipline_unlock_policy_state_version_positive check (policy_version > 0)
);

revoke all on table app_private.discipline_unlock_policy_state from public, anon, authenticated;
grant select on table app_private.discipline_unlock_policy_state to service_role;

insert into app_private.discipline_unlock_policy_state (singleton, policy_version, testing_open)
values (true, 1, true)
on conflict (singleton) do update
set policy_version = greatest(app_private.discipline_unlock_policy_state.policy_version, excluded.policy_version),
    testing_open = true,
    updated_at = clock_timestamp();

comment on table app_private.discipline_unlock_policy_state is
  'Server-owned Discipline acquisition policy. testing_open grants effective access to published Disciplines without creating Mastery facts or earned Mastery XP.';

create table if not exists app_private.discipline_rekindling_prerequisites (
  discipline_id text primary key,
  minimum_rekindling_count integer not null check (minimum_rekindling_count between 1 and 3)
);

revoke all on table app_private.discipline_rekindling_prerequisites from public, anon, authenticated;
grant select on table app_private.discipline_rekindling_prerequisites to service_role;

insert into app_private.discipline_rekindling_prerequisites (discipline_id, minimum_rekindling_count)
values
  ('blade-saint', 1),
  ('warcaller', 1),
  ('chronist', 1),
  ('riftwalker', 1),
  ('gravebinder', 1),
  ('eidolist', 1),
  ('oracle', 1),
  ('sanguinist', 1),
  ('starcaller', 2),
  ('spellwright', 3)
on conflict (discipline_id) do update
set minimum_rekindling_count = excluded.minimum_rekindling_count;

comment on table app_private.discipline_rekindling_prerequisites is
  'Server-owned minimum completed-Rekindling gates for published Discipline acquisition. Planned identities may be pre-registered safely; publication remains a separate definition gate.';

create or replace function app_private.discipline_testing_open_v1()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select coalesce((select testing_open from app_private.discipline_unlock_policy_state where singleton), false);
$$;

revoke all on function app_private.discipline_testing_open_v1() from public, anon, authenticated;

-- Retire the earlier support-Mastery implementation of testing access. It correctly kept browser
-- authority out of the client, but Phase 4 later introduced earned Mastery XP and therefore needs a
-- distinct entitlement layer.
drop trigger if exists grant_active_testing_disciplines_to_character_v1 on public.characters;
drop trigger if exists grant_active_testing_discipline_definition_v1 on app_private.discipline_definitions;
drop function if exists app_private.grant_active_testing_disciplines_to_character_v1();
drop function if exists app_private.grant_active_testing_discipline_definition_v1();

-- The Phase-4 mastery migration backfilled every then-existing Mastery fact to 1,000 XP. Reset only
-- rows whose sole fact was the explicit testing grant. Demonstration history is preserved because it
-- came from committed qualifying battle events and may remain useful during continued testing.
update app_private.character_discipline_progress progress
set mastery_xp = 0,
    updated_at = clock_timestamp()
where exists (
  select 1
  from app_private.character_discipline_masteries mastery
  where mastery.character_id = progress.character_id
    and mastery.discipline_id = progress.discipline_id
    and mastery.source_kind = 'support'
    and mastery.source_id = 'active-player-discipline-testing:v1'
);

delete from app_private.character_discipline_masteries
where source_kind = 'support'
  and source_id = 'active-player-discipline-testing:v1';

-- Earned stage deliberately ignores the testing policy. Owner/system/gameplay mastery facts remain
-- authoritative; otherwise the numerical Mastery track determines the current earned stage.
create or replace function app_private.discipline_mastery_stage_v1(
  p_character_id uuid,
  p_discipline_id text
)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select case
    when exists (
      select 1
      from app_private.character_discipline_masteries mastery
      where mastery.character_id = p_character_id
        and mastery.discipline_id = p_discipline_id
        and not (
          mastery.source_kind = 'support'
          and mastery.source_id = 'active-player-discipline-testing:v1'
        )
    ) then 5
    else coalesce((
      select case
        when progress.mastery_xp >= 1000 then 5
        when progress.mastery_xp >= 600 then 4
        when progress.mastery_xp >= 300 then 3
        when progress.mastery_xp >= 100 then 2
        else 1
      end
      from app_private.character_discipline_progress progress
      where progress.character_id = p_character_id
        and progress.discipline_id = p_discipline_id
    ), 1)
  end;
$$;

create or replace function app_private.discipline_release_unlocked_v1(
  p_character_id uuid,
  p_discipline_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select exists (
    select 1 from public.characters character where character.id = p_character_id
  )
  and not exists (
    select 1
    from app_private.discipline_mastery_prerequisites requirement
    where requirement.discipline_id = p_discipline_id
      and app_private.discipline_mastery_stage_v1(
        p_character_id,
        requirement.required_discipline_id
      ) < requirement.minimum_stage
  )
  and not exists (
    select 1
    from app_private.discipline_rekindling_prerequisites requirement
    join public.characters character on character.id = p_character_id
    where requirement.discipline_id = p_discipline_id
      and greatest(character.progression_cycle - 1, 0) < requirement.minimum_rekindling_count
  );
$$;

-- Effective acquisition is open for every currently published Primary while testing is active.
-- Planned Atlas entries have no enabled definition and therefore can never be selected by this
-- policy before their actual combat content is published.
create or replace function app_private.discipline_unlocked_v1(
  p_character_id uuid,
  p_discipline_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select exists (
    select 1
    from app_private.discipline_definitions definition
    where definition.discipline_id = p_discipline_id
      and definition.enabled_for_primary
  )
  and (
    app_private.discipline_testing_open_v1()
    or app_private.discipline_release_unlocked_v1(p_character_id, p_discipline_id)
  );
$$;

-- Testers receive the whole published library for an active Discipline without converting that
-- convenience into earned stage. When testing is disabled, normal 4/2/2 stage provisioning resumes.
create or replace function app_private.provision_mastery_skills_v1(p_character_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public, app_private
as $$
  insert into app_private.character_skill_unlocks (
    character_id,
    skill_id,
    skill_content_version,
    source_discipline_id,
    learned_at,
    source_kind,
    source_id
  )
  select
    p_character_id,
    catalog.skill_id,
    catalog.content_version,
    catalog.discipline_id,
    statement_timestamp(),
    case when app_private.discipline_testing_open_v1() then 'support' else 'gameplay' end,
    case when app_private.discipline_testing_open_v1()
      then 'discipline-testing-open:v1'
      else 'discipline-mastery:v1'
    end
  from app_private.phase4_skill_catalog catalog
  join app_private.character_active_builds build
    on build.character_id = p_character_id
   and (
     catalog.discipline_id = build.primary_discipline_id
     or catalog.discipline_id = build.secondary_discipline_id
   )
  where app_private.discipline_unlocked_v1(p_character_id, catalog.discipline_id)
    and (
      app_private.discipline_testing_open_v1()
      or app_private.discipline_mastery_stage_v1(p_character_id, catalog.discipline_id) >= catalog.minimum_stage
    )
  on conflict (character_id, skill_id) do nothing;
$$;

-- Keep the existing catalog contract so current server code does not gain a second build path.
-- In testing, a synthetic mastered_at makes every published Secondary available; outside testing,
-- only an actual mastery fact does so.
create or replace function public.get_character_discipline_catalog_v2(
  p_user_id uuid,
  p_character_id uuid
)
returns table(
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
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  with latest as (
    select distinct on (definition.discipline_id) definition.*
    from app_private.discipline_definitions definition
    where definition.enabled_for_primary or definition.enabled_for_secondary
    order by definition.discipline_id, definition.definition_version desc
  ), policy as (
    select testing_open, updated_at
    from app_private.discipline_unlock_policy_state
    where singleton
  )
  select
    definition.discipline_id,
    definition.definition_version,
    definition.name,
    definition.summary,
    definition.enabled_for_primary
      and app_private.discipline_unlocked_v1(p_character_id, definition.discipline_id),
    definition.enabled_for_secondary,
    profile.profile_version,
    profile.stat_offsets,
    case
      when mastery.mastered_at is not null then mastery.mastered_at
      when coalesce(policy.testing_open, false) and definition.enabled_for_secondary then policy.updated_at
      else null
    end
  from latest definition
  join app_private.discipline_primary_profiles profile
    on profile.discipline_id = definition.discipline_id
   and profile.profile_version = definition.primary_profile_version
  left join app_private.character_discipline_masteries mastery
    on mastery.character_id = p_character_id
   and mastery.discipline_id = definition.discipline_id
  left join policy on true
  where exists (
    select 1
    from public.characters character
    where character.id = p_character_id
      and character.user_id = p_user_id
  )
  order by definition.name, definition.discipline_id;
$$;

-- The existing progress endpoint now reports earned progress while its unlocked flag continues to
-- mean effective current access. This prevents the Profile from labelling test entitlement as Master.
create or replace function public.get_character_discipline_progress_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table(
  discipline_id text,
  mastery_xp integer,
  stage integer,
  unlocked boolean,
  demonstrated_skill_count integer
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select
    definition.discipline_id,
    coalesce(progress.mastery_xp, 0),
    app_private.discipline_mastery_stage_v1(p_character_id, definition.discipline_id),
    app_private.discipline_unlocked_v1(p_character_id, definition.discipline_id),
    coalesce(cardinality(progress.demonstrated_skills), 0)
  from (
    select distinct discipline_id
    from app_private.discipline_definitions
    where enabled_for_primary
  ) definition
  left join app_private.character_discipline_progress progress
    on progress.character_id = p_character_id
   and progress.discipline_id = definition.discipline_id
  where exists (
    select 1
    from public.characters character
    where character.id = p_character_id
      and character.user_id = p_user_id
  )
  order by definition.discipline_id;
$$;

-- Rich Atlas projection keeps release eligibility separate from the temporary testing overlay.
create or replace function public.get_character_discipline_atlas_progress_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table(
  discipline_id text,
  mastery_xp integer,
  earned_stage integer,
  release_unlocked boolean,
  effective_unlocked boolean,
  testing_access boolean,
  demonstrated_skill_count integer
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select
    definition.discipline_id,
    coalesce(progress.mastery_xp, 0),
    app_private.discipline_mastery_stage_v1(p_character_id, definition.discipline_id),
    app_private.discipline_release_unlocked_v1(p_character_id, definition.discipline_id),
    app_private.discipline_unlocked_v1(p_character_id, definition.discipline_id),
    app_private.discipline_testing_open_v1(),
    coalesce(cardinality(progress.demonstrated_skills), 0)
  from (
    select distinct discipline_id
    from app_private.discipline_definitions
    where enabled_for_primary
  ) definition
  left join app_private.character_discipline_progress progress
    on progress.character_id = p_character_id
   and progress.discipline_id = definition.discipline_id
  where exists (
    select 1
    from public.characters character
    where character.id = p_character_id
      and character.user_id = p_user_id
  )
  order by definition.discipline_id;
$$;

revoke all on function app_private.discipline_mastery_stage_v1(uuid, text) from public, anon, authenticated;
revoke all on function app_private.discipline_release_unlocked_v1(uuid, text) from public, anon, authenticated;
revoke all on function app_private.discipline_unlocked_v1(uuid, text) from public, anon, authenticated;
revoke all on function app_private.provision_mastery_skills_v1(uuid) from public, anon, authenticated;
revoke all on function public.get_character_discipline_atlas_progress_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_character_discipline_atlas_progress_v1(uuid, uuid) to service_role;

-- Re-provision current active builds under the separated testing policy. Existing rows remain
-- idempotent; future testing-provisioned rows carry explicit support provenance.
select app_private.provision_mastery_skills_v1(character.id)
from public.characters character;


-- Keep Secondary selection on the same server-owned testing policy as Primary selection.
-- When testing closes, genuine Mastery is required exactly as before.
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

      if not app_private.discipline_testing_open_v1()
        and not exists (
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
