create or replace function public.list_pvp_spectators_v1(
  p_user_id uuid,
  p_battle_session_id uuid
)
returns table (
  user_id uuid,
  spectator_name text,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_authorized boolean;
begin
  delete from app_private.pvp_battle_spectators
  where last_seen_at < now() - interval '45 seconds';

  select (
    exists (
      select 1
      from app_private.battle_participants bp
      where bp.battle_session_id = p_battle_session_id
        and bp.user_id = p_user_id
    )
    or exists (
      select 1
      from app_private.pvp_battle_spectators s
      where s.battle_session_id = p_battle_session_id
        and s.user_id = p_user_id
        and s.last_seen_at >= now() - interval '45 seconds'
    )
  ) into v_authorized;

  if not v_authorized then
    raise exception 'PVP_BATTLE_FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    s.user_id,
    coalesce(character_name.name, 'Spectator') as spectator_name,
    s.last_seen_at
  from app_private.pvp_battle_spectators s
  left join lateral (
    select c.name
    from public.characters c
    where c.user_id = s.user_id
    order by c.last_active_at desc nulls last, c.created_at desc
    limit 1
  ) character_name on true
  where s.battle_session_id = p_battle_session_id
    and s.last_seen_at >= now() - interval '45 seconds'
  order by s.joined_at asc, s.user_id asc;
end;
$$;

revoke all on function public.list_pvp_spectators_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_pvp_spectators_v1(uuid, uuid) to service_role;
