begin;

drop function if exists public.get_battle_session_v1(uuid, uuid);

create function public.get_battle_session_v1(
  p_user_id uuid,
  p_battle_session_id uuid
)
returns table (
  battle_session_id uuid,
  battle_id text,
  battle_version bigint,
  rules_version integer,
  content_version integer,
  lifecycle text,
  snapshot jsonb,
  controlled_combatant_ids text[],
  updated_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, app_private
stable
as $$
  select
    s.id,
    s.battle_id,
    s.current_version,
    s.rules_version,
    s.content_version,
    s.lifecycle,
    s.current_snapshot,
    array(
      select p.combatant_id
      from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
      order by p.combatant_id
    ),
    s.updated_at
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and s.owner_user_id = p_user_id
    and exists (
      select 1
      from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    );
$$;

comment on function public.get_battle_session_v1(uuid, uuid) is
  'Returns the latest reconnect-safe battle snapshot plus explicit player-controlled combatant identities to the server authority boundary.';

revoke all on function public.get_battle_session_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_battle_session_v1(uuid, uuid) to service_role;

commit;
