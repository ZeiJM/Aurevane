begin;

-- The function returns a column named battle_session_id. In PL/pgSQL that output variable can
-- conflict with an unqualified ON CONFLICT column reference of the same name at runtime. Target
-- the presence table's primary-key constraint explicitly so valid spectator joins cannot fail with
-- SQLSTATE 42702. Keep the existing active-battle and active-spectation exclusivity rules intact.
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
  where l.battle_key = upper(trim(p_battle_key))
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

    delete from app_private.pvp_battle_spectator_presence as old_presence
    where old_presence.battle_session_id = v_existing
      and old_presence.user_id = p_user_id;

    delete from app_private.pvp_active_spectating as old_spectating
    where old_spectating.user_id = p_user_id;
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
  on conflict on constraint pvp_battle_spectator_presence_pkey do update set
    last_seen_at = excluded.last_seen_at;

  return query select v_battle_session_id;
end;
$$;

revoke all on function public.join_pvp_spectator_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.join_pvp_spectator_v1(uuid, text) to service_role;

commit;
