begin;

alter table app_private.pvp_lobby_members
  add column if not exists seated boolean not null default true;

alter table app_private.pvp_lobby_members
  drop constraint if exists pvp_lobby_members_ready_requires_seat;
alter table app_private.pvp_lobby_members
  add constraint pvp_lobby_members_ready_requires_seat check (not ready or seated);

alter table app_private.pvp_lobby_members
  drop constraint if exists pvp_lobby_members_lobby_id_team_index_seat_index_key;

drop index if exists app_private.pvp_lobby_members_active_seat_key;
create unique index pvp_lobby_members_active_seat_key
  on app_private.pvp_lobby_members (lobby_id, team_index, seat_index)
  where seated;

create or replace function public.set_pvp_lobby_ready_v1(
  p_user_id uuid,
  p_lobby_id uuid,
  p_ready boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
begin
  if not exists (
    select 1
    from app_private.pvp_lobbies l
    join app_private.pvp_lobby_members m on m.lobby_id = l.id
    where l.id = p_lobby_id
      and l.status = 'waiting'
      and m.user_id = p_user_id
      and m.seated
  ) then
    raise exception using errcode = '42501', message = 'PVP_LOBBY_NOT_AVAILABLE';
  end if;

  update app_private.pvp_lobby_members
  set ready = p_ready
  where lobby_id = p_lobby_id and user_id = p_user_id and seated;
  update app_private.pvp_lobbies set updated_at = clock_timestamp() where id = p_lobby_id;
end;
$$;

create or replace function public.get_pvp_lobby_v1(
  p_user_id uuid,
  p_lobby_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
stable
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from app_private.pvp_lobby_members
    where lobby_id = p_lobby_id and user_id = p_user_id
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'lobby_id', l.id,
    'lobby_key', l.lobby_key,
    'mode', l.mode,
    'owner_user_id', l.owner_user_id,
    'team_a_size', l.team_a_size,
    'team_b_size', l.team_b_size,
    'team_c_size', l.team_c_size,
    'status', l.status,
    'battle_session_id', l.battle_session_id,
    'battle_key', l.battle_key,
    'ready_to_start', (
      l.status = 'waiting'
      and (select count(*) from app_private.pvp_lobby_members m where m.lobby_id = l.id)
        = l.team_a_size + l.team_b_size + l.team_c_size
      and not exists (
        select 1 from app_private.pvp_lobby_members m
        where m.lobby_id = l.id and (not m.seated or not m.ready)
      )
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'character_id', m.character_id,
        'character_name', c.name,
        'character_level', c.level,
        'portrait_ref', c.portrait_ref,
        'team_index', m.team_index,
        'seat_index', m.seat_index,
        'seated', m.seated,
        'ready', m.ready,
        'is_host', m.user_id = l.owner_user_id
      ) order by m.seated desc, m.team_index, m.seat_index, m.joined_at)
      from app_private.pvp_lobby_members m
      join public.characters c on c.id = m.character_id
      where m.lobby_id = l.id
    ), '[]'::jsonb)
  ) into v_result
  from app_private.pvp_lobbies l
  where l.id = p_lobby_id;

  return v_result;
end;
$$;

create or replace function public.move_pvp_lobby_seat_v2(
  p_user_id uuid,
  p_lobby_id uuid,
  p_target_team_index integer default null,
  p_target_seat_index integer default null
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
  select * into v_lobby
  from app_private.pvp_lobbies
  where id = p_lobby_id
  for update;
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

  if p_target_team_index is null and p_target_seat_index is null then
    if not v_actor.seated then return true; end if;

    update app_private.pvp_lobby_members
    set seated = false, ready = false
    where lobby_id = p_lobby_id and user_id = p_user_id;
    update app_private.pvp_lobby_members set ready = false where lobby_id = p_lobby_id;
    update app_private.pvp_lobbies set updated_at = clock_timestamp() where id = p_lobby_id;
    return true;
  end if;

  if p_target_team_index is null or p_target_seat_index is null then
    raise exception using errcode = '22023', message = 'PVP_INVALID_SEAT';
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

  if v_actor.seated
    and v_actor.team_index = p_target_team_index
    and v_actor.seat_index = p_target_seat_index then
    return true;
  end if;

  select * into v_target
  from app_private.pvp_lobby_members
  where lobby_id = p_lobby_id
    and team_index = p_target_team_index
    and seat_index = p_target_seat_index
    and seated
  for update;

  if found then
    if not v_actor.seated then
      raise exception using errcode = '22023', message = 'PVP_SEAT_OCCUPIED';
    end if;

    update app_private.pvp_lobby_members
    set team_index = v_actor.team_index,
        seat_index = v_actor.seat_index,
        seated = true,
        ready = false
    where lobby_id = p_lobby_id and user_id = v_target.user_id;
  end if;

  update app_private.pvp_lobby_members
  set team_index = p_target_team_index,
      seat_index = p_target_seat_index,
      seated = true,
      ready = false
  where lobby_id = p_lobby_id and user_id = p_user_id;

  update app_private.pvp_lobby_members set ready = false where lobby_id = p_lobby_id;
  update app_private.pvp_lobbies set updated_at = clock_timestamp() where id = p_lobby_id;
  return true;
end;
$$;

revoke all on function public.move_pvp_lobby_seat_v2(uuid, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.move_pvp_lobby_seat_v2(uuid, uuid, integer, integer)
  to service_role;

commit;
