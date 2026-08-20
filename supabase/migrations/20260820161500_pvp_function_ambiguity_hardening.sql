begin;

-- Harden two PvP/battle functions against PL/pgSQL output-variable name collisions.
-- PostgreSQL exposes RETURNS TABLE column names as variables inside PL/pgSQL, so
-- table columns with the same names must be explicitly qualified.

create or replace function public.create_pvp_battle_session_v1(
  p_actor_user_id uuid,
  p_lobby_id uuid,
  p_battle_id text,
  p_rules_version integer,
  p_content_version integer,
  p_initial_snapshot jsonb,
  p_participants jsonb
)
returns table (
  battle_session_id uuid,
  battle_version bigint,
  snapshot jsonb,
  created_at timestamptz,
  battle_key text
)
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
as $$
declare
  v_lobby app_private.pvp_lobbies%rowtype;
  v_session_id uuid := gen_random_uuid();
  v_created_at timestamptz := clock_timestamp();
  v_battle_key text;
  v_member_count integer;
  v_participant_count integer := 0;
  v_participant record;
  v_attempt integer := 0;
  v_lifecycle text;
begin
  select * into v_lobby
  from app_private.pvp_lobbies l
  where l.id = p_lobby_id
  for update;

  if not found or not exists (
    select 1
    from app_private.pvp_lobby_members m
    where m.lobby_id = p_lobby_id and m.user_id = p_actor_user_id
  ) then
    raise exception using errcode = '42501', message = 'PVP_LOBBY_NOT_AVAILABLE';
  end if;

  if v_lobby.status = 'active' and v_lobby.battle_session_id is not null then
    return query
    select s.id, s.current_version, s.current_snapshot, s.created_at, v_lobby.battle_key
    from app_private.battle_sessions s
    where s.id = v_lobby.battle_session_id;
    return;
  end if;

  if v_lobby.status <> 'waiting' then
    raise exception using errcode = '22023', message = 'PVP_LOBBY_NOT_WAITING';
  end if;

  select count(*) into v_member_count
  from app_private.pvp_lobby_members m
  where m.lobby_id = p_lobby_id;

  if v_member_count <> v_lobby.team_a_size + v_lobby.team_b_size + v_lobby.team_c_size
    or exists (
      select 1
      from app_private.pvp_lobby_members m
      where m.lobby_id = p_lobby_id and not m.ready
    ) then
    raise exception using errcode = '22023', message = 'PVP_LOBBY_NOT_READY';
  end if;

  if p_battle_id is null or char_length(p_battle_id) not between 1 and 160
    or p_rules_version is null or p_rules_version <= 0
    or p_content_version is null or p_content_version <= 0
    or jsonb_typeof(p_initial_snapshot) <> 'object'
    or jsonb_typeof(p_participants) <> 'array' then
    raise exception using errcode = '22023', message = 'PVP_INVALID_BATTLE_PAYLOAD';
  end if;

  if p_initial_snapshot #>> '{tactical,battle,battleId}' <> p_battle_id
    or (p_initial_snapshot #>> '{tactical,battle,rulesVersion}')::integer <> p_rules_version
    or (p_initial_snapshot #>> '{tactical,battle,contentVersion}')::integer <> p_content_version then
    raise exception using errcode = '22023', message = 'BATTLE_SNAPSHOT_IDENTITY_MISMATCH';
  end if;

  v_lifecycle := p_initial_snapshot #>> '{tactical,battle,lifecycle}';
  if v_lifecycle <> 'active' then
    raise exception using errcode = '22023', message = 'PVP_BATTLE_MUST_START_ACTIVE';
  end if;

  for v_participant in
    select *
    from jsonb_to_recordset(p_participants) as p(
      combatant_id text,
      user_id uuid,
      character_id uuid,
      team_index integer
    )
  loop
    v_participant_count := v_participant_count + 1;

    if not exists (
      select 1
      from app_private.pvp_lobby_members m
      where m.lobby_id = p_lobby_id
        and m.user_id = v_participant.user_id
        and m.character_id = v_participant.character_id
        and m.team_index = v_participant.team_index
    ) then
      raise exception using errcode = '42501', message = 'PVP_PARTICIPANT_MISMATCH';
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(p_initial_snapshot #> '{tactical,battle,combatants}') combatant
      where combatant ->> 'id' = v_participant.combatant_id
        and combatant ->> 'teamId' = 'team:' || v_participant.team_index::text
    ) then
      raise exception using errcode = '22023', message = 'PVP_PARTICIPANT_NOT_IN_SNAPSHOT';
    end if;
  end loop;

  if v_participant_count <> v_member_count then
    raise exception using errcode = '22023', message = 'PVP_PARTICIPANT_COVERAGE_INVALID';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_battle_key := app_private.pvp_key('AVB');
    exit when not exists (
      select 1
      from app_private.pvp_lobbies l
      where l.battle_key = v_battle_key
    );
    if v_attempt >= 8 then
      raise exception using errcode = '23505', message = 'PVP_BATTLE_KEY_COLLISION';
    end if;
  end loop;

  insert into app_private.battle_sessions (
    id, owner_user_id, battle_id, rules_version, content_version,
    current_version, lifecycle, current_snapshot, created_at, updated_at
  ) values (
    v_session_id, v_lobby.owner_user_id, p_battle_id, p_rules_version, p_content_version,
    1, 'active', p_initial_snapshot, v_created_at, v_created_at
  );

  for v_participant in
    select *
    from jsonb_to_recordset(p_participants) as p(
      combatant_id text,
      user_id uuid,
      character_id uuid,
      team_index integer
    )
  loop
    insert into app_private.battle_participants (
      battle_session_id, combatant_id, participant_role, user_id, character_id
    ) values (
      v_session_id, v_participant.combatant_id, 'player',
      v_participant.user_id, v_participant.character_id
    );
  end loop;

  insert into app_private.battle_snapshots (
    battle_session_id, battle_version, snapshot, created_at
  ) values (v_session_id, 1, p_initial_snapshot, v_created_at);

  update app_private.pvp_lobbies as l
  set status = 'active',
      battle_session_id = v_session_id,
      battle_key = v_battle_key,
      updated_at = v_created_at
  where l.id = p_lobby_id;

  return query
  select v_session_id, 1::bigint, p_initial_snapshot, v_created_at, v_battle_key;
end;
$$;

create or replace function public.commit_battle_intent_v2(
  p_actor_key text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_user_id uuid,
  p_battle_session_id uuid,
  p_expected_battle_version bigint,
  p_next_snapshot jsonb,
  p_events jsonb
)
returns table (
  battle_session_id uuid,
  battle_version bigint,
  snapshot jsonb,
  committed_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_command_name constant text := 'battle.intent.v2';
  v_existing app_private.idempotency_records%rowtype;
  v_session app_private.battle_sessions%rowtype;
  v_next_version bigint;
  v_committed_at timestamptz := clock_timestamp();
  v_rows_inserted integer;
  v_lifecycle text;
begin
  if p_actor_key is null or char_length(p_actor_key) not between 1 and 160
    or p_request_fingerprint is null or char_length(p_request_fingerprint) not between 1 and 160
    or p_expected_battle_version is null or p_expected_battle_version < 1
    or p_expected_battle_version = 9223372036854775807
    or jsonb_typeof(p_next_snapshot) <> 'object'
    or jsonb_typeof(p_events) <> 'array' then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_INTENT_PAYLOAD';
  end if;

  v_next_version := p_expected_battle_version + 1;

  insert into app_private.idempotency_records (
    actor_key, command_name, idempotency_key, request_fingerprint, result
  ) values (
    p_actor_key, v_command_name, p_idempotency_key, p_request_fingerprint,
    jsonb_build_object(
      'battle_session_id', p_battle_session_id,
      'battle_version', v_next_version,
      'committed_at', v_committed_at
    )
  ) on conflict (actor_key, command_name, idempotency_key) do nothing;

  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select * into v_existing
    from app_private.idempotency_records i
    where i.actor_key = p_actor_key
      and i.command_name = v_command_name
      and i.idempotency_key = p_idempotency_key;

    if not found or v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'battle_session_id')::uuid <> p_battle_session_id then
      raise exception using errcode = '22023', message = 'BATTLE_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      p_battle_session_id,
      (v_existing.result ->> 'battle_version')::bigint,
      snap.snapshot,
      (v_existing.result ->> 'committed_at')::timestamptz,
      true
    from app_private.battle_snapshots snap
    where snap.battle_session_id = p_battle_session_id
      and snap.battle_version = (v_existing.result ->> 'battle_version')::bigint
      and exists (
        select 1
        from app_private.battle_participants p
        where p.battle_session_id = p_battle_session_id
          and p.user_id = p_user_id
          and p.participant_role = 'player'
      );

    if not found then
      raise exception using errcode = '42501', message = 'BATTLE_NOT_AVAILABLE';
    end if;
    return;
  end if;

  select s.* into v_session
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and exists (
      select 1
      from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    )
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'BATTLE_NOT_AVAILABLE';
  end if;

  if v_session.current_version <> p_expected_battle_version then
    raise exception using errcode = '40001',
      message = 'BATTLE_VERSION_STALE:' || v_session.current_version::text;
  end if;

  if p_next_snapshot #>> '{tactical,battle,battleId}' <> v_session.battle_id
    or (p_next_snapshot #>> '{tactical,battle,rulesVersion}')::integer <> v_session.rules_version
    or (p_next_snapshot #>> '{tactical,battle,contentVersion}')::integer <> v_session.content_version then
    raise exception using errcode = '22023', message = 'BATTLE_SNAPSHOT_IDENTITY_MISMATCH';
  end if;

  v_lifecycle := p_next_snapshot #>> '{tactical,battle,lifecycle}';
  if v_lifecycle not in ('pending', 'active', 'completed', 'abandoned') then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_LIFECYCLE';
  end if;

  update app_private.battle_sessions
  set current_version = v_next_version,
      lifecycle = v_lifecycle,
      current_snapshot = p_next_snapshot,
      updated_at = v_committed_at
  where id = p_battle_session_id;

  insert into app_private.battle_snapshots (
    battle_session_id, battle_version, snapshot, created_at
  ) values (p_battle_session_id, v_next_version, p_next_snapshot, v_committed_at);

  insert into app_private.battle_events (
    battle_session_id, battle_version, event_index, event, created_at
  )
  select p_battle_session_id, v_next_version, (row.ordinality - 1)::integer,
    row.value, v_committed_at
  from jsonb_array_elements(p_events) with ordinality as row(value, ordinality);

  if v_lifecycle = 'completed' then
    update app_private.pvp_lobbies as l
    set status = 'completed', updated_at = v_committed_at
    where l.battle_session_id = p_battle_session_id and l.status = 'active';
  end if;

  return query
  select p_battle_session_id, v_next_version, p_next_snapshot, v_committed_at, false;
end;
$$;

commit;
