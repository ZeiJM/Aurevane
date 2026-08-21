begin;

alter table app_private.pvp_lobby_settings
  add column if not exists turn_timer_seconds integer default 60;

alter table app_private.pvp_lobby_settings
  drop constraint if exists pvp_lobby_settings_turn_timer_seconds_check;

alter table app_private.pvp_lobby_settings
  add constraint pvp_lobby_settings_turn_timer_seconds_check
  check (turn_timer_seconds is null or turn_timer_seconds in (60, 120));

create or replace function public.set_pvp_lobby_settings_v2(
  p_user_id uuid,
  p_lobby_id uuid,
  p_map_size text,
  p_elevation_bias text,
  p_terrain_bias text,
  p_turn_timer_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
begin
  if p_map_size is null
    or p_map_size not in ('medium', 'large')
    or p_elevation_bias is null
    or p_elevation_bias not in ('less', 'neutral', 'more')
    or p_terrain_bias is null
    or p_terrain_bias not in ('less', 'neutral', 'more')
    or (p_turn_timer_seconds is not null and p_turn_timer_seconds not in (60, 120)) then
    raise exception using errcode = '22023', message = 'PVP_INVALID_MAP_SETTINGS';
  end if;

  if not exists (
    select 1 from app_private.pvp_lobbies l
    where l.id = p_lobby_id and l.owner_user_id = p_user_id and l.status = 'waiting'
  ) then
    raise exception using errcode = '42501', message = 'PVP_LOBBY_NOT_AVAILABLE';
  end if;

  insert into app_private.pvp_lobby_settings (
    lobby_id,
    map_size,
    elevation_bias,
    terrain_bias,
    turn_timer_seconds,
    updated_at
  ) values (
    p_lobby_id,
    p_map_size,
    p_elevation_bias,
    p_terrain_bias,
    p_turn_timer_seconds,
    clock_timestamp()
  )
  on conflict (lobby_id) do update
  set map_size = excluded.map_size,
      elevation_bias = excluded.elevation_bias,
      terrain_bias = excluded.terrain_bias,
      turn_timer_seconds = excluded.turn_timer_seconds,
      updated_at = excluded.updated_at;

  update app_private.pvp_lobby_members set ready = false where lobby_id = p_lobby_id;
  update app_private.pvp_lobbies set updated_at = clock_timestamp() where id = p_lobby_id;
  return true;
end;
$$;

create or replace function public.get_pvp_lobby_settings_v2(
  p_user_id uuid,
  p_lobby_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private
stable
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
    from app_private.pvp_lobbies l
    where l.id = p_lobby_id
      and (
        l.owner_user_id = p_user_id
        or exists (
          select 1 from app_private.pvp_lobby_members m
          where m.lobby_id = l.id and m.user_id = p_user_id
        )
      )
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'map_size', coalesce(s.map_size, 'medium'),
    'elevation_bias', coalesce(s.elevation_bias, 'neutral'),
    'terrain_bias', coalesce(s.terrain_bias, 'neutral'),
    'turn_timer_seconds', case when s.lobby_id is null then 60 else s.turn_timer_seconds end
  )
  into v_result
  from app_private.pvp_lobbies l
  left join app_private.pvp_lobby_settings s on s.lobby_id = l.id
  where l.id = p_lobby_id;

  return v_result;
end;
$$;

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
  v_session app_private.battle_sessions%rowtype;
  v_turn_number bigint;
  v_combatant_id text;
  v_turn_timer_seconds integer;
  v_clock app_private.pvp_turn_clocks%rowtype;
begin
  select s.* into v_session
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and exists (
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
    delete from app_private.pvp_turn_clocks where battle_session_id = p_battle_session_id;
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
    delete from app_private.pvp_turn_clocks where battle_session_id = p_battle_session_id;
    return jsonb_build_object('active', false, 'turn_timer_seconds', null);
  end if;

  v_turn_number := (v_session.current_snapshot #>> '{tactical,battle,turnNumber}')::bigint;
  v_combatant_id := v_session.current_snapshot #>> '{tactical,battle,currentTurn,combatantId}';
  if v_turn_number is null or v_combatant_id is null then
    raise exception using errcode = '22023', message = 'PVP_INVALID_TURN_CLOCK_STATE';
  end if;

  select * into v_clock
  from app_private.pvp_turn_clocks
  where battle_session_id = p_battle_session_id
  for update;

  if not found or v_clock.turn_number <> v_turn_number or v_clock.combatant_id <> v_combatant_id then
    insert into app_private.pvp_turn_clocks (
      battle_session_id, turn_number, combatant_id, deadline_at, updated_at
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
    returning * into v_clock;
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

revoke all on function public.set_pvp_lobby_settings_v2(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.get_pvp_lobby_settings_v2(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_pvp_lobby_settings_v2(uuid, uuid, text, text, text, integer) to service_role;
grant execute on function public.get_pvp_lobby_settings_v2(uuid, uuid) to service_role;

commit;
