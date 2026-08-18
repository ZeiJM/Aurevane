begin;

alter table public.characters
  add column vitality integer,
  add column agility integer;

-- Existing four-attribute characters keep their original allocations and receive one point in each
-- new axis so their total starting bonus investment matches the new six-point creation budget.
update public.characters
set vitality = 6,
    agility = 6
where vitality is null or agility is null;

alter table public.characters
  alter column vitality set default 5,
  alter column vitality set not null,
  alter column agility set default 5,
  alter column agility set not null;

alter table public.characters
  add constraint characters_vitality_positive check (vitality > 0),
  add constraint characters_agility_positive check (agility > 0);

create table app_private.character_reselect_cooldowns (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  available_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);

create index character_reselect_cooldowns_user_available_idx
  on app_private.character_reselect_cooldowns (user_id, available_at);

comment on table app_private.character_reselect_cooldowns is
  'Server-authoritative one-hour cooldown before an account may return to a character it swapped away from.';

revoke all on table app_private.character_reselect_cooldowns from public, anon, authenticated;
grant select on table app_private.character_reselect_cooldowns to service_role;

create or replace function public.get_character_slots_v2(p_user_id uuid)
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
  deletion_requested_at timestamptz,
  deletion_execute_after timestamptz,
  reselect_available_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);

  delete from app_private.character_reselect_cooldowns cooldown
  where cooldown.user_id = p_user_id
    and cooldown.available_at <= clock_timestamp();

  return query
  select
    character.id,
    character.user_id,
    character.slot_index,
    character.rules_version,
    character.name,
    character.name_key,
    character.presentation_id,
    character.pronoun_preset_id,
    character.portrait_ref,
    character.starter_appearance_ref,
    character.foundation_discipline_id,
    character.might,
    character.finesse,
    character.vitality,
    character.agility,
    character.intellect,
    character.resolve,
    character.level,
    character.xp,
    character.progression_cycle,
    character.created_at,
    character.cycle_started_at,
    character.last_active_at,
    deletion.requested_at,
    deletion.delete_after,
    cooldown.available_at
  from public.characters character
  left join app_private.character_deletion_requests deletion
    on deletion.character_id = character.id
  left join app_private.character_reselect_cooldowns cooldown
    on cooldown.character_id = character.id
   and cooldown.user_id = p_user_id
   and cooldown.available_at > clock_timestamp()
  where character.user_id = p_user_id
  order by character.slot_index;
end;
$$;

revoke all on function public.get_character_slots_v2(uuid) from public, anon, authenticated;
grant execute on function public.get_character_slots_v2(uuid) to service_role;

create or replace function public.create_character_v3(
  p_user_id uuid,
  p_slot_index smallint,
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
  v_command_name constant text := 'character.create.v3';
  v_character_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
  v_constraint_name text;
begin
  if p_slot_index is null or p_slot_index < 0 or p_slot_index > 2 then
    raise exception using errcode = '22023', message = 'CHARACTER_SLOT_INVALID';
  end if;

  if least(p_might, p_finesse, p_vitality, p_agility, p_intellect, p_resolve) < 1 then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_INVALID';
  end if;

  perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);

  if not exists (
    select 1 from public.player_profiles profile where profile.user_id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'PLAYER_PROFILE_UNAVAILABLE';
  end if;

  insert into app_private.idempotency_records (
    actor_key,
    command_name,
    idempotency_key,
    request_fingerprint,
    result
  ) values (
    'user:' || p_user_id::text,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object('character_id', v_character_id)
  )
  on conflict (actor_key, command_name, idempotency_key) do nothing;

  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select * into v_existing
    from app_private.idempotency_records
    where actor_key = 'user:' || p_user_id::text
      and command_name = v_command_name
      and idempotency_key = p_idempotency_key;

    if not found then
      raise exception using errcode = '40001', message = 'CHARACTER_IDEMPOTENCY_UNAVAILABLE';
    end if;
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '22023', message = 'CHARACTER_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      character.id, character.user_id, character.slot_index, character.rules_version,
      character.name, character.name_key, character.presentation_id,
      character.pronoun_preset_id, character.portrait_ref, character.starter_appearance_ref,
      character.foundation_discipline_id, character.might, character.finesse,
      character.vitality, character.agility, character.intellect, character.resolve,
      character.level, character.xp, character.progression_cycle, character.created_at,
      character.cycle_started_at, character.last_active_at, true
    from public.characters character
    where character.id = (v_existing.result ->> 'character_id')::uuid
      and character.user_id = p_user_id;

    if not found then
      raise exception using errcode = '40001', message = 'CHARACTER_IDEMPOTENT_RESULT_UNAVAILABLE';
    end if;
    return;
  end if;

  insert into public.characters (
    id, user_id, slot_index, rules_version, name, name_key,
    presentation_id, pronoun_preset_id, portrait_ref, starter_appearance_ref,
    foundation_discipline_id, might, finesse, vitality, agility, intellect, resolve,
    level, xp, progression_cycle, created_at, cycle_started_at, last_active_at
  ) values (
    v_character_id, p_user_id, p_slot_index, p_rules_version, p_name, p_name_key,
    p_presentation_id, p_pronoun_preset_id, p_portrait_ref, p_starter_appearance_ref,
    p_foundation_discipline_id, p_might, p_finesse, p_vitality, p_agility, p_intellect, p_resolve,
    1, 0, 1, v_now, v_now, v_now
  );

  return query
  select
    character.id, character.user_id, character.slot_index, character.rules_version,
    character.name, character.name_key, character.presentation_id,
    character.pronoun_preset_id, character.portrait_ref, character.starter_appearance_ref,
    character.foundation_discipline_id, character.might, character.finesse,
    character.vitality, character.agility, character.intellect, character.resolve,
    character.level, character.xp, character.progression_cycle, character.created_at,
    character.cycle_started_at, character.last_active_at, false
  from public.characters character
  where character.id = v_character_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;
    if v_constraint_name = 'characters_name_key_unique' then
      raise exception using errcode = 'P0001', message = 'CHARACTER_NAME_UNAVAILABLE';
    end if;
    if v_constraint_name = 'characters_user_slot_unique' then
      raise exception using errcode = 'P0001', message = 'CHARACTER_SLOT_OCCUPIED';
    end if;
    raise;
end;
$$;

revoke all on function public.create_character_v3(
  uuid, smallint, uuid, text, integer, text, text, text, text, text, text, text,
  integer, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.create_character_v3(
  uuid, smallint, uuid, text, integer, text, text, text, text, text, text, text,
  integer, integer, integer, integer, integer, integer
) to service_role;

create or replace function public.switch_character_v1(
  p_user_id uuid,
  p_from_character_id uuid,
  p_to_character_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_locked_until timestamptz;
begin
  perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);

  delete from app_private.character_reselect_cooldowns cooldown
  where cooldown.user_id = p_user_id
    and cooldown.available_at <= v_now;

  if not exists (
    select 1
    from public.characters character
    left join app_private.character_deletion_requests deletion
      on deletion.character_id = character.id
    where character.id = p_to_character_id
      and character.user_id = p_user_id
      and deletion.character_id is null
  ) then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_PLAYABLE';
  end if;

  select cooldown.available_at into v_locked_until
  from app_private.character_reselect_cooldowns cooldown
  where cooldown.character_id = p_to_character_id
    and cooldown.user_id = p_user_id
    and cooldown.available_at > v_now;

  if v_locked_until is not null then
    raise exception using
      errcode = 'P0001',
      message = 'CHARACTER_RESELECT_COOLDOWN',
      detail = v_locked_until::text;
  end if;

  if p_from_character_id is not null and p_from_character_id <> p_to_character_id then
    if exists (
      select 1 from public.characters character
      where character.id = p_from_character_id
        and character.user_id = p_user_id
    ) then
      insert into app_private.character_reselect_cooldowns (
        character_id, user_id, available_at, created_at
      ) values (
        p_from_character_id, p_user_id, v_now + interval '1 hour', v_now
      )
      on conflict (character_id) do update
        set user_id = excluded.user_id,
            available_at = excluded.available_at,
            created_at = excluded.created_at;
    end if;
  end if;

  return null;
end;
$$;

revoke all on function public.switch_character_v1(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.switch_character_v1(uuid, uuid, uuid) to service_role;

commit;
