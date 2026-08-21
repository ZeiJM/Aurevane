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

revoke all on function public.get_active_spectating_for_user_v1(uuid) from public, anon, authenticated;
grant execute on function public.get_active_spectating_for_user_v1(uuid) to service_role;

commit;
