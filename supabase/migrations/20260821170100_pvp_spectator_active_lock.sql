begin;

-- Global spectating locks apply only while the watched battle is active. Completed matches remain
-- reviewable through the spectator/chat authorization row without blocking normal gameplay.
create or replace function public.get_active_spectating_for_user_v1(
  p_user_id uuid
)
returns table (
  battle_session_id uuid,
  battle_key text,
  updated_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public, app_private
as $$
  select s.battle_session_id, l.battle_key, s.updated_at
  from app_private.pvp_active_spectating s
  join app_private.battle_sessions b on b.id = s.battle_session_id
  join app_private.pvp_lobbies l on l.battle_session_id = s.battle_session_id
  where s.user_id = p_user_id
    and b.lifecycle = 'active'
  limit 1;
$$;

-- A completed/abandoned review row must never prevent the account from watching a newer match.
-- Active spectation still remains exclusive until Stop Spectating is used.
create or replace function public.join_pvp_spectator_v1(
  p_user_id uuid,
  p_battle_key text
)
returns table (battle_session_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_battle_session_id uuid;
  v_existing uuid;
  v_existing_lifecycle text;
begin
  select l.battle_session_id
    into v_battle_session_id
  from app_private.pvp_lobbies l
  join app_private.battle_sessions b on b.id = l.battle_session_id
  where l.battle_key = p_battle_key
    and l.battle_session_id is not null
    and l.status in ('active', 'completed')
    and b.lifecycle in ('active', 'completed')
  limit 1;

  if v_battle_session_id is null then
    return;
  end if;

  if exists (
    select 1
    from app_private.battle_participants bp
    join app_private.battle_sessions b on b.id = bp.battle_session_id
    where bp.user_id = p_user_id
      and b.lifecycle = 'active'
  ) then
    raise exception 'PVP_SPECTATE_CONFLICT' using errcode = '42501';
  end if;

  select s.battle_session_id, b.lifecycle
    into v_existing, v_existing_lifecycle
  from app_private.pvp_active_spectating s
  join app_private.battle_sessions b on b.id = s.battle_session_id
  where s.user_id = p_user_id;

  if v_existing is not null and v_existing <> v_battle_session_id then
    if v_existing_lifecycle = 'active' then
      raise exception 'PVP_SPECTATE_CONFLICT' using errcode = '42501';
    end if;

    delete from app_private.pvp_battle_spectator_presence
    where battle_session_id = v_existing
      and user_id = p_user_id;

    delete from app_private.pvp_active_spectating
    where user_id = p_user_id;
  end if;

  insert into app_private.pvp_active_spectating (
    user_id,
    battle_session_id,
    started_at,
    updated_at
  ) values (
    p_user_id,
    v_battle_session_id,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (user_id) do update set
    battle_session_id = excluded.battle_session_id,
    updated_at = excluded.updated_at;

  insert into app_private.pvp_battle_spectator_presence (
    battle_session_id,
    user_id,
    joined_at,
    last_seen_at
  ) values (
    v_battle_session_id,
    p_user_id,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (battle_session_id, user_id) do update set
    last_seen_at = excluded.last_seen_at;

  return query select v_battle_session_id;
end;
$$;

revoke all on function public.get_active_spectating_for_user_v1(uuid) from public, anon, authenticated;
revoke all on function public.join_pvp_spectator_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.get_active_spectating_for_user_v1(uuid) to service_role;
grant execute on function public.join_pvp_spectator_v1(uuid, text) to service_role;

commit;
