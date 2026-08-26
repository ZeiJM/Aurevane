begin;

-- Joining changes lobby membership, but it does not invalidate the explicit Ready
-- choice of players who were already seated. The newly joined player still starts
-- unready, so the lobby cannot start until that player explicitly readies up.
-- Deliberately do not blanket-reset existing members after the insert below.
create or replace function public.join_pvp_lobby_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_lobby_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
as $$
declare
  v_lobby app_private.pvp_lobbies%rowtype;
  v_existing app_private.pvp_lobby_members%rowtype;
  v_team integer;
  v_seat integer;
  v_capacity integer;
begin
  if not exists (
    select 1 from public.characters c
    where c.id = p_character_id and c.user_id = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'PVP_CHARACTER_NOT_OWNED';
  end if;

  select * into v_lobby
  from app_private.pvp_lobbies
  where lobby_key = upper(trim(p_lobby_key))
  for update;

  if not found or v_lobby.status <> 'waiting' then
    raise exception using errcode = '22023', message = 'PVP_LOBBY_NOT_AVAILABLE';
  end if;

  select * into v_existing
  from app_private.pvp_lobby_members
  where lobby_id = v_lobby.id and user_id = p_user_id;

  if found then
    if v_existing.character_id <> p_character_id then
      raise exception using errcode = '22023', message = 'PVP_ALREADY_IN_LOBBY';
    end if;
    return v_lobby.id;
  end if;

  select candidate.team_index into v_team
  from (
    select
      teams.team_index,
      teams.capacity,
      count(m.user_id)::integer as occupied
    from (
      values
        (0, v_lobby.team_a_size::integer),
        (1, v_lobby.team_b_size::integer),
        (2, v_lobby.team_c_size::integer)
    ) as teams(team_index, capacity)
    left join app_private.pvp_lobby_members m
      on m.lobby_id = v_lobby.id and m.team_index = teams.team_index
    where teams.capacity > 0
    group by teams.team_index, teams.capacity
  ) candidate
  where candidate.occupied < candidate.capacity
  order by candidate.occupied::numeric / candidate.capacity, candidate.team_index
  limit 1;

  if v_team is null then
    raise exception using errcode = '22023', message = 'PVP_LOBBY_FULL';
  end if;

  v_capacity := case v_team
    when 0 then v_lobby.team_a_size
    when 1 then v_lobby.team_b_size
    else v_lobby.team_c_size
  end;

  select seat into v_seat
  from generate_series(0, v_capacity - 1) as seat
  where not exists (
    select 1 from app_private.pvp_lobby_members m
    where m.lobby_id = v_lobby.id and m.team_index = v_team and m.seat_index = seat
  )
  order by seat
  limit 1;

  if v_seat is null then
    raise exception using errcode = '22023', message = 'PVP_LOBBY_FULL';
  end if;

  insert into app_private.pvp_lobby_members (
    lobby_id, user_id, character_id, team_index, seat_index, ready
  ) values (v_lobby.id, p_user_id, p_character_id, v_team, v_seat, false);

  update app_private.pvp_lobbies set updated_at = clock_timestamp() where id = v_lobby.id;
  return v_lobby.id;
end;
$$;

commit;
