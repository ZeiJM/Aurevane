begin;

-- PvP turn-clock heartbeats are read-mostly coordination. They must never lock the
-- authoritative battle row that a combat commit needs in order to advance the turn.
create or replace function public.ensure_pvp_turn_clock_v1(
  p_user_id uuid,
  p_battle_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_lifecycle text;
  v_snapshot jsonb;
  v_turn_number bigint;
  v_combatant_id text;
  v_turn_timer_seconds integer;
  v_clock app_private.pvp_turn_clocks%rowtype;
begin
  select s.lifecycle, s.current_snapshot
    into v_lifecycle, v_snapshot
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and exists (
      select 1
      from app_private.pvp_lobbies l
      where l.battle_session_id = s.id
    )
    and exists (
      select 1
      from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    );

  if not found then return null; end if;

  if v_lifecycle <> 'active' then
    delete from app_private.pvp_turn_clocks
    where battle_session_id = p_battle_session_id;
    return jsonb_build_object('active', false, 'turn_timer_seconds', null);
  end if;

  select case when settings.lobby_id is null then 60 else settings.turn_timer_seconds end
    into v_turn_timer_seconds
  from app_private.pvp_lobbies lobby
  left join app_private.pvp_lobby_settings settings on settings.lobby_id = lobby.id
  where lobby.battle_session_id = p_battle_session_id;

  if not found then
    v_turn_timer_seconds := 60;
  end if;

  if v_turn_timer_seconds is null then
    delete from app_private.pvp_turn_clocks
    where battle_session_id = p_battle_session_id;
    return jsonb_build_object('active', false, 'turn_timer_seconds', null);
  end if;

  v_turn_number := (v_snapshot #>> '{tactical,battle,turnNumber}')::bigint;
  v_combatant_id := v_snapshot #>> '{tactical,battle,currentTurn,combatantId}';
  if v_turn_number is null or v_combatant_id is null then
    raise exception using errcode = '22023', message = 'PVP_INVALID_TURN_CLOCK_STATE';
  end if;

  -- Only the tiny clock row may contend between heartbeats. A delayed heartbeat from
  -- an older turn is not allowed to roll the clock backwards after a commit advances it.
  insert into app_private.pvp_turn_clocks (
    battle_session_id,
    turn_number,
    combatant_id,
    deadline_at,
    updated_at
  ) values (
    p_battle_session_id,
    v_turn_number,
    v_combatant_id,
    clock_timestamp() + make_interval(secs => v_turn_timer_seconds),
    clock_timestamp()
  )
  on conflict (battle_session_id) do update
  set turn_number = excluded.turn_number,
      combatant_id = excluded.combatant_id,
      deadline_at = excluded.deadline_at,
      updated_at = excluded.updated_at
  where excluded.turn_number > app_private.pvp_turn_clocks.turn_number
  returning * into v_clock;

  if not found then
    select * into v_clock
    from app_private.pvp_turn_clocks
    where battle_session_id = p_battle_session_id;
  end if;

  if v_clock.battle_session_id is null then
    raise exception using errcode = '55000', message = 'PVP_TURN_CLOCK_UNAVAILABLE';
  end if;

  return jsonb_build_object(
    'active', true,
    'turn_number', v_clock.turn_number,
    'combatant_id', v_clock.combatant_id,
    'deadline_at', v_clock.deadline_at,
    'expired', clock_timestamp() >= v_clock.deadline_at,
    'turn_timer_seconds', v_turn_timer_seconds
  );
end;
$$;

-- The generic battle commit guard only needs to know whether this authenticated
-- participant is in PvP. Avoid loading the full PvP metadata/portrait payload first.
create or replace function public.is_pvp_battle_for_user_v1(
  p_user_id uuid,
  p_battle_session_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, app_private
as $$
  select exists (
    select 1
    from app_private.pvp_lobbies l
    join app_private.battle_participants p
      on p.battle_session_id = l.battle_session_id
    where l.battle_session_id = p_battle_session_id
      and p.user_id = p_user_id
      and p.participant_role = 'player'
  );
$$;

revoke all on function public.ensure_pvp_turn_clock_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_pvp_battle_for_user_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ensure_pvp_turn_clock_v1(uuid, uuid) to service_role;
grant execute on function public.is_pvp_battle_for_user_v1(uuid, uuid) to service_role;

commit;
