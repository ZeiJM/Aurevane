begin;

-- Existing medium/large keys and recorded battle snapshots remain valid. New boards use
-- the AI-aligned 9×7, 12×7 and 15×7 profiles in the authoritative battle constructor.
alter table app_private.pvp_lobby_settings
  drop constraint if exists pvp_lobby_settings_map_size_check;
alter table app_private.pvp_lobby_settings
  add constraint pvp_lobby_settings_map_size_check
  check (map_size in ('small', 'medium', 'large'));

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
    or p_map_size not in ('small', 'medium', 'large')
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

revoke all on function public.set_pvp_lobby_settings_v2(uuid, uuid, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.set_pvp_lobby_settings_v2(uuid, uuid, text, text, text, integer)
  to service_role;

commit;
