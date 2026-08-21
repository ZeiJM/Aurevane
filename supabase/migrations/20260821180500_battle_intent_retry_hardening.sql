begin;

-- Stale battle requests are common during reconnects, duplicate browser delivery, and races between
-- authoritative updates. They must stay read-only unless the idempotency key already identifies a
-- successfully committed intent.
create or replace function public.get_battle_intent_replay_v1(
  p_actor_key text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_user_id uuid,
  p_battle_session_id uuid
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
stable
as $$
declare
  v_command_name constant text := 'battle.intent.v2';
  v_existing app_private.idempotency_records%rowtype;
begin
  if p_actor_key is null or char_length(p_actor_key) not between 1 and 160
    or p_request_fingerprint is null or char_length(p_request_fingerprint) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_INTENT_REPLAY_PAYLOAD';
  end if;

  select * into v_existing
  from app_private.idempotency_records i
  where i.actor_key = p_actor_key
    and i.command_name = v_command_name
    and i.idempotency_key = p_idempotency_key;

  if not found then
    return;
  end if;

  if v_existing.request_fingerprint <> p_request_fingerprint
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
end;
$$;

comment on function public.get_battle_intent_replay_v1(text, uuid, text, uuid, uuid) is
  'Read-only lookup for a previously committed battle.intent.v2 idempotency result.';

revoke all on function public.get_battle_intent_replay_v1(text, uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_battle_intent_replay_v1(text, uuid, text, uuid, uuid)
  to service_role;

-- Harden the mutation path so rejected stale/terminal/invalid requests do not create and roll back
-- idempotency rows. Existing idempotent replays are still returned exactly as before.
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
  v_committed_at timestamptz;
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

  -- Fast path for a request that already committed. This preserves retry safety without taking the
  -- battle row lock or attempting another write.
  select * into v_existing
  from app_private.idempotency_records i
  where i.actor_key = p_actor_key
    and i.command_name = v_command_name
    and i.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
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

  -- Serialize competing mutations for this battle before validating the expected version.
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

  -- A duplicate request may have completed while this transaction waited for the battle lock.
  select * into v_existing
  from app_private.idempotency_records i
  where i.actor_key = p_actor_key
    and i.command_name = v_command_name
    and i.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
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

  if v_session.current_version <> p_expected_battle_version then
    raise exception using errcode = '40001',
      message = 'BATTLE_VERSION_STALE:' || v_session.current_version::text;
  end if;

  if v_session.lifecycle in ('completed', 'abandoned') then
    raise exception using errcode = '22023', message = 'BATTLE_SESSION_TERMINAL';
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

  v_next_version := p_expected_battle_version + 1;
  v_committed_at := clock_timestamp();

  -- Only requests that passed authority, version, lifecycle, and snapshot validation may reserve an
  -- idempotency key. This is the critical ordering that prevents stale retry storms from producing
  -- millions of rolled-back INSERT attempts.
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

comment on function public.commit_battle_intent_v2(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb) is
  'Atomically commits one authoritative battle intent while rejecting stale/terminal requests before any idempotency write.';

revoke all on function public.commit_battle_intent_v2(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_battle_intent_v2(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb)
  to service_role;

commit;
