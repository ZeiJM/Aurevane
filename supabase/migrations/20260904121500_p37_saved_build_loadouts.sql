begin;

create table app_private.character_saved_build_loadouts (
  character_id uuid not null references public.characters(id) on delete cascade,
  slot_index smallint not null,
  name text not null,
  primary_discipline_id text not null,
  secondary_discipline_id text,
  discipline_skills jsonb not null,
  source_build_version bigint not null,
  saved_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (character_id, slot_index),
  constraint character_saved_build_loadouts_slot_range check (slot_index between 1 and 8),
  constraint character_saved_build_loadouts_name_length check (char_length(name) between 1 and 40),
  constraint character_saved_build_loadouts_primary_id_format check (
    primary_discipline_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint character_saved_build_loadouts_secondary_id_format check (
    secondary_discipline_id is null
    or secondary_discipline_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint character_saved_build_loadouts_distinct_disciplines check (
    secondary_discipline_id is null or secondary_discipline_id <> primary_discipline_id
  ),
  constraint character_saved_build_loadouts_skills_array check (
    jsonb_typeof(discipline_skills) = 'array'
  ),
  constraint character_saved_build_loadouts_version_positive check (source_build_version > 0)
);

comment on table app_private.character_saved_build_loadouts is
  'Server-only P3.7 saved build intent. Resonance and Essence are deliberately not stored as independently selectable fields; activation re-resolves them from the authoritative Discipline pair.';

create table app_private.character_saved_build_loadout_save_idempotency (
  character_id uuid not null references public.characters(id) on delete cascade,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  slot_index smallint not null,
  saved_at timestamptz not null,
  primary key (character_id, idempotency_key),
  constraint character_saved_build_loadout_save_fingerprint_length check (
    char_length(request_fingerprint) between 8 and 160
  )
);

create table app_private.character_saved_build_loadout_activation_idempotency (
  character_id uuid not null references public.characters(id) on delete cascade,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  build_version_after bigint not null,
  activated_at timestamptz not null,
  primary key (character_id, idempotency_key),
  constraint character_saved_build_loadout_activation_fingerprint_length check (
    char_length(request_fingerprint) between 8 and 160
  ),
  constraint character_saved_build_loadout_activation_version_positive check (
    build_version_after > 0
  )
);

create table app_private.character_saved_build_loadout_activation_audit (
  id uuid primary key,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_index smallint not null,
  build_version_before bigint not null,
  build_version_after bigint not null,
  target_primary_discipline_id text not null,
  target_secondary_discipline_id text,
  target_discipline_skills jsonb not null,
  request_fingerprint text not null,
  activated_at timestamptz not null,
  constraint character_saved_build_loadout_activation_audit_skills_array check (
    jsonb_typeof(target_discipline_skills) = 'array'
  )
);

create index character_saved_build_loadout_activation_audit_character_idx
  on app_private.character_saved_build_loadout_activation_audit (character_id, activated_at desc);

revoke all on table app_private.character_saved_build_loadouts from public, anon, authenticated;
revoke all on table app_private.character_saved_build_loadout_save_idempotency from public, anon, authenticated;
revoke all on table app_private.character_saved_build_loadout_activation_idempotency from public, anon, authenticated;
revoke all on table app_private.character_saved_build_loadout_activation_audit from public, anon, authenticated;
grant select on table app_private.character_saved_build_loadouts to service_role;
grant select on table app_private.character_saved_build_loadout_save_idempotency to service_role;
grant select on table app_private.character_saved_build_loadout_activation_idempotency to service_role;
grant select on table app_private.character_saved_build_loadout_activation_audit to service_role;

create or replace function public.get_character_saved_build_loadouts_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  slot_index smallint,
  name text,
  primary_discipline_id text,
  secondary_discipline_id text,
  discipline_skills jsonb,
  source_build_version bigint,
  saved_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select
    loadout.slot_index,
    loadout.name,
    loadout.primary_discipline_id,
    loadout.secondary_discipline_id,
    loadout.discipline_skills,
    loadout.source_build_version,
    loadout.saved_at,
    loadout.updated_at
  from app_private.character_saved_build_loadouts loadout
  where loadout.character_id = p_character_id
    and exists (
      select 1
      from public.characters character
      where character.id = p_character_id
        and character.user_id = p_user_id
    )
  order by loadout.slot_index;
$$;

revoke all on function public.get_character_saved_build_loadouts_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_saved_build_loadouts_v1(uuid, uuid)
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
  on conflict (character_id, slot_index) do update set
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

  select * into v_build
  from app_private.character_active_builds build
  where build.user_id = p_user_id
    and build.character_id = p_character_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_NOT_FOUND';
  end if;

  select * into v_existing
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

  select * into v_loadout
  from app_private.character_saved_build_loadouts loadout
  where loadout.character_id = p_character_id
    and loadout.slot_index = p_slot_index;

  if not found then
    raise exception using errcode = 'P0001', message = 'SAVED_BUILD_LOADOUT_NOT_FOUND';
  end if;

  v_change_primary := v_build.primary_discipline_id is distinct from v_loadout.primary_discipline_id;
  v_change_secondary := v_build.secondary_discipline_id is distinct from v_loadout.secondary_discipline_id;
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

  select build.build_version into v_after_version
  from app_private.character_active_builds build
  where build.character_id = p_character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'skillId', equipped.skill_id,
    'contentVersion', equipped.skill_content_version,
    'sourceDisciplineId', equipped.source_discipline_id
  ) order by equipped.slot_index), '[]'::jsonb)
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

    select build.build_version into v_after_version
    from app_private.character_active_builds build
    where build.character_id = p_character_id;
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

revoke all on function public.activate_character_build_loadout_v1(uuid, uuid, smallint, bigint, uuid, text)
  from public, anon, authenticated;
grant execute on function public.activate_character_build_loadout_v1(uuid, uuid, smallint, bigint, uuid, text)
  to service_role;

commit;
