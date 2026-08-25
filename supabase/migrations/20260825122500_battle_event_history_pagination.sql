begin;

create or replace function public.get_battle_events_v3(
  p_user_id uuid,
  p_battle_session_id uuid,
  p_limit integer default 100,
  p_before_battle_version bigint default null,
  p_before_event_index integer default null
)
returns table (
  battle_version bigint,
  event_index integer,
  event jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, app_private
as $$
  select
    e.battle_version,
    e.event_index,
    e.event,
    e.created_at
  from app_private.battle_events e
  where e.battle_session_id = p_battle_session_id
    and exists (
      select 1
      from app_private.battle_participants p
      where p.battle_session_id = p_battle_session_id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    )
    and (
      (p_before_battle_version is null and p_before_event_index is null)
      or (
        p_before_battle_version is not null
        and p_before_event_index is not null
        and (
          e.battle_version < p_before_battle_version
          or (
            e.battle_version = p_before_battle_version
            and e.event_index < p_before_event_index
          )
        )
      )
    )
  order by e.battle_version desc, e.event_index desc
  limit greatest(1, least(coalesce(p_limit, 100), 100));
$$;

comment on function public.get_battle_events_v3(uuid, uuid, integer, bigint, integer) is
  'Service-role-only participant-scoped keyset page read of persisted battle events for complete Battle Log history.';

revoke all on function public.get_battle_events_v3(uuid, uuid, integer, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.get_battle_events_v3(uuid, uuid, integer, bigint, integer)
  to service_role;

commit;
