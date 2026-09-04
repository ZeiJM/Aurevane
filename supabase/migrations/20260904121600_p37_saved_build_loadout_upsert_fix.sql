begin;

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
    v_build.build_version,
    v_now,
    v_now
  )
  on conflict on constraint character_saved_build_loadouts_pkey do update set
    name = excluded.name,
    primary_discipline_id = excluded.primary_discipline_id,
    secondary_discipline_id = excluded.secondary_discipline_id,
    discipline_skills = excluded.discipline_skills,
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

commit;
