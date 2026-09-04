begin;

create table app_private.character_skill_unlocks (
  character_id uuid not null references public.characters(id) on delete cascade,
  skill_id text not null,
  skill_content_version integer not null,
  source_discipline_id text not null,
  learned_at timestamptz not null default clock_timestamp(),
  source_kind text not null,
  source_id text not null,
  primary key (character_id, skill_id),
  constraint character_skill_unlocks_skill_id_format check (
    skill_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint character_skill_unlocks_source_id_format check (
    source_discipline_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint character_skill_unlocks_content_version_positive check (skill_content_version > 0),
  constraint character_skill_unlocks_source_kind check (
    source_kind in ('system', 'gameplay', 'support', 'owner', 'migration')
  ),
  constraint character_skill_unlocks_source_provenance_length check (
    char_length(source_id) between 1 and 160
  )
);

comment on table app_private.character_skill_unlocks is
  'Server-only durable learned-Skill facts. The trusted game server validates each fact against the versioned mature Skill catalog before recording it.';

revoke all on table app_private.character_skill_unlocks from public, anon, authenticated;
grant select on table app_private.character_skill_unlocks to service_role;

create table app_private.character_build_discipline_skills (
  character_id uuid not null references app_private.character_active_builds(character_id) on delete cascade,
  slot_index smallint not null,
  skill_id text not null,
  skill_content_version integer not null,
  source_discipline_id text not null,
  equipped_at timestamptz not null default clock_timestamp(),
  primary key (character_id, slot_index),
  unique (character_id, skill_id),
  constraint character_build_discipline_skills_slot_range check (slot_index between 1 and 8),
  constraint character_build_discipline_skills_skill_id_format check (
    skill_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint character_build_discipline_skills_source_id_format check (
    source_discipline_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint character_build_discipline_skills_content_version_positive check (
    skill_content_version > 0
  )
);

comment on table app_private.character_build_discipline_skills is
  'Ordered committed Discipline-Skill loadout. Capacity and source legality are enforced by the authoritative P3.4 save command.';

revoke all on table app_private.character_build_discipline_skills from public, anon, authenticated;
grant select on table app_private.character_build_discipline_skills to service_role;

create table app_private.character_skill_loadout_idempotency (
  character_id uuid not null references public.characters(id) on delete cascade,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  build_version_after bigint not null,
  saved_at timestamptz not null default clock_timestamp(),
  primary key (character_id, idempotency_key),
  constraint character_skill_loadout_idempotency_version_positive check (build_version_after > 0),
  constraint character_skill_loadout_idempotency_fingerprint_length check (
    char_length(request_fingerprint) between 8 and 160
  )
);

create table app_private.character_skill_loadout_change_audit (
  id uuid primary key,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  build_version_before bigint not null,
  build_version_after bigint not null,
  primary_discipline_id text not null,
  secondary_discipline_id text,
  before_skills jsonb not null,
  after_skills jsonb not null,
  request_fingerprint text not null,
  changed_at timestamptz not null default clock_timestamp(),
  constraint character_skill_loadout_change_audit_version_advance check (
    build_version_after = build_version_before + 1
  ),
  constraint character_skill_loadout_change_audit_before_array check (
    jsonb_typeof(before_skills) = 'array'
  ),
  constraint character_skill_loadout_change_audit_after_array check (
    jsonb_typeof(after_skills) = 'array'
  )
);

create index character_skill_loadout_change_audit_character_changed_idx
  on app_private.character_skill_loadout_change_audit (character_id, changed_at desc);

revoke all on table app_private.character_skill_loadout_idempotency from public, anon, authenticated;
revoke all on table app_private.character_skill_loadout_change_audit from public, anon, authenticated;
grant select on table app_private.character_skill_loadout_idempotency to service_role;
grant select on table app_private.character_skill_loadout_change_audit to service_role;

alter table app_private.character_active_builds
  alter column schema_version set default 3;

update app_private.character_active_builds
set schema_version = 3
where schema_version < 3;

create or replace function public.record_character_skill_unlock_v1(
  p_character_id uuid,
  p_skill_id text,
  p_skill_content_version integer,
  p_source_discipline_id text,
  p_source_kind text,
  p_source_id text
)
returns table (
  character_id uuid,
  skill_id text,
  skill_content_version integer,
  source_discipline_id text,
  learned_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_existing app_private.character_skill_unlocks%rowtype;
  v_rows_inserted integer;
begin
  if p_skill_id is null
    or p_skill_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    or p_skill_content_version is null
    or p_skill_content_version < 1
    or p_source_discipline_id is null
    or p_source_discipline_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'SKILL_UNLOCK_REFERENCE_INVALID';
  end if;

  if p_source_kind is null
    or p_source_kind not in ('system', 'gameplay', 'support', 'owner', 'migration')
    or p_source_id is null
    or char_length(p_source_id) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'SKILL_UNLOCK_PROVENANCE_INVALID';
  end if;

  if not exists (
    select 1 from public.characters character where character.id = p_character_id
  ) then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from app_private.discipline_definitions definition
    where definition.discipline_id = p_source_discipline_id
  ) then
    raise exception using errcode = '22023', message = 'SKILL_SOURCE_DISCIPLINE_UNKNOWN';
  end if;

  select * into v_existing
  from app_private.character_skill_unlocks unlock
  where unlock.character_id = p_character_id
    and unlock.skill_id = p_skill_id;

  if found then
    if v_existing.skill_content_version <> p_skill_content_version
      or v_existing.source_discipline_id <> p_source_discipline_id then
      raise exception using errcode = 'P0001', message = 'SKILL_UNLOCK_CONFLICT';
    end if;

    return query
    select
      v_existing.character_id,
      v_existing.skill_id,
      v_existing.skill_content_version,
      v_existing.source_discipline_id,
      v_existing.learned_at,
      true;
    return;
  end if;

  insert into app_private.character_skill_unlocks (
    character_id,
    skill_id,
    skill_content_version,
    source_discipline_id,
    source_kind,
    source_id
  ) values (
    p_character_id,
    p_skill_id,
    p_skill_content_version,
    p_source_discipline_id,
    p_source_kind,
    p_source_id
  );
  get diagnostics v_rows_inserted = row_count;

  return query
  select
    unlock.character_id,
    unlock.skill_id,
    unlock.skill_content_version,
    unlock.source_discipline_id,
    unlock.learned_at,
    v_rows_inserted = 0
  from app_private.character_skill_unlocks unlock
  where unlock.character_id = p_character_id
    and unlock.skill_id = p_skill_id;
end;
$$;

revoke all on function public.record_character_skill_unlock_v1(uuid, text, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_character_skill_unlock_v1(uuid, text, integer, text, text, text)
  to service_role;

create or replace function public.get_character_learned_skills_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  skill_id text,
  skill_content_version integer,
  source_discipline_id text,
  learned_at timestamptz
)
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select
    unlock.skill_id,
    unlock.skill_content_version,
    unlock.source_discipline_id,
    unlock.learned_at
  from app_private.character_skill_unlocks unlock
  join app_private.character_active_builds build
    on build.character_id = unlock.character_id
  where build.user_id = p_user_id
    and build.character_id = p_character_id
  order by unlock.learned_at, unlock.skill_id;
$$;

revoke all on function public.get_character_learned_skills_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_learned_skills_v1(uuid, uuid)
  to service_role;

create or replace function public.get_character_discipline_skill_loadout_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  slot_index smallint,
  skill_id text,
  skill_content_version integer,
  source_discipline_id text,
  equipped_at timestamptz
)
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select
    equipped.slot_index,
    equipped.skill_id,
    equipped.skill_content_version,
    equipped.source_discipline_id,
    equipped.equipped_at
  from app_private.character_build_discipline_skills equipped
  join app_private.character_active_builds build
    on build.character_id = equipped.character_id
  where build.user_id = p_user_id
    and build.character_id = p_character_id
  order by equipped.slot_index;
$$;

revoke all on function public.get_character_discipline_skill_loadout_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_discipline_skill_loadout_v1(uuid, uuid)
  to service_role;

create or replace function public.get_character_committed_build_snapshot_v1(
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
      'resonance', null,
      'essence', null,
      'equipmentSkills', '[]'::jsonb,
      'supernatural', null,
      'prestige', null
    )
  )
  from app_private.character_active_builds build
  where build.user_id = p_user_id
    and build.character_id = p_character_id;
$$;

revoke all on function public.get_character_committed_build_snapshot_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_committed_build_snapshot_v1(uuid, uuid)
  to service_role;

create or replace function public.save_character_discipline_skill_loadout_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_expected_build_version bigint,
  p_skills jsonb,
  p_idempotency_key uuid,
  p_request_fingerprint text
)
returns table (
  build_version bigint,
  replayed boolean,
  saved_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_build app_private.character_active_builds%rowtype;
  v_existing app_private.character_skill_loadout_idempotency%rowtype;
  v_capacity integer;
  v_count integer;
  v_entry jsonb;
  v_skill_id text;
  v_content_version integer;
  v_source_discipline_id text;
  v_seen text[] := array[]::text[];
  v_before jsonb;
  v_saved_at timestamptz := clock_timestamp();
begin
  if p_expected_build_version is null or p_expected_build_version < 1 then
    raise exception using errcode = '22023', message = 'CHARACTER_BUILD_VERSION_INVALID';
  end if;
  if p_skills is null or jsonb_typeof(p_skills) <> 'array' then
    raise exception using errcode = '22023', message = 'SKILL_LOADOUT_INVALID';
  end if;
  if p_request_fingerprint is null or char_length(p_request_fingerprint) not between 8 and 160 then
    raise exception using errcode = '22023', message = 'SKILL_LOADOUT_FINGERPRINT_INVALID';
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
  from app_private.character_skill_loadout_idempotency idempotency
  where idempotency.character_id = p_character_id
    and idempotency.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = 'P0001', message = 'CHARACTER_SKILL_LOADOUT_IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_existing.build_version_after, true, v_existing.saved_at;
    return;
  end if;

  if v_build.build_version <> p_expected_build_version then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_VERSION_CONFLICT';
  end if;

  v_capacity := case when v_build.secondary_discipline_id is null then 8 else 6 end;
  v_count := jsonb_array_length(p_skills);
  if v_count > v_capacity then
    raise exception using errcode = '22023', message = 'DISCIPLINE_SKILL_CAPACITY_EXCEEDED';
  end if;

  for v_entry in select value from jsonb_array_elements(p_skills)
  loop
    if jsonb_typeof(v_entry) <> 'object'
      or jsonb_typeof(v_entry -> 'skillId') <> 'string'
      or jsonb_typeof(v_entry -> 'contentVersion') <> 'number'
      or jsonb_typeof(v_entry -> 'sourceDisciplineId') <> 'string' then
      raise exception using errcode = '22023', message = 'SKILL_LOADOUT_REFERENCE_INVALID';
    end if;

    v_skill_id := v_entry ->> 'skillId';
    v_content_version := (v_entry ->> 'contentVersion')::integer;
    v_source_discipline_id := v_entry ->> 'sourceDisciplineId';

    if v_skill_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
      or v_content_version < 1
      or v_source_discipline_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' then
      raise exception using errcode = '22023', message = 'SKILL_LOADOUT_REFERENCE_INVALID';
    end if;

    if v_skill_id = any(v_seen) then
      raise exception using errcode = '22023', message = 'DUPLICATE_DISCIPLINE_SKILL';
    end if;
    v_seen := array_append(v_seen, v_skill_id);

    if v_source_discipline_id <> v_build.primary_discipline_id
      and (v_build.secondary_discipline_id is null
        or v_source_discipline_id <> v_build.secondary_discipline_id) then
      raise exception using errcode = '22023', message = 'DISCIPLINE_SKILL_SOURCE_INACTIVE';
    end if;

    if not exists (
      select 1
      from app_private.character_skill_unlocks unlock
      where unlock.character_id = p_character_id
        and unlock.skill_id = v_skill_id
        and unlock.skill_content_version = v_content_version
        and unlock.source_discipline_id = v_source_discipline_id
    ) then
      raise exception using errcode = '22023', message = 'DISCIPLINE_SKILL_NOT_LEARNED';
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'slotIndex', equipped.slot_index,
    'skillId', equipped.skill_id,
    'contentVersion', equipped.skill_content_version,
    'sourceDisciplineId', equipped.source_discipline_id
  ) order by equipped.slot_index), '[]'::jsonb)
  into v_before
  from app_private.character_build_discipline_skills equipped
  where equipped.character_id = p_character_id;

  delete from app_private.character_build_discipline_skills
  where character_id = p_character_id;

  insert into app_private.character_build_discipline_skills (
    character_id,
    slot_index,
    skill_id,
    skill_content_version,
    source_discipline_id,
    equipped_at
  )
  select
    p_character_id,
    ordinality::smallint,
    element ->> 'skillId',
    (element ->> 'contentVersion')::integer,
    element ->> 'sourceDisciplineId',
    v_saved_at
  from jsonb_array_elements(p_skills) with ordinality as selected(element, ordinality);

  update app_private.character_active_builds build
  set
    schema_version = greatest(build.schema_version, 3),
    build_version = build.build_version + 1,
    updated_at = v_saved_at
  where build.character_id = p_character_id
  returning * into v_build;

  insert into app_private.character_skill_loadout_change_audit (
    id,
    character_id,
    user_id,
    build_version_before,
    build_version_after,
    primary_discipline_id,
    secondary_discipline_id,
    before_skills,
    after_skills,
    request_fingerprint,
    changed_at
  ) values (
    gen_random_uuid(),
    p_character_id,
    p_user_id,
    p_expected_build_version,
    v_build.build_version,
    v_build.primary_discipline_id,
    v_build.secondary_discipline_id,
    v_before,
    p_skills,
    p_request_fingerprint,
    v_saved_at
  );

  insert into app_private.character_skill_loadout_idempotency (
    character_id,
    idempotency_key,
    request_fingerprint,
    build_version_after,
    saved_at
  ) values (
    p_character_id,
    p_idempotency_key,
    p_request_fingerprint,
    v_build.build_version,
    v_saved_at
  );

  return query select v_build.build_version, false, v_saved_at;
end;
$$;

revoke all on function public.save_character_discipline_skill_loadout_v1(uuid, uuid, bigint, jsonb, uuid, text)
  from public, anon, authenticated;
grant execute on function public.save_character_discipline_skill_loadout_v1(uuid, uuid, bigint, jsonb, uuid, text)
  to service_role;

create or replace function app_private.prune_character_discipline_skill_loadout_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  delete from app_private.character_build_discipline_skills equipped
  where equipped.character_id = new.character_id
    and equipped.source_discipline_id <> new.primary_discipline_id
    and (new.secondary_discipline_id is null
      or equipped.source_discipline_id <> new.secondary_discipline_id);

  if new.secondary_discipline_id is not null then
    delete from app_private.character_build_discipline_skills equipped
    where equipped.character_id = new.character_id
      and equipped.slot_index in (
        select overflow.slot_index
        from app_private.character_build_discipline_skills overflow
        where overflow.character_id = new.character_id
        order by overflow.slot_index
        offset 6
      );
  end if;

  return new;
end;
$$;

revoke all on function app_private.prune_character_discipline_skill_loadout_v1()
  from public, anon, authenticated;

create trigger character_active_builds_prune_discipline_skills
  after update of primary_discipline_id, secondary_discipline_id
  on app_private.character_active_builds
  for each row
  when (
    old.primary_discipline_id is distinct from new.primary_discipline_id
    or old.secondary_discipline_id is distinct from new.secondary_discipline_id
  )
  execute function app_private.prune_character_discipline_skill_loadout_v1();

commit;
