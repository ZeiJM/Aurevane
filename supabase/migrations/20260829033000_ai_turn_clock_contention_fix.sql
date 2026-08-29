create or replace function public.ensure_ai_turn_clock_v1(
  p_user_id uuid,
  p_battle_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_session app_private.battle_sessions%rowtype;
  v_turn_number bigint;
  v_combatant_id text;
  v_clock app_private.ai_turn_clocks%rowtype;
begin
  -- Normal watchdog reads must not take the battle-session write lock. Action commits lock the
  -- same row, so polling it FOR UPDATE can queue behind a commit and amplify concurrent requests.
  select s.* into v_session
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and not exists (
      select 1 from app_private.pvp_lobbies l where l.battle_session_id = s.id
    )
    and exists (
      select 1 from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    );

  if not found then return null; end if;
  if v_session.lifecycle <> 'active' then
    delete from app_private.ai_turn_clocks where battle_session_id = p_battle_session_id;
    return jsonb_build_object('active', false);
  end if;

  v_turn_number := (v_session.current_snapshot #>> '{tactical,battle,turnNumber}')::bigint;
  v_combatant_id := v_session.current_snapshot #>> '{tactical,battle,currentTurn,combatantId}';
  if v_turn_number is null or v_combatant_id is null then
    raise exception using errcode = '22023', message = 'AI_INVALID_TURN_CLOCK_STATE';
  end if;

  if not exists (
    select 1 from app_private.battle_participants p
    where p.battle_session_id = p_battle_session_id
      and p.user_id = p_user_id
      and p.participant_role = 'player'
      and p.combatant_id = v_combatant_id
  ) then
    delete from app_private.ai_turn_clocks where battle_session_id = p_battle_session_id;
    return jsonb_build_object('active', false);
  end if;

  select * into v_clock
  from app_private.ai_turn_clocks
  where battle_session_id = p_battle_session_id;

  if found
    and v_clock.turn_number = v_turn_number
    and v_clock.combatant_id = v_combatant_id then
    return jsonb_build_object(
      'active', true,
      'turn_number', v_clock.turn_number,
      'combatant_id', v_clock.combatant_id,
      'deadline_at', v_clock.deadline_at,
      'expired', clock_timestamp() >= v_clock.deadline_at
    );
  end if;

  -- A new player turn needs exactly one authoritative deadline. Serialize only this uncommon
  -- initialization path with battle commits, then re-read the authoritative snapshot under lock so
  -- a concurrent action cannot leave a clock behind for a stale turn.
  select s.* into v_session
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and not exists (
      select 1 from app_private.pvp_lobbies l where l.battle_session_id = s.id
    )
    and exists (
      select 1 from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    )
  for update;

  if not found then return null; end if;
  if v_session.lifecycle <> 'active' then
    delete from app_private.ai_turn_clocks where battle_session_id = p_battle_session_id;
    return jsonb_build_object('active', false);
  end if;

  v_turn_number := (v_session.current_snapshot #>> '{tactical,battle,turnNumber}')::bigint;
  v_combatant_id := v_session.current_snapshot #>> '{tactical,battle,currentTurn,combatantId}';
  if v_turn_number is null or v_combatant_id is null then
    raise exception using errcode = '22023', message = 'AI_INVALID_TURN_CLOCK_STATE';
  end if;

  if not exists (
    select 1 from app_private.battle_participants p
    where p.battle_session_id = p_battle_session_id
      and p.user_id = p_user_id
      and p.participant_role = 'player'
      and p.combatant_id = v_combatant_id
  ) then
    delete from app_private.ai_turn_clocks where battle_session_id = p_battle_session_id;
    return jsonb_build_object('active', false);
  end if;

  insert into app_private.ai_turn_clocks as clock (
    battle_session_id,
    turn_number,
    combatant_id,
    deadline_at,
    updated_at
  ) values (
    p_battle_session_id,
    v_turn_number,
    v_combatant_id,
    clock_timestamp() + interval '60 seconds',
    clock_timestamp()
  )
  on conflict (battle_session_id) do update
  set turn_number = excluded.turn_number,
      combatant_id = excluded.combatant_id,
      deadline_at = excluded.deadline_at,
      updated_at = excluded.updated_at
  where clock.turn_number is distinct from excluded.turn_number
     or clock.combatant_id is distinct from excluded.combatant_id
  returning * into v_clock;

  -- Another caller may have initialized this same turn while we were waiting for the battle row.
  -- In that case the conditional upsert intentionally performs no write; read the winning clock.
  if not found then
    select * into v_clock
    from app_private.ai_turn_clocks
    where battle_session_id = p_battle_session_id;
  end if;

  if not found then
    raise exception using errcode = '55000', message = 'AI_TURN_CLOCK_INITIALIZATION_FAILED';
  end if;

  return jsonb_build_object(
    'active', true,
    'turn_number', v_clock.turn_number,
    'combatant_id', v_clock.combatant_id,
    'deadline_at', v_clock.deadline_at,
    'expired', clock_timestamp() >= v_clock.deadline_at
  );
end;
$$;
