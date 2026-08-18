begin;

alter table public.characters
  add column if not exists vitality integer,
  add column if not exists insight integer;

update public.characters
set vitality = coalesce(vitality, 5),
    insight = coalesce(insight, 5)
where vitality is null or insight is null;

alter table public.characters
  alter column vitality set default 5,
  alter column vitality set not null,
  alter column insight set default 5,
  alter column insight set not null;

alter table public.characters
  drop constraint if exists characters_six_attributes_positive;
alter table public.characters
  add constraint characters_six_attributes_positive check (
    might > 0 and finesse > 0 and intellect > 0 and resolve > 0 and vitality > 0 and insight > 0
  );

alter table public.player_profiles
  add column if not exists avatar_url text,
  add column if not exists equipped_title text;

alter table public.player_profiles
  drop constraint if exists player_profiles_avatar_url_length;
alter table public.player_profiles
  add constraint player_profiles_avatar_url_length check (
    avatar_url is null or char_length(avatar_url) between 1 and 2048
  );

alter table public.player_profiles
  drop constraint if exists player_profiles_equipped_title_length;
alter table public.player_profiles
  add constraint player_profiles_equipped_title_length check (
    equipped_title is null or char_length(equipped_title) between 1 and 80
  );

create table if not exists app_private.account_character_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_character_id uuid references public.characters(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists app_private.character_return_cooldowns (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  return_available_at timestamptz not null,
  primary key (user_id, character_id)
);

create index if not exists character_return_cooldowns_due_idx
  on app_private.character_return_cooldowns (user_id, return_available_at);

revoke all on app_private.account_character_state from public, anon, authenticated;
revoke all on app_private.character_return_cooldowns from public, anon, authenticated;
grant select on app_private.account_character_state to service_role;
grant select on app_private.character_return_cooldowns to service_role;

comment on table app_private.account_character_state is
  'Server-authoritative currently selected character per account. Browser roles have no direct access.';
comment on table app_private.character_return_cooldowns is
  'Server-authoritative one-hour return lock applied to a character when the account swaps away from it.';

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
  intellect integer,
  resolve integer,
  vitality integer,
  insight integer,
  level integer,
  xp bigint,
  progression_cycle integer,
  created_at timestamptz,
  cycle_started_at timestamptz,
  last_active_at timestamptz,
  deletion_requested_at timestamptz,
  deletion_execute_after timestamptz,
  return_available_at timestamptz,
  is_active_character boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);

  delete from app_private.character_return_cooldowns cooldown
  where cooldown.user_id = p_user_id
    and cooldown.return_available_at <= clock_timestamp();

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
    character.intellect,
    character.resolve,
    character.vitality,
    character.insight,
    character.level,
    character.xp,
    character.progression_cycle,
    character.created_at,
    character.cycle_started_at,
    character.last_active_at,
    deletion.requested_at,
    deletion.delete_after,
    cooldown.return_available_at,
    coalesce(state.active_character_id = character.id, false)
  from public.characters character
  left join app_private.character_deletion_requests deletion
    on deletion.character_id = character.id
  left join app_private.character_return_cooldowns cooldown
    on cooldown.user_id = p_user_id and cooldown.character_id = character.id
  left join app_private.account_character_state state
    on state.user_id = p_user_id
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
  p_intellect integer,
  p_resolve integer,
  p_vitality integer,
  p_insight integer
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
  intellect integer,
  resolve integer,
  vitality integer,
  insight integer,
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

  if p_rules_version < 2 then
    raise exception using errcode = '22023', message = 'CHARACTER_RULESET_OUTDATED';
  end if;

  if least(p_might, p_finesse, p_intellect, p_resolve, p_vitality, p_insight) <= 0 then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTES_INVALID';
  end if;

  perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);

  if not exists (
    select 1 from public.player_profiles profile where profile.user_id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'PLAYER_PROFILE_UNAVAILABLE';
  end if;

  insert into app_private.idempotency_records (
    actor_key, command_name, idempotency_key, request_fingerprint, result
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
      character.intellect, character.resolve, character.vitality, character.insight,
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
    foundation_discipline_id, might, finesse, intellect, resolve, vitality, insight,
    level, xp, progression_cycle, created_at, cycle_started_at, last_active_at
  ) values (
    v_character_id, p_user_id, p_slot_index, p_rules_version, p_name, p_name_key,
    p_presentation_id, p_pronoun_preset_id, p_portrait_ref, p_starter_appearance_ref,
    p_foundation_discipline_id, p_might, p_finesse, p_intellect, p_resolve, p_vitality, p_insight,
    1, 0, 1, v_now, v_now, v_now
  );

  return query
  select
    character.id, character.user_id, character.slot_index, character.rules_version,
    character.name, character.name_key, character.presentation_id,
    character.pronoun_preset_id, character.portrait_ref, character.starter_appearance_ref,
    character.foundation_discipline_id, character.might, character.finesse,
    character.intellect, character.resolve, character.vitality, character.insight,
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

create or replace function public.select_character_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  character_id uuid,
  previous_character_id uuid,
  previous_return_available_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_previous uuid;
  v_return_after timestamptz;
  v_target_cooldown timestamptz;
begin
  perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);

  if not exists (
    select 1
    from public.characters character
    left join app_private.character_deletion_requests deletion
      on deletion.character_id = character.id
    where character.id = p_character_id
      and character.user_id = p_user_id
      and deletion.character_id is null
  ) then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_PLAYABLE';
  end if;

  delete from app_private.character_return_cooldowns cooldown
  where cooldown.user_id = p_user_id
    and cooldown.return_available_at <= v_now;

  select cooldown.return_available_at
  into v_target_cooldown
  from app_private.character_return_cooldowns cooldown
  where cooldown.user_id = p_user_id
    and cooldown.character_id = p_character_id
  for update;

  if found and v_target_cooldown > v_now then
    raise exception using
      errcode = 'P0001',
      message = 'CHARACTER_SWAP_COOLDOWN',
      detail = v_target_cooldown::text;
  end if;

  insert into app_private.account_character_state (user_id, active_character_id, updated_at)
  values (p_user_id, null, v_now)
  on conflict (user_id) do nothing;

  select state.active_character_id
  into v_previous
  from app_private.account_character_state state
  where state.user_id = p_user_id
  for update;

  if v_previous = p_character_id then
    update app_private.account_character_state
    set updated_at = v_now
    where user_id = p_user_id;
    return query select p_character_id, v_previous, null::timestamptz;
    return;
  end if;

  if v_previous is not null and exists (
    select 1 from public.characters character
    where character.id = v_previous and character.user_id = p_user_id
  ) then
    v_return_after := v_now + interval '1 hour';
    insert into app_private.character_return_cooldowns (
      user_id, character_id, return_available_at
    ) values (
      p_user_id, v_previous, v_return_after
    )
    on conflict (user_id, character_id) do update
      set return_available_at = excluded.return_available_at;
  end if;

  delete from app_private.character_return_cooldowns
  where user_id = p_user_id and character_id = p_character_id;

  update app_private.account_character_state
  set active_character_id = p_character_id,
      updated_at = v_now
  where user_id = p_user_id;

  return query select p_character_id, v_previous, v_return_after;
end;
$$;

revoke all on function public.select_character_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.select_character_v1(uuid, uuid) to service_role;

commit;
