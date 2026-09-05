begin;

alter table app_private.character_build_discipline_skills
  drop constraint if exists character_build_discipline_skills_slot_range;

create temporary table phase3_four_technique_keep on commit drop as
with ranked as (
  select
    equipped.character_id,
    equipped.skill_id,
    equipped.skill_content_version,
    equipped.source_discipline_id,
    equipped.equipped_at,
    equipped.slot_index,
    build.primary_discipline_id,
    build.secondary_discipline_id,
    row_number() over (
      partition by equipped.character_id, equipped.source_discipline_id
      order by equipped.slot_index, equipped.skill_id
    ) as source_rank
  from app_private.character_build_discipline_skills equipped
  join app_private.character_active_builds build
    on build.character_id = equipped.character_id
), legal as (
  select *
  from ranked
  where (
    secondary_discipline_id is null
    and source_discipline_id = primary_discipline_id
    and source_rank <= 4
  ) or (
    secondary_discipline_id is not null
    and (
      (source_discipline_id = primary_discipline_id and source_rank <= 2)
      or (source_discipline_id = secondary_discipline_id and source_rank <= 2)
    )
  )
)
select
  character_id,
  row_number() over (partition by character_id order by slot_index, skill_id)::smallint as slot_index,
  skill_id,
  skill_content_version,
  source_discipline_id,
  equipped_at
from legal;

delete from app_private.character_build_discipline_skills;

insert into app_private.character_build_discipline_skills (
  character_id,
  slot_index,
  skill_id,
  skill_content_version,
  source_discipline_id,
  equipped_at
)
select
  character_id,
  slot_index,
  skill_id,
  skill_content_version,
  source_discipline_id,
  equipped_at
from phase3_four_technique_keep
order by character_id, slot_index;

alter table app_private.character_build_discipline_skills
  add constraint character_build_discipline_skills_slot_range
  check (slot_index between 1 and 4);

update app_private.character_saved_build_loadouts saved
set
  discipline_skills = coalesce((
    select jsonb_agg(candidate.element order by candidate.ordinality)
    from (
      select
        selected.element,
        selected.ordinality,
        row_number() over (
          partition by selected.element ->> 'sourceDisciplineId'
          order by selected.ordinality
        ) as source_rank
      from jsonb_array_elements(saved.discipline_skills) with ordinality
        as selected(element, ordinality)
    ) candidate
    where (
      saved.secondary_discipline_id is null
      and candidate.element ->> 'sourceDisciplineId' = saved.primary_discipline_id
      and candidate.source_rank <= 4
    ) or (
      saved.secondary_discipline_id is not null
      and (
        (candidate.element ->> 'sourceDisciplineId' = saved.primary_discipline_id
          and candidate.source_rank <= 2)
        or (candidate.element ->> 'sourceDisciplineId' = saved.secondary_discipline_id
          and candidate.source_rank <= 2)
      )
    )
  ), '[]'::jsonb),
  updated_at = clock_timestamp();

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
  v_count integer;
  v_entry jsonb;
  v_skill_id text;
  v_content_version integer;
  v_source_discipline_id text;
  v_primary_count integer := 0;
  v_secondary_count integer := 0;
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

  v_count := jsonb_array_length(p_skills);
  if v_count > 4 then
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

    if v_source_discipline_id = v_build.primary_discipline_id then
      v_primary_count := v_primary_count + 1;
    elsif v_build.secondary_discipline_id is not null
      and v_source_discipline_id = v_build.secondary_discipline_id then
      v_secondary_count := v_secondary_count + 1;
    else
      raise exception using errcode = '22023', message = 'DISCIPLINE_SKILL_SOURCE_INACTIVE';
    end if;

    if v_build.secondary_discipline_id is not null
      and (v_primary_count > 2 or v_secondary_count > 2) then
      raise exception using errcode = '22023', message = 'DISCIPLINE_SKILL_SOURCE_CAPACITY_EXCEEDED';
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
declare
  v_kept jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'skillId', candidate.skill_id,
    'contentVersion', candidate.skill_content_version,
    'sourceDisciplineId', candidate.source_discipline_id,
    'equippedAt', candidate.equipped_at
  ) order by candidate.slot_index), '[]'::jsonb)
  into v_kept
  from (
    select ranked.*
    from (
      select
        equipped.*,
        row_number() over (
          partition by equipped.source_discipline_id
          order by equipped.slot_index, equipped.skill_id
        ) as source_rank
      from app_private.character_build_discipline_skills equipped
      where equipped.character_id = new.character_id
    ) ranked
    where (
      new.secondary_discipline_id is null
      and ranked.source_discipline_id = new.primary_discipline_id
      and ranked.source_rank <= 4
    ) or (
      new.secondary_discipline_id is not null
      and (
        (ranked.source_discipline_id = new.primary_discipline_id and ranked.source_rank <= 2)
        or (ranked.source_discipline_id = new.secondary_discipline_id and ranked.source_rank <= 2)
      )
    )
  ) candidate;

  delete from app_private.character_build_discipline_skills
  where character_id = new.character_id;

  insert into app_private.character_build_discipline_skills (
    character_id,
    slot_index,
    skill_id,
    skill_content_version,
    source_discipline_id,
    equipped_at
  )
  select
    new.character_id,
    ordinality::smallint,
    element ->> 'skillId',
    (element ->> 'contentVersion')::integer,
    element ->> 'sourceDisciplineId',
    (element ->> 'equippedAt')::timestamptz
  from jsonb_array_elements(v_kept) with ordinality as kept(element, ordinality);

  return new;
end;
$$;

revoke all on function app_private.prune_character_discipline_skill_loadout_v1()
  from public, anon, authenticated;

commit;
