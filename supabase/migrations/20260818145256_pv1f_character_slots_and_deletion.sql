begin;

alter table public.characters
  add constraint characters_slot_index_v2_range
  check (slot_index between 0 and 2) not valid;

alter table public.characters
  validate constraint characters_slot_index_v2_range;

create table app_private.character_deletion_requests (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null,
  delete_after timestamptz not null,
  constraint character_deletion_request_delay check (
    delete_after = requested_at + interval '24 hours'
  )
);

create index character_deletion_requests_user_due_idx
  on app_private.character_deletion_requests (user_id, delete_after);

comment on table app_private.character_deletion_requests is
  'Server-authoritative 24-hour character deletion grace state. Browser roles have no direct access.';

revoke all on table app_private.character_deletion_requests from public, anon, authenticated;
grant select on table app_private.character_deletion_requests to service_role;

create or replace function app_private.finalize_due_character_deletions_for_user_v1(
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_character_id uuid;
  v_count integer := 0;
begin
  for v_character_id in
    select request.character_id
    from app_private.character_deletion_requests request
    join public.characters character on character.id = request.character_id
    where request.user_id = p_user_id
      and character.user_id = p_user_id
      and request.delete_after <= clock_timestamp()
    order by request.delete_after, request.character_id
    for update of request, character
  loop
    perform app_private.abandon_active_battles_for_user_v1(p_user_id);

    delete from app_private.battle_sessions session
    using app_private.battle_participants participant
    where participant.battle_session_id = session.id
      and participant.character_id = v_character_id;

    delete from public.characters
    where id = v_character_id
      and user_id = p_user_id;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function app_private.finalize_due_character_deletions_for_user_v1(uuid)
  from public, anon, authenticated;

create or replace function public.get_character_slots_v1(p_user_id uuid)
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
  level integer,
  xp bigint,
  progression_cycle integer,
  created_at timestamptz,
  cycle_started_at timestamptz,
  last_active_at timestamptz,
  deletion_requested_at timestamptz,
  deletion_execute_after timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);

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
    character.level,
    character.xp,
    character.progression_cycle,
    character.created_at,
    character.cycle_started_at,
    character.last_active_at,
    request.requested_at,
    request.delete_after
  from public.characters character
  left join app_private.character_deletion_requests request
    on request.character_id = character.id
  where character.user_id = p_user_id
  order by character.slot_index;
end;
$$;

revoke all on function public.get_character_slots_v1(uuid) from public, anon, authenticated;
grant execute on function public.get_character_slots_v1(uuid) to service_role;

create or replace function public.create_character_v2(
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
  v_command_name constant text := 'character.create.v2';
  v_character_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
  v_constraint_name text;
begin
  if p_slot_index is null or p_slot_index < 0 or p_slot_index > 2 then
    raise exception using errcode = '22023', message = 'CHARACTER_SLOT_INVALID';
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
      character.intellect, character.resolve, character.level, character.xp,
      character.progression_cycle, character.created_at, character.cycle_started_at,
      character.last_active_at, true
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
    foundation_discipline_id, might, finesse, intellect, resolve,
    level, xp, progression_cycle, created_at, cycle_started_at, last_active_at
  ) values (
    v_character_id, p_user_id, p_slot_index, p_rules_version, p_name, p_name_key,
    p_presentation_id, p_pronoun_preset_id, p_portrait_ref, p_starter_appearance_ref,
    p_foundation_discipline_id, p_might, p_finesse, p_intellect, p_resolve,
    1, 0, 1, v_now, v_now, v_now
  );

  return query
  select
    character.id, character.user_id, character.slot_index, character.rules_version,
    character.name, character.name_key, character.presentation_id,
    character.pronoun_preset_id, character.portrait_ref, character.starter_appearance_ref,
    character.foundation_discipline_id, character.might, character.finesse,
    character.intellect, character.resolve, character.level, character.xp,
    character.progression_cycle, character.created_at, character.cycle_started_at,
    character.last_active_at, false
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

revoke all on function public.create_character_v2(
  uuid, smallint, uuid, text, integer, text, text, text, text, text, text, text,
  integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.create_character_v2(
  uuid, smallint, uuid, text, integer, text, text, text, text, text, text, text,
  integer, integer, integer, integer
) to service_role;

create or replace function public.request_character_deletion_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_confirmation_phrase text
)
returns table (requested_at timestamptz, delete_after timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_character public.characters%rowtype;
  v_request app_private.character_deletion_requests%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);

  select * into v_character
  from public.characters
  where id = p_character_id and user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  if p_confirmation_phrase <> 'DELETE ' || v_character.name then
    raise exception using errcode = '22023', message = 'CHARACTER_DELETE_CONFIRMATION_MISMATCH';
  end if;

  select * into v_request
  from app_private.character_deletion_requests
  where character_id = p_character_id
  for update;

  if found then
    return query select v_request.requested_at, v_request.delete_after;
    return;
  end if;

  insert into app_private.character_deletion_requests (
    character_id, user_id, requested_at, delete_after
  ) values (
    p_character_id, p_user_id, v_now, v_now + interval '24 hours'
  )
  returning * into v_request;

  perform app_private.abandon_active_battles_for_user_v1(p_user_id);

  return query select v_request.requested_at, v_request.delete_after;
end;
$$;

create or replace function public.cancel_character_deletion_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_request app_private.character_deletion_requests%rowtype;
begin
  select * into v_request
  from app_private.character_deletion_requests request
  where request.character_id = p_character_id
    and request.user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  if v_request.delete_after <= clock_timestamp() then
    perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);
    return false;
  end if;

  delete from app_private.character_deletion_requests
  where character_id = p_character_id and user_id = p_user_id;
  return true;
end;
$$;

revoke all on function public.request_character_deletion_v1(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.cancel_character_deletion_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.request_character_deletion_v1(uuid, uuid, text) to service_role;
grant execute on function public.cancel_character_deletion_v1(uuid, uuid) to service_role;

commit;
