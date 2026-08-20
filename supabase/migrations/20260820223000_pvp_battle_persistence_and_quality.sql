begin;

-- Re-authentication/session replacement must never destroy an authoritative battle.
create or replace function public.claim_active_game_session_v1(
  p_user_id uuid,
  p_auth_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_previous_session_id text;
  v_replaced boolean := false;
begin
  if p_auth_session_id is null or char_length(p_auth_session_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'ACTIVE_GAME_SESSION_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select auth_session_id
  into v_previous_session_id
  from app_private.account_game_session_leases
  where user_id = p_user_id
  for update;

  if found then
    v_replaced := v_previous_session_id <> p_auth_session_id;
    update app_private.account_game_session_leases
    set
      auth_session_id = p_auth_session_id,
      claimed_at = case when v_replaced then clock_timestamp() else claimed_at end,
      last_seen_at = clock_timestamp()
    where user_id = p_user_id;
  else
    insert into app_private.account_game_session_leases (
      user_id,
      auth_session_id,
      claimed_at,
      last_seen_at
    ) values (
      p_user_id,
      p_auth_session_id,
      clock_timestamp(),
      clock_timestamp()
    );
  end if;

  -- Deliberately do not abandon active battles here. Battle lifecycle is gameplay state,
  -- not authentication-session state.
  return v_replaced;
end;
$$;

revoke all on function public.claim_active_game_session_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_active_game_session_v1(uuid, text) to service_role;

create or replace function public.get_active_battle_for_user_v1(p_user_id uuid)
returns table (
  battle_session_id uuid,
  battle_id text,
  lifecycle text,
  updated_at timestamptz,
  is_pvp boolean
)
language sql
security definer
set search_path = pg_catalog, app_private
stable
as $$
  select
    s.id,
    s.battle_id,
    s.lifecycle,
    s.updated_at,
    exists(select 1 from app_private.pvp_lobbies l where l.battle_session_id = s.id)
  from app_private.battle_sessions s
  where s.lifecycle = 'active'
    and exists (
      select 1
      from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    )
  order by s.updated_at desc, s.id desc
  limit 1;
$$;

revoke all on function public.get_active_battle_for_user_v1(uuid) from public, anon, authenticated;
grant execute on function public.get_active_battle_for_user_v1(uuid) to service_role;

create table if not exists app_private.pvp_lobby_settings (
  lobby_id uuid primary key references app_private.pvp_lobbies(id) on delete cascade,
  map_size text not null default 'medium' check (map_size in ('medium', 'large')),
  elevation_bias text not null default 'neutral' check (elevation_bias in ('less', 'neutral', 'more')),
  terrain_bias text not null default 'neutral' check (terrain_bias in ('less', 'neutral', 'more')),
  updated_at timestamptz not null default clock_timestamp()
);

revoke all on table app_private.pvp_lobby_settings from public, anon, authenticated;
grant select, insert, update on table app_private.pvp_lobby_settings to service_role;

create or replace function public.set_pvp_lobby_settings_v1(
  p_user_id uuid,
  p_lobby_id uuid,
  p_map_size text,
  p_elevation_bias text,
  p_terrain_bias text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
begin
  if p_map_size not in ('medium', 'large')
    or p_elevation_bias not in ('less', 'neutral', 'more')
    or p_terrain_bias not in ('less', 'neutral', 'more') then
    raise exception using errcode = '22023', message = 'PVP_INVALID_MAP_SETTINGS';
  end if;

  if not exists (
    select 1 from app_private.pvp_lobbies l
    where l.id = p_lobby_id and l.owner_user_id = p_user_id and l.status = 'waiting'
  ) then
    raise exception using errcode = '42501', message = 'PVP_LOBBY_NOT_AVAILABLE';
  end if;

  insert into app_private.pvp_lobby_settings (
    lobby_id, map_size, elevation_bias, terrain_bias, updated_at
  ) values (
    p_lobby_id, p_map_size, p_elevation_bias, p_terrain_bias, clock_timestamp()
  )
  on conflict (lobby_id) do update
  set map_size = excluded.map_size,
      elevation_bias = excluded.elevation_bias,
      terrain_bias = excluded.terrain_bias,
      updated_at = excluded.updated_at;

  return true;
end;
$$;

create or replace function public.get_pvp_lobby_settings_v1(
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
    'terrain_bias', coalesce(s.terrain_bias, 'neutral')
  )
  into v_result
  from app_private.pvp_lobbies l
  left join app_private.pvp_lobby_settings s on s.lobby_id = l.id
  where l.id = p_lobby_id;

  return v_result;
end;
$$;

create or replace function public.move_pvp_lobby_seat_v1(
  p_user_id uuid,
  p_lobby_id uuid,
  p_target_team_index integer,
  p_target_seat_index integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_lobby app_private.pvp_lobbies%rowtype;
  v_actor app_private.pvp_lobby_members%rowtype;
  v_target app_private.pvp_lobby_members%rowtype;
  v_team_size integer;
begin
  select * into v_lobby from app_private.pvp_lobbies where id = p_lobby_id for update;
  if not found or v_lobby.status <> 'waiting' then
    raise exception using errcode = '22023', message = 'PVP_LOBBY_NOT_WAITING';
  end if;

  select * into v_actor
  from app_private.pvp_lobby_members
  where lobby_id = p_lobby_id and user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'PVP_LOBBY_NOT_AVAILABLE';
  end if;

  v_team_size := case p_target_team_index
    when 0 then v_lobby.team_a_size
    when 1 then v_lobby.team_b_size
    when 2 then v_lobby.team_c_size
    else 0
  end;
  if p_target_seat_index < 0 or p_target_seat_index >= v_team_size then
    raise exception using errcode = '22023', message = 'PVP_INVALID_SEAT';
  end if;

  if v_actor.team_index = p_target_team_index and v_actor.seat_index = p_target_seat_index then
    return true;
  end if;

  select * into v_target
  from app_private.pvp_lobby_members
  where lobby_id = p_lobby_id
    and team_index = p_target_team_index
    and seat_index = p_target_seat_index
  for update;

  if found then
    update app_private.pvp_lobby_members
    set team_index = v_actor.team_index,
        seat_index = v_actor.seat_index,
        ready = false,
        updated_at = clock_timestamp()
    where lobby_id = p_lobby_id and user_id = v_target.user_id;
  end if;

  update app_private.pvp_lobby_members
  set team_index = p_target_team_index,
      seat_index = p_target_seat_index,
      ready = false,
      updated_at = clock_timestamp()
  where lobby_id = p_lobby_id and user_id = p_user_id;

  return true;
end;
$$;

create table if not exists app_private.pvp_turn_clocks (
  battle_session_id uuid primary key references app_private.battle_sessions(id) on delete cascade,
  turn_number bigint not null check (turn_number > 0),
  combatant_id text not null check (char_length(combatant_id) between 1 and 160),
  deadline_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp()
);

revoke all on table app_private.pvp_turn_clocks from public, anon, authenticated;
grant select, insert, update on table app_private.pvp_turn_clocks to service_role;

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
    return jsonb_build_object('active', false);
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
      p_battle_session_id, v_turn_number, v_combatant_id, clock_timestamp() + interval '60 seconds', clock_timestamp()
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
    'expired', clock_timestamp() >= v_clock.deadline_at
  );
end;
$$;

revoke all on function public.set_pvp_lobby_settings_v1(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.get_pvp_lobby_settings_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.move_pvp_lobby_seat_v1(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.ensure_pvp_turn_clock_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_pvp_lobby_settings_v1(uuid, uuid, text, text, text) to service_role;
grant execute on function public.get_pvp_lobby_settings_v1(uuid, uuid) to service_role;
grant execute on function public.move_pvp_lobby_seat_v1(uuid, uuid, integer, integer) to service_role;
grant execute on function public.ensure_pvp_turn_clock_v1(uuid, uuid) to service_role;

commit;
