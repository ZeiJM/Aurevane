begin;

create table app_private.discipline_core_profiles (
  discipline_id text not null,
  core_profile_version integer not null,
  might integer not null,
  finesse integer not null,
  vitality integer not null,
  agility integer not null,
  intellect integer not null,
  resolve integer not null,
  focus_attributes text[] not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (discipline_id, core_profile_version),
  constraint discipline_core_profiles_id_format check (
    discipline_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint discipline_core_profiles_version_positive check (core_profile_version > 0),
  constraint discipline_core_profiles_values_positive check (
    least(might, finesse, vitality, agility, intellect, resolve) >= 1
  ),
  constraint discipline_core_profiles_total check (
    might + finesse + vitality + agility + intellect + resolve = 31
  ),
  constraint discipline_core_profiles_focus_count check (
    cardinality(focus_attributes) between 2 and 3
  ),
  constraint discipline_core_profiles_focus_values check (
    focus_attributes <@ array['might','finesse','vitality','agility','intellect','resolve']::text[]
    and cardinality(focus_attributes) = cardinality(array(select distinct unnest(focus_attributes)))
  ),
  constraint discipline_core_profiles_unique_distribution unique (
    might, finesse, vitality, agility, intellect, resolve
  )
);

comment on table app_private.discipline_core_profiles is
  'Versioned Primary-owned Core Stat bases. Every profile totals 31, has a unique six-stat distribution, and declares two or three focus attributes.';

revoke all on table app_private.discipline_core_profiles from public, anon, authenticated;
grant select on table app_private.discipline_core_profiles to service_role;

insert into app_private.discipline_core_profiles (
  discipline_id, core_profile_version, might, finesse, vitality, agility, intellect, resolve,
  focus_attributes
)
values
  ('vanguard', 1, 7, 4, 7, 4, 3, 6, array['might','vitality','resolve']),
  ('farstrider', 1, 3, 8, 4, 8, 4, 4, array['finesse','agility']),
  ('shadehand', 1, 3, 7, 3, 8, 6, 4, array['finesse','agility','intellect']),
  ('ironfist', 1, 8, 4, 5, 8, 2, 4, array['might','agility']),
  ('aetherist', 1, 2, 3, 4, 3, 10, 9, array['intellect','resolve']),
  ('lifebinder', 1, 2, 3, 6, 3, 8, 9, array['intellect','resolve','vitality']);

create table app_private.character_core_profile_state (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary_discipline_id text not null,
  core_profile_version integer not null,
  conversion_required boolean not null default false,
  converted_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (primary_discipline_id, core_profile_version)
    references app_private.discipline_core_profiles(discipline_id, core_profile_version),
  constraint character_core_profile_conversion_time check (
    conversion_required or converted_at is not null
  )
);

create index character_core_profile_state_user_idx
  on app_private.character_core_profile_state (user_id, character_id);

comment on table app_private.character_core_profile_state is
  'Server-only pinned Primary Core Stat base plus one-time legacy conversion state. Personal points are represented by effective character attributes minus this base.';

revoke all on table app_private.character_core_profile_state from public, anon, authenticated;
grant select on table app_private.character_core_profile_state to service_role;

insert into app_private.character_core_profile_state (
  character_id, user_id, primary_discipline_id, core_profile_version, conversion_required
)
select build.character_id, build.user_id, build.primary_discipline_id, 1, true
from app_private.character_active_builds build
join app_private.discipline_core_profiles profile
  on profile.discipline_id = build.primary_discipline_id
 and profile.core_profile_version = 1;

create or replace function app_private.provision_character_core_profile_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_profile app_private.discipline_core_profiles%rowtype;
begin
  select profile.* into v_profile
  from app_private.discipline_core_profiles profile
  where profile.discipline_id = new.foundation_discipline_id
  order by profile.core_profile_version desc
  limit 1;

  if not found then
    raise exception using errcode = '22023', message = 'FOUNDATION_CORE_PROFILE_UNAVAILABLE';
  end if;

  if new.might < v_profile.might
    or new.finesse < v_profile.finesse
    or new.vitality < v_profile.vitality
    or new.agility < v_profile.agility
    or new.intellect < v_profile.intellect
    or new.resolve < v_profile.resolve
    or (new.might + new.finesse + new.vitality + new.agility + new.intellect + new.resolve) <> 36 then
    raise exception using errcode = '22023', message = 'CHARACTER_CORE_PROFILE_CREATION_INVALID';
  end if;

  insert into app_private.character_core_profile_state (
    character_id, user_id, primary_discipline_id, core_profile_version,
    conversion_required, converted_at, updated_at
  ) values (
    new.id, new.user_id, v_profile.discipline_id, v_profile.core_profile_version,
    false, clock_timestamp(), clock_timestamp()
  );

  return new;
end;
$$;

revoke all on function app_private.provision_character_core_profile_v1()
  from public, anon, authenticated;

create trigger character_core_profile_provision_v1
  after insert on public.characters
  for each row execute function app_private.provision_character_core_profile_v1();

create or replace function app_private.core_allocation_is_legal_v1(
  p_profile app_private.discipline_core_profiles,
  p_level integer,
  p_might integer,
  p_finesse integer,
  p_vitality integer,
  p_agility integer,
  p_intellect integer,
  p_resolve integer,
  p_require_full_pool boolean
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog, app_private
as $$
  select
    p_level between 1 and 50
    and p_might >= p_profile.might
    and p_finesse >= p_profile.finesse
    and p_vitality >= p_profile.vitality
    and p_agility >= p_profile.agility
    and p_intellect >= p_profile.intellect
    and p_resolve >= p_profile.resolve
    and (p_might + p_finesse + p_vitality + p_agility + p_intellect + p_resolve)
      <= (36 + p_level - 1)
    and (
      not p_require_full_pool
      or (p_might + p_finesse + p_vitality + p_agility + p_intellect + p_resolve)
        = (36 + p_level - 1)
    )
    and ('might' = any(p_profile.focus_attributes) or p_might <= 30)
    and ('finesse' = any(p_profile.focus_attributes) or p_finesse <= 30)
    and ('vitality' = any(p_profile.focus_attributes) or p_vitality <= 30)
    and ('agility' = any(p_profile.focus_attributes) or p_agility <= 30)
    and ('intellect' = any(p_profile.focus_attributes) or p_intellect <= 30)
    and ('resolve' = any(p_profile.focus_attributes) or p_resolve <= 30);
$$;

revoke all on function app_private.core_allocation_is_legal_v1(
  app_private.discipline_core_profiles, integer, integer, integer, integer, integer, integer, integer,
  boolean
) from public, anon, authenticated;

alter table app_private.character_attribute_change_audit
  drop constraint character_attribute_change_mode;
alter table app_private.character_attribute_change_audit
  add constraint character_attribute_change_mode check (change_mode in ('spend', 'reset', 'convert'));

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
  personal_point_pool integer,
  spent_points integer,
  unspent_points integer,
  base_might integer,
  base_finesse integer,
  base_vitality integer,
  base_agility integer,
  base_intellect integer,
  base_resolve integer,
  conversion_required boolean,
  reset_window_started_at timestamptz,
  reset_used integer,
  reset_remaining integer,
  reset_renews_at timestamptz,
  server_now timestamptz
)
language sql
security definer
volatile
set search_path = pg_catalog, public, app_private
as $$
  select
    allocation.character_id,
    allocation.might,
    allocation.finesse,
    allocation.vitality,
    allocation.agility,
    allocation.intellect,
    allocation.resolve,
    allocation.level,
    allocation.point_pool,
    (5 + allocation.level - 1)::integer,
    allocation.spent_points,
    case
      when state.conversion_required then (5 + allocation.level - 1)::integer
      else allocation.unspent_points
    end,
    profile.might,
    profile.finesse,
    profile.vitality,
    profile.agility,
    profile.intellect,
    profile.resolve,
    state.conversion_required,
    allocation.reset_window_started_at,
    allocation.reset_used,
    allocation.reset_remaining,
    allocation.reset_renews_at,
    allocation.server_now
  from public.get_character_attribute_allocation_v1(p_user_id, p_character_id) allocation
  join app_private.character_core_profile_state state
    on state.character_id = allocation.character_id
   and state.user_id = p_user_id
  join app_private.discipline_core_profiles profile
    on profile.discipline_id = state.primary_discipline_id
   and profile.core_profile_version = state.core_profile_version;
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
  personal_point_pool integer,
  spent_points integer,
  unspent_points integer,
  base_might integer,
  base_finesse integer,
  base_vitality integer,
  base_agility integer,
  base_intellect integer,
  base_resolve integer,
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
  v_character public.characters%rowtype;
  v_state app_private.character_core_profile_state%rowtype;
  v_profile app_private.discipline_core_profiles%rowtype;
  v_prior_reset app_private.character_attribute_reset_windows%rowtype;
  v_had_prior_reset boolean := false;
  v_result record;
  v_idempotency app_private.idempotency_records%rowtype;
  v_change_id uuid;
begin
  if p_mode not in ('spend', 'reset', 'convert') then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_MODE_INVALID';
  end if;

  select character.* into v_character
  from public.characters character
  where character.id = p_character_id and character.user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_ATTRIBUTE_CHARACTER_NOT_FOUND';
  end if;

  select state.* into v_state
  from app_private.character_core_profile_state state
  where state.character_id = p_character_id and state.user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_CORE_PROFILE_STATE_UNAVAILABLE';
  end if;

  select profile.* into v_profile
  from app_private.discipline_core_profiles profile
  where profile.discipline_id = v_state.primary_discipline_id
    and profile.core_profile_version = v_state.core_profile_version;
  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_CORE_PROFILE_UNAVAILABLE';
  end if;

  if not app_private.core_allocation_is_legal_v1(
    v_profile, v_character.level, p_might, p_finesse, p_vitality, p_agility,
    p_intellect, p_resolve, p_mode in ('reset', 'convert')
  ) then
    raise exception using errcode = '22023', message = 'CHARACTER_CORE_ALLOCATION_INVALID';
  end if;

  if p_mode = 'convert' then
    select * into v_idempotency
    from app_private.idempotency_records record
    where record.actor_key = 'user:' || p_user_id::text
      and record.command_name = 'character.attributes.allocate.v1'
      and record.idempotency_key = p_idempotency_key;

    if found then
      if v_idempotency.request_fingerprint <> p_request_fingerprint then
        raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_IDEMPOTENCY_CONFLICT';
      end if;
      select * into v_result
      from public.commit_character_attribute_allocation_v1(
        p_user_id, p_character_id, 'reset', p_might, p_finesse, p_vitality, p_agility,
        p_intellect, p_resolve, p_idempotency_key, p_request_fingerprint
      );
    else
      if not v_state.conversion_required then
        raise exception using errcode = '22023', message = 'CHARACTER_CORE_CONVERSION_NOT_REQUIRED';
      end if;

      select reset.* into v_prior_reset
      from app_private.character_attribute_reset_windows reset
      where reset.character_id = p_character_id and reset.user_id = p_user_id;
      v_had_prior_reset := found;

      select * into v_result
      from public.commit_character_attribute_allocation_v1(
        p_user_id, p_character_id, 'reset', p_might, p_finesse, p_vitality, p_agility,
        p_intellect, p_resolve, p_idempotency_key, p_request_fingerprint
      );

      select * into v_idempotency
      from app_private.idempotency_records record
      where record.actor_key = 'user:' || p_user_id::text
        and record.command_name = 'character.attributes.allocate.v1'
        and record.idempotency_key = p_idempotency_key;
      v_change_id := (v_idempotency.result ->> 'change_id')::uuid;

      if v_had_prior_reset then
        insert into app_private.character_attribute_reset_windows (
          character_id, user_id, window_started_at, resets_used, updated_at
        ) values (
          v_prior_reset.character_id, v_prior_reset.user_id, v_prior_reset.window_started_at,
          v_prior_reset.resets_used, v_prior_reset.updated_at
        )
        on conflict on constraint character_attribute_reset_windows_pkey do update set
          user_id = excluded.user_id,
          window_started_at = excluded.window_started_at,
          resets_used = excluded.resets_used,
          updated_at = excluded.updated_at;
      else
        delete from app_private.character_attribute_reset_windows reset
        where reset.character_id = p_character_id and reset.user_id = p_user_id;
      end if;

      update app_private.character_attribute_change_audit audit
      set
        change_mode = 'convert',
        reset_window_started_at_after = case when v_had_prior_reset then v_prior_reset.window_started_at else null end,
        reset_used_after = case when v_had_prior_reset then v_prior_reset.resets_used else 0 end
      where audit.id = v_change_id;

      update app_private.character_core_profile_state state
      set conversion_required = false, converted_at = clock_timestamp(), updated_at = clock_timestamp()
      where state.character_id = p_character_id and state.user_id = p_user_id;
    end if;
  else
    if v_state.conversion_required then
      raise exception using errcode = '22023', message = 'CHARACTER_CORE_CONVERSION_REQUIRED';
    end if;

    select * into v_result
    from public.commit_character_attribute_allocation_v1(
      p_user_id, p_character_id, p_mode, p_might, p_finesse, p_vitality, p_agility,
      p_intellect, p_resolve, p_idempotency_key, p_request_fingerprint
    );
  end if;

  return query
  select allocation.*, v_result.replayed
  from public.get_character_attribute_allocation_v2(p_user_id, p_character_id) allocation;
end;
$$;

revoke all on function public.commit_character_attribute_allocation_v2(
  uuid, uuid, text, integer, integer, integer, integer, integer, integer, uuid, text
) from public, anon, authenticated;
grant execute on function public.commit_character_attribute_allocation_v2(
  uuid, uuid, text, integer, integer, integer, integer, integer, integer, uuid, text
) to service_role;

create or replace function public.create_character_v4(
  p_user_id uuid,
  p_slot_index integer,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_rules_version integer,
  p_name text,
  p_name_key text,
  p_presentation_id text,
  p_pronoun_preset_id text,
  p_portrait_ref text,
  p_starter_appearance_ref text,
  p_foundation_discipline_id text,
  p_might integer,
  p_finesse integer,
  p_vitality integer,
  p_agility integer,
  p_intellect integer,
  p_resolve integer
)
returns table (
  id uuid,
  user_id uuid,
  slot_index smallint,
  rules_version integer,
  name text,
  name_key text,
  presentation_id text,
  pronoun_preset_id text,
  portrait_ref text,
  starter_appearance_ref text,
  foundation_discipline_id text,
  might integer,
  finesse integer,
  vitality integer,
  agility integer,
  intellect integer,
  resolve integer,
  level integer,
  xp bigint,
  progression_cycle integer,
  created_at timestamptz,
  cycle_started_at timestamptz,
  last_active_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_profile app_private.discipline_core_profiles%rowtype;
begin
  select profile.* into v_profile
  from app_private.discipline_core_profiles profile
  where profile.discipline_id = p_foundation_discipline_id
  order by profile.core_profile_version desc
  limit 1;

  if not found or not app_private.core_allocation_is_legal_v1(
    v_profile, 1, p_might, p_finesse, p_vitality, p_agility, p_intellect, p_resolve, true
  ) then
    raise exception using errcode = '22023', message = 'CHARACTER_CORE_PROFILE_CREATION_INVALID';
  end if;

  return query
  select *
  from public.create_character_v3(
    p_user_id, p_slot_index, p_idempotency_key, p_request_fingerprint, p_rules_version,
    p_name, p_name_key, p_presentation_id, p_pronoun_preset_id, p_portrait_ref,
    p_starter_appearance_ref, p_foundation_discipline_id, p_might, p_finesse,
    p_vitality, p_agility, p_intellect, p_resolve
  );
end;
$$;

revoke all on function public.create_character_v4(
  uuid, integer, uuid, text, integer, text, text, text, text, text, text, text,
  integer, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.create_character_v4(
  uuid, integer, uuid, text, integer, text, text, text, text, text, text, text,
  integer, integer, integer, integer, integer, integer
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
  replayed boolean,
  effective_might integer,
  effective_finesse integer,
  effective_vitality integer,
  effective_agility integer,
  effective_intellect integer,
  effective_resolve integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_character public.characters%rowtype;
  v_state app_private.character_core_profile_state%rowtype;
  v_from app_private.discipline_core_profiles%rowtype;
  v_to app_private.discipline_core_profiles%rowtype;
  v_personal_might integer;
  v_personal_finesse integer;
  v_personal_vitality integer;
  v_personal_agility integer;
  v_personal_intellect integer;
  v_personal_resolve integer;
  v_changed record;
begin
  select character.* into v_character
  from public.characters character
  where character.id = p_character_id and character.user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  select state.* into v_state
  from app_private.character_core_profile_state state
  where state.character_id = p_character_id and state.user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_CORE_PROFILE_STATE_UNAVAILABLE';
  end if;

  if p_change_primary then
    if v_state.conversion_required then
      raise exception using errcode = '22023', message = 'CHARACTER_CORE_CONVERSION_REQUIRED';
    end if;

    select profile.* into v_from
    from app_private.discipline_core_profiles profile
    where profile.discipline_id = v_state.primary_discipline_id
      and profile.core_profile_version = v_state.core_profile_version;
    select profile.* into v_to
    from app_private.discipline_core_profiles profile
    where profile.discipline_id = p_primary_discipline_id
    order by profile.core_profile_version desc
    limit 1;

    if v_from.discipline_id is null or v_to.discipline_id is null then
      raise exception using errcode = '22023', message = 'PRIMARY_CORE_PROFILE_UNAVAILABLE';
    end if;

    v_personal_might := v_character.might - v_from.might;
    v_personal_finesse := v_character.finesse - v_from.finesse;
    v_personal_vitality := v_character.vitality - v_from.vitality;
    v_personal_agility := v_character.agility - v_from.agility;
    v_personal_intellect := v_character.intellect - v_from.intellect;
    v_personal_resolve := v_character.resolve - v_from.resolve;

    if least(v_personal_might, v_personal_finesse, v_personal_vitality, v_personal_agility,
      v_personal_intellect, v_personal_resolve) < 0 then
      raise exception using errcode = '22023', message = 'CHARACTER_CORE_ALLOCATION_INCONSISTENT';
    end if;

    if not app_private.core_allocation_is_legal_v1(
      v_to, v_character.level,
      v_to.might + v_personal_might,
      v_to.finesse + v_personal_finesse,
      v_to.vitality + v_personal_vitality,
      v_to.agility + v_personal_agility,
      v_to.intellect + v_personal_intellect,
      v_to.resolve + v_personal_resolve,
      false
    ) then
      raise exception using errcode = '22023', message = 'PRIMARY_CORE_ALLOCATION_REQUIRES_REDISTRIBUTION';
    end if;
  end if;

  select * into v_changed
  from public.change_character_disciplines_v2(
    p_user_id, p_character_id, p_expected_build_version, p_change_primary,
    p_primary_discipline_id, p_change_secondary, p_secondary_discipline_id,
    p_idempotency_key, p_request_fingerprint
  );

  if p_change_primary and not v_changed.replayed then
    update public.characters character
    set
      might = v_to.might + v_personal_might,
      finesse = v_to.finesse + v_personal_finesse,
      vitality = v_to.vitality + v_personal_vitality,
      agility = v_to.agility + v_personal_agility,
      intellect = v_to.intellect + v_personal_intellect,
      resolve = v_to.resolve + v_personal_resolve
    where character.id = p_character_id and character.user_id = p_user_id;

    update app_private.character_core_profile_state state
    set
      primary_discipline_id = v_to.discipline_id,
      core_profile_version = v_to.core_profile_version,
      updated_at = clock_timestamp()
    where state.character_id = p_character_id and state.user_id = p_user_id;
  end if;

  select character.* into v_character
  from public.characters character
  where character.id = p_character_id and character.user_id = p_user_id;

  return query select
    v_changed.character_id,
    v_changed.schema_version,
    v_changed.build_version,
    v_changed.primary_discipline_id,
    v_changed.primary_definition_version,
    v_changed.primary_profile_version,
    v_changed.primary_name,
    v_changed.primary_summary,
    v_changed.primary_enabled_for_primary,
    v_changed.primary_enabled_for_secondary,
    v_changed.primary_stat_offsets,
    v_changed.secondary_discipline_id,
    v_changed.secondary_definition_version,
    v_changed.secondary_name,
    v_changed.secondary_summary,
    v_changed.secondary_enabled_for_primary,
    v_changed.secondary_enabled_for_secondary,
    v_changed.primary_attunement_locked_until,
    v_changed.secondary_attunement_locked_until,
    v_changed.attunement_policy_version,
    v_changed.primary_cooldown_seconds,
    v_changed.secondary_cooldown_seconds,
    v_changed.server_now,
    v_changed.changed_at,
    v_changed.replayed,
    v_character.might,
    v_character.finesse,
    v_character.vitality,
    v_character.agility,
    v_character.intellect,
    v_character.resolve;
end;
$$;

revoke all on function public.change_character_disciplines_v3(
  uuid, uuid, bigint, boolean, text, boolean, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.change_character_disciplines_v3(
  uuid, uuid, bigint, boolean, text, boolean, text, uuid, text
) to service_role;

commit;
