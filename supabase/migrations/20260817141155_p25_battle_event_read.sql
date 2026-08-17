begin;

create or replace function public.get_battle_events_v1(
  p_user_id uuid,
  p_battle_session_id uuid,
  p_limit integer default 50
)
returns table (
  battle_version bigint,
  event_index integer,
  event jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, app_private, public
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'BATTLE_EVENT_LIMIT_INVALID';
  end if;

  if not exists (
    select 1
    from app_private.battle_sessions session
    where session.id = p_battle_session_id
      and session.owner_user_id = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'BATTLE_NOT_AVAILABLE';
  end if;

  return query
  select
    battle_event.battle_version,
    battle_event.event_index,
    battle_event.event,
    battle_event.created_at
  from app_private.battle_events battle_event
  where battle_event.battle_session_id = p_battle_session_id
  order by battle_event.battle_version desc, battle_event.event_index desc
  limit p_limit;
end;
$$;

comment on function public.get_battle_events_v1(uuid, uuid, integer) is
  'Service-role-only owner-scoped read of persisted battle events for server-side P2.5 log projection.';

revoke all on function public.get_battle_events_v1(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_battle_events_v1(uuid, uuid, integer)
  to service_role;

commit;
