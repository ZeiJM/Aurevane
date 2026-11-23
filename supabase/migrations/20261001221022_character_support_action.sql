begin;

alter table app_private.character_active_builds
  add column support_action_id text not null default 'basic.guard'
  constraint character_active_build_support_action_allowed
  check (support_action_id in ('basic.guard', 'basic.recover', 'basic.recover.mp'));
alter table app_private.character_saved_build_loadouts
  add column support_action_id text not null default 'basic.guard'
  constraint character_saved_build_support_action_allowed
  check (support_action_id in ('basic.guard', 'basic.recover', 'basic.recover.mp'));

create table app_private.character_support_action_idempotency (
  character_id uuid not null references public.characters(id) on delete cascade,
  idempotency_key uuid not null,
  request_fingerprint text not null check (char_length(request_fingerprint) between 8 and 160),
  support_action_id text not null check (support_action_id in ('basic.guard', 'basic.recover', 'basic.recover.mp')),
  build_version_after bigint not null check (build_version_after > 0),
  saved_at timestamptz not null,
  primary key (character_id, idempotency_key)
);
create table app_private.character_support_action_change_audit (
  id uuid primary key,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  build_version_before bigint not null,
  build_version_after bigint not null,
  before_support_action_id text not null,
  after_support_action_id text not null,
  request_fingerprint text not null,
  changed_at timestamptz not null
);
alter table app_private.character_support_action_idempotency enable row level security;
alter table app_private.character_support_action_change_audit enable row level security;
revoke all on app_private.character_support_action_idempotency, app_private.character_support_action_change_audit from public, anon, authenticated;
grant select on app_private.character_support_action_idempotency, app_private.character_support_action_change_audit to service_role;

-- New read contract leaves the v2 table-returning RPC unchanged. One SQL statement pins
-- both the version and Support Action, so concurrent saves cannot mix two versions.
create function public.get_character_active_build_v4(p_user_id uuid, p_character_id uuid)
returns jsonb
language sql security definer stable
set search_path = pg_catalog, public, app_private
as $$
  select to_jsonb(active) || jsonb_build_object('support_action_id', build.support_action_id)
  from public.get_character_active_build_v2(p_user_id, p_character_id) active
  join app_private.character_active_builds build on build.character_id = active.character_id
  where build.user_id = p_user_id;
$$;
revoke all on function public.get_character_active_build_v4(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_character_active_build_v4(uuid,uuid) to service_role;

create function public.get_character_saved_build_loadouts_v2(p_user_id uuid, p_character_id uuid)
returns table (slot_index smallint, name text, primary_discipline_id text,
  secondary_discipline_id text, discipline_skills jsonb, source_build_version bigint,
  saved_at timestamptz, updated_at timestamptz, support_action_id text)
language sql security definer stable
set search_path = pg_catalog, public, app_private
as $$
  select old.slot_index, old.name, old.primary_discipline_id, old.secondary_discipline_id,
    old.discipline_skills, old.source_build_version, old.saved_at, old.updated_at, loadout.support_action_id
  from public.get_character_saved_build_loadouts_v1(p_user_id,p_character_id) old
  join app_private.character_saved_build_loadouts loadout
    on loadout.character_id = p_character_id and loadout.slot_index = old.slot_index;
$$;
revoke all on function public.get_character_saved_build_loadouts_v2(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_character_saved_build_loadouts_v2(uuid,uuid) to service_role;

create function public.save_character_support_action_v1(
  p_user_id uuid, p_character_id uuid, p_expected_build_version bigint,
  p_support_action_id text, p_idempotency_key uuid, p_request_fingerprint text
)
returns table (build_version bigint, replayed boolean, saved_at timestamptz)
language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_build app_private.character_active_builds%rowtype;
  v_existing app_private.character_support_action_idempotency%rowtype;
  v_before text;
  v_now timestamptz := clock_timestamp();
begin
  if p_support_action_id is null or p_support_action_id not in ('basic.guard','basic.recover','basic.recover.mp') then
    raise exception using errcode = '22023', message = 'SUPPORT_ACTION_INVALID';
  end if;
  if p_expected_build_version is null or p_expected_build_version < 1 then
    raise exception using errcode = '22023', message = 'CHARACTER_BUILD_VERSION_INVALID';
  end if;
  if p_idempotency_key is null or p_request_fingerprint is null or char_length(p_request_fingerprint) not between 8 and 160 then
    raise exception using errcode = '22023', message = 'SUPPORT_ACTION_REQUEST_INVALID';
  end if;
  select * into v_build from app_private.character_active_builds build
    where build.user_id = p_user_id and build.character_id = p_character_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_NOT_FOUND'; end if;
  select * into v_existing from app_private.character_support_action_idempotency receipt
    where receipt.character_id = p_character_id and receipt.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint or v_existing.support_action_id <> p_support_action_id then
      raise exception using errcode = 'P0001', message = 'CHARACTER_SUPPORT_ACTION_IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_existing.build_version_after, true, v_existing.saved_at;
    return;
  end if;
  if v_build.build_version <> p_expected_build_version then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_VERSION_CONFLICT';
  end if;
  v_before := v_build.support_action_id;
  update app_private.character_active_builds build
    set support_action_id = p_support_action_id, build_version = build.build_version + 1, updated_at = v_now
    where build.character_id = p_character_id returning * into v_build;
  insert into app_private.character_support_action_change_audit
    (id, character_id, user_id, build_version_before, build_version_after,
     before_support_action_id, after_support_action_id, request_fingerprint, changed_at)
    values (gen_random_uuid(),p_character_id,p_user_id,p_expected_build_version,v_build.build_version,
      v_before,p_support_action_id,p_request_fingerprint,v_now);
  insert into app_private.character_support_action_idempotency
    (character_id,idempotency_key,request_fingerprint,support_action_id,build_version_after,saved_at)
    values (p_character_id,p_idempotency_key,p_request_fingerprint,p_support_action_id,v_build.build_version,v_now);
  return query select v_build.build_version,false,v_now;
end;
$$;
revoke all on function public.save_character_support_action_v1(uuid,uuid,bigint,text,uuid,text) from public, anon, authenticated;
grant execute on function public.save_character_support_action_v1(uuid,uuid,bigint,text,uuid,text) to service_role;

create or replace function public.get_character_committed_build_snapshot_v2(
  p_user_id uuid,
  p_character_id uuid
)
returns jsonb
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select jsonb_build_object(
    'schemaVersion', build.schema_version,
    'buildVersion', build.build_version,
    'supportActionId', build.support_action_id,
    'primary', jsonb_build_object(
      'disciplineId', build.primary_discipline_id,
      'definitionVersion', build.primary_definition_version,
      'profileVersion', build.primary_profile_version
    ),
    'secondary', case
      when build.secondary_discipline_id is null then null
      else jsonb_build_object(
        'disciplineId', build.secondary_discipline_id,
        'definitionVersion', build.secondary_definition_version
      )
    end,
    'disciplineSkills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slotIndex', equipped.slot_index,
        'skillId', equipped.skill_id,
        'contentVersion', equipped.skill_content_version,
        'sourceDisciplineId', equipped.source_discipline_id
      ) order by equipped.slot_index)
      from app_private.character_build_discipline_skills equipped
      where equipped.character_id = build.character_id
    ), '[]'::jsonb),
    'extensions', jsonb_build_object(
      'resonance', app_private.resolve_resonance_reference_v1(
        build.primary_discipline_id,
        build.secondary_discipline_id
      ),
      'essence', app_private.resolve_essence_reference_v1(
        build.primary_discipline_id,
        build.secondary_discipline_id
      ),
      'equipmentSkills', '[]'::jsonb,
      'supernatural', null,
      'prestige', null
    )
  )
  from app_private.character_active_builds build
  where build.user_id = p_user_id
    and build.character_id = p_character_id;
$$;

revoke all on function public.get_character_committed_build_snapshot_v2(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_committed_build_snapshot_v2(uuid, uuid)
  to service_role;


create or replace function public.save_character_build_loadout_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_slot_index smallint,
  p_name text,
  p_expected_build_version bigint,
  p_idempotency_key uuid,
  p_request_fingerprint text
)
returns table (
  slot_index smallint,
  name text,
  source_build_version bigint,
  saved_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_build app_private.character_active_builds%rowtype;
  v_existing app_private.character_saved_build_loadout_save_idempotency%rowtype;
  v_skills jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if p_slot_index is null or p_slot_index not between 1 and 8 then
    raise exception using errcode = '22023', message = 'SAVED_BUILD_LOADOUT_SLOT_INVALID';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then
    raise exception using errcode = '22023', message = 'SAVED_BUILD_LOADOUT_NAME_INVALID';
  end if;
  if p_expected_build_version is null or p_expected_build_version < 1 then
    raise exception using errcode = '22023', message = 'CHARACTER_BUILD_VERSION_INVALID';
  end if;
  if p_request_fingerprint is null or char_length(p_request_fingerprint) not between 8 and 160 then
    raise exception using errcode = '22023', message = 'SAVED_BUILD_LOADOUT_FINGERPRINT_INVALID';
  end if;

  select * into v_build
  from app_private.character_active_builds build
  where build.user_id = p_user_id
    and build.character_id = p_character_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_NOT_FOUND';
  end if;

  select * into v_existing
  from app_private.character_saved_build_loadout_save_idempotency idempotency
  where idempotency.character_id = p_character_id
    and idempotency.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or v_existing.slot_index <> p_slot_index then
      raise exception using errcode = 'P0001', message = 'SAVED_BUILD_LOADOUT_IDEMPOTENCY_CONFLICT';
    end if;
    return query
    select
      loadout.slot_index,
      loadout.name,
      loadout.source_build_version,
      loadout.saved_at,
      true
    from app_private.character_saved_build_loadouts loadout
    where loadout.character_id = p_character_id
      and loadout.slot_index = p_slot_index;
    return;
  end if;

  if v_build.build_version <> p_expected_build_version then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_VERSION_CONFLICT';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'skillId', equipped.skill_id,
    'contentVersion', equipped.skill_content_version,
    'sourceDisciplineId', equipped.source_discipline_id
  ) order by equipped.slot_index), '[]'::jsonb)
  into v_skills
  from app_private.character_build_discipline_skills equipped
  where equipped.character_id = p_character_id;

  insert into app_private.character_saved_build_loadouts (
    character_id,
    slot_index,
    name,
    primary_discipline_id,
    secondary_discipline_id,
    discipline_skills,
    support_action_id,
    source_build_version,
    saved_at,
    updated_at
  ) values (
    p_character_id,
    p_slot_index,
    btrim(p_name),
    v_build.primary_discipline_id,
    v_build.secondary_discipline_id,
    v_skills,
    v_build.support_action_id,
    v_build.build_version,
    v_now,
    v_now
  )
  on conflict on constraint character_saved_build_loadouts_pkey do update set
    name = excluded.name,
    primary_discipline_id = excluded.primary_discipline_id,
    secondary_discipline_id = excluded.secondary_discipline_id,
    discipline_skills = excluded.discipline_skills,
    support_action_id = excluded.support_action_id,
    source_build_version = excluded.source_build_version,
    updated_at = excluded.updated_at;

  insert into app_private.character_saved_build_loadout_save_idempotency (
    character_id,
    idempotency_key,
    request_fingerprint,
    slot_index,
    saved_at
  ) values (
    p_character_id,
    p_idempotency_key,
    p_request_fingerprint,
    p_slot_index,
    v_now
  );

  return query
  select
    loadout.slot_index,
    loadout.name,
    loadout.source_build_version,
    loadout.saved_at,
    false
  from app_private.character_saved_build_loadouts loadout
  where loadout.character_id = p_character_id
    and loadout.slot_index = p_slot_index;
end;
$$;

revoke all on function public.save_character_build_loadout_v1(uuid, uuid, smallint, text, bigint, uuid, text)
  from public, anon, authenticated;
grant execute on function public.save_character_build_loadout_v1(uuid, uuid, smallint, text, bigint, uuid, text)
  to service_role;


create or replace function public.activate_character_build_loadout_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_slot_index smallint,
  p_expected_build_version bigint,
  p_idempotency_key uuid,
  p_request_fingerprint text
)
returns table (
  build_version bigint,
  replayed boolean,
  activated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_build app_private.character_active_builds%rowtype;
  v_loadout app_private.character_saved_build_loadouts%rowtype;
  v_existing app_private.character_saved_build_loadout_activation_idempotency%rowtype;
  v_change_primary boolean;
  v_change_secondary boolean;
  v_current_skills jsonb;
  v_after_version bigint;
  v_now timestamptz := clock_timestamp();
  v_disc_fingerprint text;
  v_skill_fingerprint text;
begin
  if p_slot_index is null or p_slot_index not between 1 and 8 then
    raise exception using errcode = '22023', message = 'SAVED_BUILD_LOADOUT_SLOT_INVALID';
  end if;
  if p_expected_build_version is null or p_expected_build_version < 1 then
    raise exception using errcode = '22023', message = 'CHARACTER_BUILD_VERSION_INVALID';
  end if;
  if p_request_fingerprint is null or char_length(p_request_fingerprint) not between 8 and 160 then
    raise exception using errcode = '22023', message = 'SAVED_BUILD_LOADOUT_FINGERPRINT_INVALID';
  end if;

  select *
  into v_build
  from app_private.character_active_builds build
  where build.user_id = p_user_id
    and build.character_id = p_character_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_NOT_FOUND';
  end if;

  select *
  into v_existing
  from app_private.character_saved_build_loadout_activation_idempotency idempotency
  where idempotency.character_id = p_character_id
    and idempotency.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = 'P0001', message = 'SAVED_BUILD_LOADOUT_IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_existing.build_version_after, true, v_existing.activated_at;
    return;
  end if;

  if v_build.build_version <> p_expected_build_version then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_VERSION_CONFLICT';
  end if;

  select *
  into v_loadout
  from app_private.character_saved_build_loadouts loadout
  where loadout.character_id = p_character_id
    and loadout.slot_index = p_slot_index;

  if not found then
    raise exception using errcode = 'P0001', message = 'SAVED_BUILD_LOADOUT_NOT_FOUND';
  end if;

  if exists (
    select 1
    from app_private.phase4_discipline_rebalance_publication publication
    where publication.activated_at is not null
  ) then
    select coalesce(
      jsonb_agg(
        case
          when catalog.skill_id is not null then
            selected.element || jsonb_build_object('contentVersion', catalog.content_version)
          else selected.element
        end
        order by selected.ordinality
      ),
      '[]'::jsonb
    )
    into v_loadout.discipline_skills
    from jsonb_array_elements(v_loadout.discipline_skills)
      with ordinality as selected(element, ordinality)
    left join app_private.phase4_skill_catalog catalog
      on catalog.skill_id = selected.element ->> 'skillId';
  elsif exists (
    select 1
    from app_private.phase4_combat_publication publication
    where publication.activated_at is not null
  ) then
    select coalesce(
      jsonb_agg(
        case
          when release.skill_id is not null then
            selected.element || jsonb_build_object('contentVersion', release.content_version)
          else selected.element
        end
        order by selected.ordinality
      ),
      '[]'::jsonb
    )
    into v_loadout.discipline_skills
    from jsonb_array_elements(v_loadout.discipline_skills)
      with ordinality as selected(element, ordinality)
    left join app_private.phase4_combat_skill_versions release
      on release.skill_id = selected.element ->> 'skillId'
      and release.previous_version = (selected.element ->> 'contentVersion')::integer;
  end if;

  v_change_primary :=
    v_build.primary_discipline_id is distinct from v_loadout.primary_discipline_id;
  v_change_secondary :=
    v_build.secondary_discipline_id is distinct from v_loadout.secondary_discipline_id;
  v_disc_fingerprint := left(p_request_fingerprint || ':disciplines', 160);
  v_skill_fingerprint := left(p_request_fingerprint || ':skills', 160);

  if v_change_primary or v_change_secondary then
    perform *
    from public.change_character_disciplines_v2(
      p_user_id,
      p_character_id,
      v_build.build_version,
      v_change_primary,
      v_loadout.primary_discipline_id,
      v_change_secondary,
      v_loadout.secondary_discipline_id,
      p_idempotency_key,
      v_disc_fingerprint
    );
  end if;

  select build.build_version
  into v_after_version
  from app_private.character_active_builds build
  where build.character_id = p_character_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'skillId', equipped.skill_id,
        'contentVersion', equipped.skill_content_version,
        'sourceDisciplineId', equipped.source_discipline_id
      )
      order by equipped.slot_index
    ),
    '[]'::jsonb
  )
  into v_current_skills
  from app_private.character_build_discipline_skills equipped
  where equipped.character_id = p_character_id;

  if v_current_skills is distinct from v_loadout.discipline_skills then
    perform *
    from public.save_character_discipline_skill_loadout_v1(
      p_user_id,
      p_character_id,
      v_after_version,
      v_loadout.discipline_skills,
      p_idempotency_key,
      v_skill_fingerprint
    );

    select build.build_version
    into v_after_version
    from app_private.character_active_builds build
    where build.character_id = p_character_id;
  end if;

  -- The same build row lock spans Discipline changes, Skill changes, and Support Action.
  -- Keep the current build version from any preceding mutation; never overwrite its fields.
  if v_build.support_action_id is distinct from v_loadout.support_action_id then
    perform * from public.save_character_support_action_v1(
      p_user_id, p_character_id, v_after_version, v_loadout.support_action_id,
      p_idempotency_key, left(p_request_fingerprint || ':support-action',160)
    );
    select build.build_version into v_after_version
    from app_private.character_active_builds build where build.character_id = p_character_id;
  end if;

  insert into app_private.character_saved_build_loadout_activation_idempotency (
    character_id,
    idempotency_key,
    request_fingerprint,
    build_version_after,
    activated_at
  ) values (
    p_character_id,
    p_idempotency_key,
    p_request_fingerprint,
    v_after_version,
    v_now
  );

  insert into app_private.character_saved_build_loadout_activation_audit (
    id,
    character_id,
    user_id,
    slot_index,
    build_version_before,
    build_version_after,
    target_primary_discipline_id,
    target_secondary_discipline_id,
    target_discipline_skills,
    request_fingerprint,
    activated_at
  ) values (
    gen_random_uuid(),
    p_character_id,
    p_user_id,
    p_slot_index,
    p_expected_build_version,
    v_after_version,
    v_loadout.primary_discipline_id,
    v_loadout.secondary_discipline_id,
    v_loadout.discipline_skills,
    p_request_fingerprint,
    v_now
  );

  return query select v_after_version, false, v_now;
end;
$$;

revoke all on function public.activate_character_build_loadout_v1(
  uuid,
  uuid,
  smallint,
  bigint,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.activate_character_build_loadout_v1(
  uuid,
  uuid,
  smallint,
  bigint,
  uuid,
  text
) to service_role;

commit;
