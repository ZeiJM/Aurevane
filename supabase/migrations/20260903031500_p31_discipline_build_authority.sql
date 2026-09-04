begin;

create table app_private.discipline_definitions (
  discipline_id text not null,
  definition_version integer not null,
  name text not null,
  summary text not null,
  enabled_for_primary boolean not null default false,
  primary_profile_version integer not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (discipline_id, definition_version),
  constraint discipline_definitions_id_format check (
    discipline_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint discipline_definitions_version_positive check (definition_version > 0),
  constraint discipline_definitions_profile_version_positive check (primary_profile_version > 0),
  constraint discipline_definitions_name_length check (char_length(name) between 1 and 80),
  constraint discipline_definitions_summary_length check (char_length(summary) between 1 and 240)
);

create table app_private.discipline_primary_profiles (
  discipline_id text not null,
  profile_version integer not null,
  stat_offsets jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (discipline_id, profile_version),
  constraint discipline_primary_profiles_id_format check (
    discipline_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint discipline_primary_profiles_version_positive check (profile_version > 0),
  constraint discipline_primary_profiles_offsets_object check (jsonb_typeof(stat_offsets) = 'object')
);

comment on table app_private.discipline_definitions is
  'Server-only versioned Discipline identity and Primary eligibility definitions. Existing committed builds pin a definition version.';
comment on table app_private.discipline_primary_profiles is
  'Server-only versioned Primary Discipline base-stat profiles. Offsets modify derived stats and never rewrite player-assigned attributes.';

revoke all on table app_private.discipline_definitions from public, anon, authenticated;
revoke all on table app_private.discipline_primary_profiles from public, anon, authenticated;
grant select on table app_private.discipline_definitions to service_role;
grant select on table app_private.discipline_primary_profiles to service_role;

insert into app_private.discipline_primary_profiles (discipline_id, profile_version, stat_offsets)
values
  ('vanguard', 1, '{"maxHp":20,"physicalPower":2,"armor":5,"ward":1,"initiative":-1}'::jsonb),
  ('farstrider', 1, '{"accuracy":300,"evasion":150,"initiative":2,"movement":1}'::jsonb),
  ('shadehand', 1, '{"evasion":300,"criticalChance":150,"initiative":3,"armor":-1}'::jsonb),
  ('ironfist', 1, '{"maxHp":12,"physicalPower":4,"armor":2,"statusResistance":100}'::jsonb),
  ('aetherist', 1, '{"maxMp":20,"mysticPower":5,"ward":3,"maxHp":-8}'::jsonb),
  ('lifebinder', 1, '{"maxHp":8,"maxMp":15,"ward":4,"statusResistance":200}'::jsonb);

insert into app_private.discipline_definitions (
  discipline_id,
  definition_version,
  name,
  summary,
  enabled_for_primary,
  primary_profile_version
)
values
  ('vanguard', 1, 'Vanguard', 'Balanced armed combat.', true, 1),
  ('farstrider', 1, 'Farstrider', 'Ranged combat and battlefield awareness.', true, 1),
  ('shadehand', 1, 'Shadehand', 'Mobility, trickery, and opportunism.', true, 1),
  ('ironfist', 1, 'Ironfist', 'Unarmed martial combat.', true, 1),
  ('aetherist', 1, 'Aetherist', 'Foundation offensive magic.', true, 1),
  ('lifebinder', 1, 'Lifebinder', 'Foundation healing and support magic.', true, 1);

create table app_private.character_active_builds (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null default 1,
  build_version bigint not null default 1,
  primary_discipline_id text not null,
  primary_definition_version integer not null,
  primary_profile_version integer not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint character_active_builds_schema_version_positive check (schema_version > 0),
  constraint character_active_builds_build_version_positive check (build_version > 0),
  foreign key (primary_discipline_id, primary_definition_version)
    references app_private.discipline_definitions(discipline_id, definition_version),
  foreign key (primary_discipline_id, primary_profile_version)
    references app_private.discipline_primary_profiles(discipline_id, profile_version)
);

create index character_active_builds_user_idx
  on app_private.character_active_builds (user_id, character_id);

comment on table app_private.character_active_builds is
  'Authoritative committed character build boundary. P3.1 owns Primary only; player-assigned attributes remain on public.characters and are never copied into this table.';

revoke all on table app_private.character_active_builds from public, anon, authenticated;
grant select on table app_private.character_active_builds to service_role;

insert into app_private.character_active_builds (
  character_id,
  user_id,
  primary_discipline_id,
  primary_definition_version,
  primary_profile_version
)
select
  character.id,
  character.user_id,
  character.foundation_discipline_id,
  1,
  1
from public.characters character;

create table app_private.character_build_change_audit (
  id uuid primary key,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  command_name text not null,
  build_version_before bigint not null,
  build_version_after bigint not null,
  from_primary_discipline_id text not null,
  from_primary_definition_version integer not null,
  from_primary_profile_version integer not null,
  to_primary_discipline_id text not null,
  to_primary_definition_version integer not null,
  to_primary_profile_version integer not null,
  request_fingerprint text not null,
  changed_at timestamptz not null default clock_timestamp(),
  constraint character_build_change_audit_version_advance check (
    build_version_after = build_version_before + 1
  )
);

create index character_build_change_audit_character_changed_idx
  on app_private.character_build_change_audit (character_id, changed_at desc);

comment on table app_private.character_build_change_audit is
  'Append-only provenance for authoritative committed build changes. Attribute values are intentionally absent because Primary changes cannot mutate them.';

revoke all on table app_private.character_build_change_audit from public, anon, authenticated;
grant select on table app_private.character_build_change_audit to service_role;

create or replace function public.get_primary_discipline_catalog_v1()
returns table (
  discipline_id text,
  definition_version integer,
  name text,
  summary text,
  enabled_for_primary boolean,
  profile_version integer,
  stat_offsets jsonb
)
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select distinct on (definition.discipline_id)
    definition.discipline_id,
    definition.definition_version,
    definition.name,
    definition.summary,
    definition.enabled_for_primary,
    profile.profile_version,
    profile.stat_offsets
  from app_private.discipline_definitions definition
  join app_private.discipline_primary_profiles profile
    on profile.discipline_id = definition.discipline_id
   and profile.profile_version = definition.primary_profile_version
  where definition.enabled_for_primary
  order by definition.discipline_id, definition.definition_version desc;
$$;

revoke all on function public.get_primary_discipline_catalog_v1() from public, anon, authenticated;
grant execute on function public.get_primary_discipline_catalog_v1() to service_role;

create or replace function public.get_character_active_build_v1(
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
  primary_stat_offsets jsonb,
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
    definition.name,
    definition.summary,
    definition.enabled_for_primary,
    profile.stat_offsets,
    build.updated_at
  from app_private.character_active_builds build
  join app_private.discipline_definitions definition
    on definition.discipline_id = build.primary_discipline_id
   and definition.definition_version = build.primary_definition_version
  join app_private.discipline_primary_profiles profile
    on profile.discipline_id = build.primary_discipline_id
   and profile.profile_version = build.primary_profile_version
  where build.user_id = p_user_id
    and build.character_id = p_character_id;
$$;

revoke all on function public.get_character_active_build_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_character_active_build_v1(uuid, uuid) to service_role;

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
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_command_name constant text := 'character.primary.change.v1';
  v_actor_key text := 'user:' || p_user_id::text;
  v_change_id uuid := gen_random_uuid();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
  v_build app_private.character_active_builds%rowtype;
  v_definition app_private.discipline_definitions%rowtype;
  v_profile app_private.discipline_primary_profiles%rowtype;
  v_changed_at timestamptz := clock_timestamp();
begin
  if p_expected_build_version is null or p_expected_build_version < 1 then
    raise exception using errcode = '22023', message = 'CHARACTER_BUILD_EXPECTED_VERSION_INVALID';
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
      audit.build_version_after,
      audit.to_primary_discipline_id,
      audit.to_primary_definition_version,
      audit.to_primary_profile_version,
      definition.name,
      definition.summary,
      profile.stat_offsets,
      audit.changed_at,
      true
    from app_private.character_build_change_audit audit
    join app_private.discipline_definitions definition
      on definition.discipline_id = audit.to_primary_discipline_id
     and definition.definition_version = audit.to_primary_definition_version
    join app_private.discipline_primary_profiles profile
      on profile.discipline_id = audit.to_primary_discipline_id
     and profile.profile_version = audit.to_primary_profile_version
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

  select * into v_definition
  from app_private.discipline_definitions definition
  where definition.discipline_id = p_primary_discipline_id
    and definition.enabled_for_primary
  order by definition.definition_version desc
  limit 1;

  if not found then
    raise exception using errcode = '22023', message = 'PRIMARY_DISCIPLINE_UNAVAILABLE';
  end if;

  select * into v_profile
  from app_private.discipline_primary_profiles profile
  where profile.discipline_id = v_definition.discipline_id
    and profile.profile_version = v_definition.primary_profile_version;

  if not found then
    raise exception using errcode = 'P0001', message = 'PRIMARY_PROFILE_UNAVAILABLE';
  end if;

  if v_build.primary_discipline_id = v_definition.discipline_id
    and v_build.primary_definition_version = v_definition.definition_version
    and v_build.primary_profile_version = v_profile.profile_version then
    raise exception using errcode = '22023', message = 'PRIMARY_DISCIPLINE_ALREADY_ACTIVE';
  end if;

  update app_private.character_active_builds build
  set
    build_version = v_build.build_version + 1,
    primary_discipline_id = v_definition.discipline_id,
    primary_definition_version = v_definition.definition_version,
    primary_profile_version = v_profile.profile_version,
    updated_at = v_changed_at
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
    changed_at
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
    v_definition.discipline_id,
    v_definition.definition_version,
    v_profile.profile_version,
    p_request_fingerprint,
    v_changed_at
  );

  return query
  select
    v_build.character_id,
    v_build.build_version + 1,
    v_definition.discipline_id,
    v_definition.definition_version,
    v_profile.profile_version,
    v_definition.name,
    v_definition.summary,
    v_profile.stat_offsets,
    v_changed_at,
    false;
end;
$$;

revoke all on function public.change_character_primary_discipline_v1(
  uuid, uuid, bigint, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.change_character_primary_discipline_v1(
  uuid, uuid, bigint, text, uuid, text
) to service_role;

commit;
