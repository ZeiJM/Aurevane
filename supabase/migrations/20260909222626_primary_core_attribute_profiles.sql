begin;

alter table app_private.discipline_primary_profiles
  add column core_base_attributes jsonb,
  add column focus_attributes text[],
  add column off_focus_cap integer not null default 30;

update app_private.discipline_primary_profiles
set
  core_base_attributes = case discipline_id
    when 'vanguard' then '{"might":7,"finesse":4,"vitality":7,"agility":4,"intellect":3,"resolve":6}'::jsonb
    when 'farstrider' then '{"might":3,"finesse":8,"vitality":4,"agility":8,"intellect":4,"resolve":4}'::jsonb
    when 'shadehand' then '{"might":3,"finesse":7,"vitality":3,"agility":8,"intellect":6,"resolve":4}'::jsonb
    when 'ironfist' then '{"might":8,"finesse":4,"vitality":5,"agility":8,"intellect":2,"resolve":4}'::jsonb
    when 'aetherist' then '{"might":2,"finesse":3,"vitality":4,"agility":3,"intellect":10,"resolve":9}'::jsonb
    when 'lifebinder' then '{"might":2,"finesse":3,"vitality":6,"agility":3,"intellect":8,"resolve":9}'::jsonb
    else null
  end,
  focus_attributes = case discipline_id
    when 'vanguard' then array['might','vitality','resolve']::text[]
    when 'farstrider' then array['finesse','agility']::text[]
    when 'shadehand' then array['finesse','agility','intellect']::text[]
    when 'ironfist' then array['might','agility']::text[]
    when 'aetherist' then array['intellect','resolve']::text[]
    when 'lifebinder' then array['intellect','resolve','vitality']::text[]
    else null
  end
where profile_version = 1;

alter table app_private.discipline_primary_profiles
  alter column core_base_attributes set not null,
  alter column focus_attributes set not null,
  add constraint discipline_primary_profiles_core_base_valid check (
    jsonb_typeof(core_base_attributes) = 'object'
    and jsonb_object_length(core_base_attributes) = 6
    and core_base_attributes ?& array['might','finesse','vitality','agility','intellect','resolve']
    and jsonb_typeof(core_base_attributes -> 'might') = 'number'
    and jsonb_typeof(core_base_attributes -> 'finesse') = 'number'
    and jsonb_typeof(core_base_attributes -> 'vitality') = 'number'
    and jsonb_typeof(core_base_attributes -> 'agility') = 'number'
    and jsonb_typeof(core_base_attributes -> 'intellect') = 'number'
    and jsonb_typeof(core_base_attributes -> 'resolve') = 'number'
    and (core_base_attributes ->> 'might') ~ '^[0-9]+$'
    and (core_base_attributes ->> 'finesse') ~ '^[0-9]+$'
    and (core_base_attributes ->> 'vitality') ~ '^[0-9]+$'
    and (core_base_attributes ->> 'agility') ~ '^[0-9]+$'
    and (core_base_attributes ->> 'intellect') ~ '^[0-9]+$'
    and (core_base_attributes ->> 'resolve') ~ '^[0-9]+$'
    and least(
      (core_base_attributes ->> 'might')::integer,
      (core_base_attributes ->> 'finesse')::integer,
      (core_base_attributes ->> 'vitality')::integer,
      (core_base_attributes ->> 'agility')::integer,
      (core_base_attributes ->> 'intellect')::integer,
      (core_base_attributes ->> 'resolve')::integer
    ) >= 1
    and (
      (core_base_attributes ->> 'might')::integer +
      (core_base_attributes ->> 'finesse')::integer +
      (core_base_attributes ->> 'vitality')::integer +
      (core_base_attributes ->> 'agility')::integer +
      (core_base_attributes ->> 'intellect')::integer +
      (core_base_attributes ->> 'resolve')::integer
    ) = 31
  ),
  add constraint discipline_primary_profiles_focus_valid check (
    cardinality(focus_attributes) between 2 and 3
    and focus_attributes <@ array['might','finesse','vitality','agility','intellect','resolve']::text[]
    and focus_attributes[1] is not null
    and focus_attributes[2] is not null
    and focus_attributes[1] <> focus_attributes[2]
    and (
      cardinality(focus_attributes) = 2
      or (
        focus_attributes[3] is not null
        and focus_attributes[1] <> focus_attributes[3]
        and focus_attributes[2] <> focus_attributes[3]
      )
    )
  ),
  add constraint discipline_primary_profiles_off_focus_cap_valid check (off_focus_cap >= 1);

create or replace function app_private.prevent_duplicate_discipline_core_base_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
begin
  if exists (
    select 1
    from app_private.discipline_primary_profiles profile
    where profile.discipline_id <> new.discipline_id
      and profile.core_base_attributes = new.core_base_attributes
  ) then
    raise exception using errcode = '23505', message = 'DISCIPLINE_CORE_BASE_MUST_BE_UNIQUE';
  end if;
  return new;
end;
$$;

revoke all on function app_private.prevent_duplicate_discipline_core_base_v1()
  from public, anon, authenticated;

create trigger discipline_primary_profiles_unique_core_base_v1
  before insert or update of core_base_attributes on app_private.discipline_primary_profiles
  for each row execute function app_private.prevent_duplicate_discipline_core_base_v1();

comment on table app_private.discipline_primary_profiles is
  'Versioned Primary Discipline profiles. Each profile owns a fixed 31-point Core Stat base plus derived-stat offsets/caps; player-owned Core Stat points are stored separately and move intact across Primary changes.';
comment on column app_private.discipline_primary_profiles.core_base_attributes is
  'Fixed effective Core Stat contribution while this Primary profile is equipped. Exactly six positive integer attributes totaling 31.';
comment on column app_private.discipline_primary_profiles.focus_attributes is
  'Two or three Core Stats that define this Primary identity and are exempt from its off-focus cap.';
comment on column app_private.discipline_primary_profiles.off_focus_cap is
  'Maximum effective Core Stat value for attributes outside this Primary focus.';

create table app_private.character_attribute_personal_allocations (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary_discipline_id text not null,
  primary_profile_version integer not null,
  might integer not null default 0,
  finesse integer not null default 0,
  vitality integer not null default 0,
  agility integer not null default 0,
  intellect integer not null default 0,
  resolve integer not null default 0,
  conversion_required boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (primary_discipline_id, primary_profile_version)
    references app_private.discipline_primary_profiles(discipline_id, profile_version),
  constraint character_attribute_personal_values_nonnegative check (
    least(might, finesse, vitality, agility, intellect, resolve) >= 0
  )
);

create index character_attribute_personal_allocations_user_idx
  on app_private.character_attribute_personal_allocations (user_id, character_id);

comment on table app_private.character_attribute_personal_allocations is
  'Server-only player-owned Core Stat allocation. The fixed Primary base never lives here, so Primary changes preserve these points exactly.';
comment on column app_private.character_attribute_personal_allocations.conversion_required is
  'True for pre-profile characters until they complete the one-time free full redistribution onto the fixed Primary base.';

revoke all on table app_private.character_attribute_personal_allocations
  from public, anon, authenticated;
grant select on table app_private.character_attribute_personal_allocations to service_role;

insert into app_private.character_attribute_personal_allocations (
  character_id,
  user_id,
  primary_discipline_id,
  primary_profile_version,
  conversion_required
)
select
  character.id,
  character.user_id,
  build.primary_discipline_id,
  build.primary_profile_version,
  true
from public.characters character
join app_private.character_active_builds build
  on build.character_id = character.id;

create or replace function app_private.validate_character_core_allocation_v1(
  p_might integer,
  p_finesse integer,
  p_vitality integer,
  p_agility integer,
  p_intellect integer,
  p_resolve integer,
  p_level integer,
  p_base jsonb,
  p_focus text[],
  p_off_focus_cap integer,
  p_require_full boolean
)
returns void
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
declare
  v_personal_pool integer;
  v_personal_spent integer;
begin
  if p_level is null or p_level not between 1 and 50 then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_LEVEL_INVALID';
  end if;
  if p_base is null or p_focus is null or p_off_focus_cap is null then
    raise exception using errcode = 'P0001', message = 'CHARACTER_ATTRIBUTE_PRIMARY_PROFILE_UNAVAILABLE';
  end if;
  if p_might is null or p_finesse is null or p_vitality is null
    or p_agility is null or p_intellect is null or p_resolve is null then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_VALUE_INVALID';
  end if;

  if p_might < (p_base ->> 'might')::integer
    or p_finesse < (p_base ->> 'finesse')::integer
    or p_vitality < (p_base ->> 'vitality')::integer
    or p_agility < (p_base ->> 'agility')::integer
    or p_intellect < (p_base ->> 'intellect')::integer
    or p_resolve < (p_base ->> 'resolve')::integer then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_BELOW_PRIMARY_BASE';
  end if;

  v_personal_pool := 5 + p_level - 1;
  v_personal_spent :=
    p_might - (p_base ->> 'might')::integer +
    p_finesse - (p_base ->> 'finesse')::integer +
    p_vitality - (p_base ->> 'vitality')::integer +
    p_agility - (p_base ->> 'agility')::integer +
    p_intellect - (p_base ->> 'intellect')::integer +
    p_resolve - (p_base ->> 'resolve')::integer;

  if v_personal_spent > v_personal_pool then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_POINT_POOL_EXCEEDED';
  end if;
  if p_require_full and v_personal_spent <> v_personal_pool then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_RESET_MUST_SPEND_FULL_POOL';
  end if;

  if ('might' <> all(p_focus) and p_might > p_off_focus_cap)
    or ('finesse' <> all(p_focus) and p_finesse > p_off_focus_cap)
    or ('vitality' <> all(p_focus) and p_vitality > p_off_focus_cap)
    or ('agility' <> all(p_focus) and p_agility > p_off_focus_cap)
    or ('intellect' <> all(p_focus) and p_intellect > p_off_focus_cap)
    or ('resolve' <> all(p_focus) and p_resolve > p_off_focus_cap) then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_DISCIPLINE_CAP_EXCEEDED';
  end if;
end;
$$;

revoke all on function app_private.validate_character_core_allocation_v1(
  integer, integer, integer, integer, integer, integer, integer, jsonb, text[], integer, boolean
) from public, anon, authenticated;

create or replace function app_private.provision_character_personal_attributes_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_definition app_private.discipline_definitions%rowtype;
  v_profile app_private.discipline_primary_profiles%rowtype;
  v_might integer;
  v_finesse integer;
  v_vitality integer;
  v_agility integer;
  v_intellect integer;
  v_resolve integer;
begin
  select definition.* into v_definition
  from app_private.discipline_definitions definition
  where definition.discipline_id = new.foundation_discipline_id
    and definition.enabled_for_primary
  order by definition.definition_version desc
  limit 1;

  if not found then
    raise exception using errcode = '22023', message = 'FOUNDATION_PRIMARY_DISCIPLINE_UNAVAILABLE';
  end if;

  select profile.* into v_profile
  from app_private.discipline_primary_profiles profile
  where profile.discipline_id = v_definition.discipline_id
    and profile.profile_version = v_definition.primary_profile_version;

  if not found then
    raise exception using errcode = 'P0001', message = 'PRIMARY_PROFILE_UNAVAILABLE';
  end if;

  perform app_private.validate_character_core_allocation_v1(
    new.might, new.finesse, new.vitality, new.agility, new.intellect, new.resolve,
    new.level, v_profile.core_base_attributes, v_profile.focus_attributes,
    v_profile.off_focus_cap, true
  );

  v_might := new.might - (v_profile.core_base_attributes ->> 'might')::integer;
  v_finesse := new.finesse - (v_profile.core_base_attributes ->> 'finesse')::integer;
  v_vitality := new.vitality - (v_profile.core_base_attributes ->> 'vitality')::integer;
  v_agility := new.agility - (v_profile.core_base_attributes ->> 'agility')::integer;
  v_intellect := new.intellect - (v_profile.core_base_attributes ->> 'intellect')::integer;
  v_resolve := new.resolve - (v_profile.core_base_attributes ->> 'resolve')::integer;

  insert into app_private.character_attribute_personal_allocations (
    character_id, user_id, primary_discipline_id, primary_profile_version,
    might, finesse, vitality, agility, intellect, resolve, conversion_required
  ) values (
    new.id, new.user_id, v_definition.discipline_id, v_definition.primary_profile_version,
    v_might, v_finesse, v_vitality, v_agility, v_intellect, v_resolve, false
  );

  return new;
end;
$$;

revoke all on function app_private.provision_character_personal_attributes_v1()
  from public, anon, authenticated;

create trigger character_core_attribute_personal_provision_v1
  after insert on public.characters
  for each row execute function app_private.provision_character_personal_attributes_v1();

alter table app_private.character_attribute_change_audit
  drop constraint character_attribute_change_mode,
  add constraint character_attribute_change_mode
    check (change_mode in ('spend', 'reset', 'convert'));

create or replace function public.get_discipline_core_attribute_profiles_v1()
returns table (
  discipline_id text,
  profile_version integer,
  core_base_attributes jsonb,
  focus_attributes text[],
  off_focus_cap integer
)
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select
    profile.discipline_id,
    profile.profile_version,
    profile.core_base_attributes,
    profile.focus_attributes,
    profile.off_focus_cap
  from app_private.discipline_primary_profiles profile
  order by profile.discipline_id, profile.profile_version;
$$;

revoke all on function public.get_discipline_core_attribute_profiles_v1()
  from public, anon, authenticated;
grant execute on function public.get_discipline_core_attribute_profiles_v1()
  to service_role;

create or replace function public.get_character_attribute_allocation_v2(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  character_id uuid,
  might integer,
  finesse integer,
  vitality integer,
  agility integer,
  intellect integer,
  resolve integer,
  level integer,
  point_pool integer,
  spent_points integer,
  unspent_points integer,
  personal_point_pool integer,
  personal_spent_points integer,
  base_attributes jsonb,
  personal_attributes jsonb,
  focus_attributes text[],
  off_focus_cap integer,
  conversion_required boolean,
  reset_window_started_at timestamptz,
  reset_used integer,
  reset_remaining integer,
  reset_renews_at timestamptz,
  server_now timestamptz
)
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  with server_clock as (
    select statement_timestamp() as now_value
  ), owned as (
    select
      character.id,
      character.might,
      character.finesse,
      character.vitality,
      character.agility,
      character.intellect,
      character.resolve,
      character.level,
      personal.primary_discipline_id,
      personal.primary_profile_version,
      personal.might as personal_might,
      personal.finesse as personal_finesse,
      personal.vitality as personal_vitality,
      personal.agility as personal_agility,
      personal.intellect as personal_intellect,
      personal.resolve as personal_resolve,
      personal.conversion_required
    from public.characters character
    join app_private.character_attribute_personal_allocations personal
      on personal.character_id = character.id
     and personal.user_id = character.user_id
    where character.id = p_character_id
      and character.user_id = p_user_id
  ), profile as (
    select p.*
    from owned
    join app_private.discipline_primary_profiles p
      on p.discipline_id = owned.primary_discipline_id
     and p.profile_version = owned.primary_profile_version
  ), reset_state as (
    select
      case
        when reset.window_started_at is not null
          and reset.window_started_at + interval '30 days' > clock.now_value
        then reset.window_started_at
        else null
      end as active_started_at,
      case
        when reset.window_started_at is not null
          and reset.window_started_at + interval '30 days' > clock.now_value
        then reset.resets_used::integer
        else 0
      end as active_used,
      clock.now_value
    from server_clock clock
    left join app_private.character_attribute_reset_windows reset
      on reset.character_id = p_character_id
     and reset.user_id = p_user_id
  )
  select
    owned.id,
    owned.might,
    owned.finesse,
    owned.vitality,
    owned.agility,
    owned.intellect,
    owned.resolve,
    owned.level,
    (31 + 5 + owned.level - 1)::integer,
    (
      owned.might + owned.finesse + owned.vitality +
      owned.agility + owned.intellect + owned.resolve
    )::integer,
    greatest(
      0,
      (5 + owned.level - 1) - (
        owned.personal_might + owned.personal_finesse + owned.personal_vitality +
        owned.personal_agility + owned.personal_intellect + owned.personal_resolve
      )
    )::integer,
    (5 + owned.level - 1)::integer,
    (
      owned.personal_might + owned.personal_finesse + owned.personal_vitality +
      owned.personal_agility + owned.personal_intellect + owned.personal_resolve
    )::integer,
    profile.core_base_attributes,
    jsonb_build_object(
      'might', owned.personal_might,
      'finesse', owned.personal_finesse,
      'vitality', owned.personal_vitality,
      'agility', owned.personal_agility,
      'intellect', owned.personal_intellect,
      'resolve', owned.personal_resolve
    ),
    profile.focus_attributes,
    profile.off_focus_cap,
    owned.conversion_required,
    reset.active_started_at,
    reset.active_used,
    greatest(0, 5 - reset.active_used)::integer,
    case
      when reset.active_started_at is null then null
      else reset.active_started_at + interval '30 days'
    end,
    reset.now_value
  from owned
  join profile on true
  cross join reset_state reset;
$$;

revoke all on function public.get_character_attribute_allocation_v2(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_attribute_allocation_v2(uuid, uuid)
  to service_role;

create or replace function public.commit_character_attribute_allocation_v2(
  p_user_id uuid,
  p_character_id uuid,
  p_mode text,
  p_might integer,
  p_finesse integer,
  p_vitality integer,
  p_agility integer,
  p_intellect integer,
  p_resolve integer,
  p_idempotency_key uuid,
  p_request_fingerprint text
)
returns table (
  character_id uuid,
  might integer,
  finesse integer,
  vitality integer,
  agility integer,
  intellect integer,
  resolve integer,
  level integer,
  point_pool integer,
  spent_points integer,
  unspent_points integer,
  personal_point_pool integer,
  personal_spent_points integer,
  base_attributes jsonb,
  personal_attributes jsonb,
  focus_attributes text[],
  off_focus_cap integer,
  conversion_required boolean,
  reset_window_started_at timestamptz,
  reset_used integer,
  reset_remaining integer,
  reset_renews_at timestamptz,
  server_now timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_personal app_private.character_attribute_personal_allocations%rowtype;
  v_character public.characters%rowtype;
  v_profile app_private.discipline_primary_profiles%rowtype;
  v_personal_might integer;
  v_personal_finesse integer;
  v_personal_vitality integer;
  v_personal_agility integer;
  v_personal_intellect integer;
  v_personal_resolve integer;
  v_personal_spent integer;
  v_replayed boolean := false;
  v_command_name constant text := 'character.attributes.convert.v2';
  v_actor_key text := 'user:' || p_user_id::text;
  v_change_id uuid := gen_random_uuid();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
  v_reset_started timestamptz;
  v_reset_used integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  if p_mode not in ('spend', 'reset', 'convert') then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_MODE_INVALID';
  end if;
  if p_user_id is null or p_character_id is null or p_idempotency_key is null
    or p_request_fingerprint is null or btrim(p_request_fingerprint) = '' then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_IDENTITY_INVALID';
  end if;

  select personal.* into v_personal
  from app_private.character_attribute_personal_allocations personal
  where personal.character_id = p_character_id
    and personal.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_ATTRIBUTE_PERSONAL_ALLOCATION_UNAVAILABLE';
  end if;

  select character.* into v_character
  from public.characters character
  where character.id = p_character_id
    and character.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_ATTRIBUTE_CHARACTER_NOT_FOUND';
  end if;

  select profile.* into v_profile
  from app_private.discipline_primary_profiles profile
  where profile.discipline_id = v_personal.primary_discipline_id
    and profile.profile_version = v_personal.primary_profile_version;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_ATTRIBUTE_PRIMARY_PROFILE_UNAVAILABLE';
  end if;

  perform app_private.validate_character_core_allocation_v1(
    p_might, p_finesse, p_vitality, p_agility, p_intellect, p_resolve,
    v_character.level, v_profile.core_base_attributes, v_profile.focus_attributes,
    v_profile.off_focus_cap, p_mode in ('reset', 'convert')
  );

  v_personal_might := p_might - (v_profile.core_base_attributes ->> 'might')::integer;
  v_personal_finesse := p_finesse - (v_profile.core_base_attributes ->> 'finesse')::integer;
  v_personal_vitality := p_vitality - (v_profile.core_base_attributes ->> 'vitality')::integer;
  v_personal_agility := p_agility - (v_profile.core_base_attributes ->> 'agility')::integer;
  v_personal_intellect := p_intellect - (v_profile.core_base_attributes ->> 'intellect')::integer;
  v_personal_resolve := p_resolve - (v_profile.core_base_attributes ->> 'resolve')::integer;
  v_personal_spent :=
    v_personal_might + v_personal_finesse + v_personal_vitality +
    v_personal_agility + v_personal_intellect + v_personal_resolve;

  if p_mode = 'convert' then
    insert into app_private.idempotency_records (
      actor_key, command_name, idempotency_key, request_fingerprint, result
    ) values (
      v_actor_key, v_command_name, p_idempotency_key, p_request_fingerprint,
      jsonb_build_object('change_id', v_change_id)
    )
    on conflict (actor_key, command_name, idempotency_key) do nothing;

    get diagnostics v_rows_inserted = row_count;

    if v_rows_inserted = 0 then
      select * into v_existing
      from app_private.idempotency_records record
      where record.actor_key = v_actor_key
        and record.command_name = v_command_name
        and record.idempotency_key = p_idempotency_key;

      if not found or v_existing.request_fingerprint <> p_request_fingerprint then
        raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_IDEMPOTENCY_CONFLICT';
      end if;
      v_replayed := true;
    else
      if not v_personal.conversion_required then
        raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_CONVERSION_NOT_REQUIRED';
      end if;

      select
        case
          when reset.window_started_at + interval '30 days' > v_now then reset.window_started_at
          else null
        end,
        case
          when reset.window_started_at + interval '30 days' > v_now then reset.resets_used::integer
          else 0
        end
      into v_reset_started, v_reset_used
      from app_private.character_attribute_reset_windows reset
      where reset.character_id = p_character_id
        and reset.user_id = p_user_id;

      v_reset_used := coalesce(v_reset_used, 0);

      update public.characters character
      set
        might = p_might,
        finesse = p_finesse,
        vitality = p_vitality,
        agility = p_agility,
        intellect = p_intellect,
        resolve = p_resolve
      where character.id = p_character_id
        and character.user_id = p_user_id;

      update app_private.character_attribute_personal_allocations personal
      set
        might = v_personal_might,
        finesse = v_personal_finesse,
        vitality = v_personal_vitality,
        agility = v_personal_agility,
        intellect = v_personal_intellect,
        resolve = v_personal_resolve,
        conversion_required = false,
        updated_at = v_now
      where personal.character_id = p_character_id
        and personal.user_id = p_user_id;

      insert into app_private.character_attribute_change_audit (
        id, character_id, user_id, command_name, change_mode,
        before_attributes, after_attributes, level_at_change, point_pool,
        reset_window_started_at_after, reset_used_after, request_fingerprint, changed_at
      ) values (
        v_change_id, p_character_id, p_user_id, v_command_name, 'convert',
        jsonb_build_object(
          'might', v_character.might, 'finesse', v_character.finesse,
          'vitality', v_character.vitality, 'agility', v_character.agility,
          'intellect', v_character.intellect, 'resolve', v_character.resolve
        ),
        jsonb_build_object(
          'might', p_might, 'finesse', p_finesse,
          'vitality', p_vitality, 'agility', p_agility,
          'intellect', p_intellect, 'resolve', p_resolve
        ),
        v_character.level,
        31 + 5 + v_character.level - 1,
        v_reset_started,
        v_reset_used,
        p_request_fingerprint,
        v_now
      );
    end if;
  else
    if v_personal.conversion_required then
      raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_CONVERSION_REQUIRED';
    end if;

    select result.replayed into v_replayed
    from public.commit_character_attribute_allocation_v1(
      p_user_id, p_character_id, p_mode,
      p_might, p_finesse, p_vitality, p_agility, p_intellect, p_resolve,
      p_idempotency_key, p_request_fingerprint
    ) result;

    update app_private.character_attribute_personal_allocations personal
    set
      might = v_personal_might,
      finesse = v_personal_finesse,
      vitality = v_personal_vitality,
      agility = v_personal_agility,
      intellect = v_personal_intellect,
      resolve = v_personal_resolve,
      updated_at = clock_timestamp()
    where personal.character_id = p_character_id
      and personal.user_id = p_user_id;
  end if;

  return query
  select allocation.*, v_replayed
  from public.get_character_attribute_allocation_v2(p_user_id, p_character_id) allocation;
end;
$$;

revoke all on function public.commit_character_attribute_allocation_v2(
  uuid, uuid, text, integer, integer, integer, integer, integer, integer, uuid, text
) from public, anon, authenticated;
grant execute on function public.commit_character_attribute_allocation_v2(
  uuid, uuid, text, integer, integer, integer, integer, integer, integer, uuid, text
) to service_role;

create or replace function public.change_character_disciplines_v3(
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
  build_version bigint,
  might integer,
  finesse integer,
  vitality integer,
  agility integer,
  intellect integer,
  resolve integer,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_build app_private.character_active_builds%rowtype;
  v_character public.characters%rowtype;
  v_personal app_private.character_attribute_personal_allocations%rowtype;
  v_definition app_private.discipline_definitions%rowtype;
  v_profile app_private.discipline_primary_profiles%rowtype;
  v_might integer;
  v_finesse integer;
  v_vitality integer;
  v_agility integer;
  v_intellect integer;
  v_resolve integer;
  v_changed record;
begin
  select build.* into v_build
  from app_private.character_active_builds build
  where build.character_id = p_character_id
    and build.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_NOT_FOUND';
  end if;

  select character.* into v_character
  from public.characters character
  where character.id = p_character_id
    and character.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  select personal.* into v_personal
  from app_private.character_attribute_personal_allocations personal
  where personal.character_id = p_character_id
    and personal.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_ATTRIBUTE_PERSONAL_ALLOCATION_UNAVAILABLE';
  end if;

  if p_change_primary then
    if v_personal.conversion_required then
      raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_CONVERSION_REQUIRED';
    end if;

    select definition.* into v_definition
    from app_private.discipline_definitions definition
    where definition.discipline_id = p_primary_discipline_id
      and definition.enabled_for_primary
    order by definition.definition_version desc
    limit 1;

    if not found then
      raise exception using errcode = '22023', message = 'PRIMARY_DISCIPLINE_UNAVAILABLE';
    end if;

    select profile.* into v_profile
    from app_private.discipline_primary_profiles profile
    where profile.discipline_id = v_definition.discipline_id
      and profile.profile_version = v_definition.primary_profile_version;

    if not found then
      raise exception using errcode = 'P0001', message = 'PRIMARY_PROFILE_UNAVAILABLE';
    end if;

    v_might := (v_profile.core_base_attributes ->> 'might')::integer + v_personal.might;
    v_finesse := (v_profile.core_base_attributes ->> 'finesse')::integer + v_personal.finesse;
    v_vitality := (v_profile.core_base_attributes ->> 'vitality')::integer + v_personal.vitality;
    v_agility := (v_profile.core_base_attributes ->> 'agility')::integer + v_personal.agility;
    v_intellect := (v_profile.core_base_attributes ->> 'intellect')::integer + v_personal.intellect;
    v_resolve := (v_profile.core_base_attributes ->> 'resolve')::integer + v_personal.resolve;

    perform app_private.validate_character_core_allocation_v1(
      v_might, v_finesse, v_vitality, v_agility, v_intellect, v_resolve,
      v_character.level, v_profile.core_base_attributes, v_profile.focus_attributes,
      v_profile.off_focus_cap, false
    );
  else
    v_might := v_character.might;
    v_finesse := v_character.finesse;
    v_vitality := v_character.vitality;
    v_agility := v_character.agility;
    v_intellect := v_character.intellect;
    v_resolve := v_character.resolve;
  end if;

  select changed.* into v_changed
  from public.change_character_disciplines_v2(
    p_user_id,
    p_character_id,
    p_expected_build_version,
    p_change_primary,
    p_primary_discipline_id,
    p_change_secondary,
    p_secondary_discipline_id,
    p_idempotency_key,
    p_request_fingerprint
  ) changed;

  if p_change_primary and not v_changed.replayed then
    update public.characters character
    set
      might = v_might,
      finesse = v_finesse,
      vitality = v_vitality,
      agility = v_agility,
      intellect = v_intellect,
      resolve = v_resolve
    where character.id = p_character_id
      and character.user_id = p_user_id;

    update app_private.character_attribute_personal_allocations personal
    set
      primary_discipline_id = v_definition.discipline_id,
      primary_profile_version = v_definition.primary_profile_version,
      updated_at = clock_timestamp()
    where personal.character_id = p_character_id
      and personal.user_id = p_user_id;
  end if;

  return query
  select
    p_character_id,
    v_changed.build_version,
    character.might,
    character.finesse,
    character.vitality,
    character.agility,
    character.intellect,
    character.resolve,
    v_changed.replayed
  from public.characters character
  where character.id = p_character_id
    and character.user_id = p_user_id;
end;
$$;

revoke all on function public.change_character_disciplines_v3(
  uuid, uuid, bigint, boolean, text, boolean, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.change_character_disciplines_v3(
  uuid, uuid, bigint, boolean, text, boolean, text, uuid, text
) to service_role;

commit;
