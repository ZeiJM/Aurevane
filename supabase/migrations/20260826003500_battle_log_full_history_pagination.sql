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
language plpgsql
stable
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 100));
begin
  if (p_before_battle_version is null) <> (p_before_event_index is null)
    or coalesce(p_before_battle_version, 1) < 1
    or coalesce(p_before_event_index, 0) < 0 then
    raise exception using errcode = '22023', message = 'BATTLE_EVENT_CURSOR_INVALID';
  end if;

  if not exists (
    select 1
    from app_private.battle_participants participant
    where participant.battle_session_id = p_battle_session_id
      and participant.user_id = p_user_id
      and participant.participant_role = 'player'
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
    and (
      p_before_battle_version is null
      or battle_event.battle_version < p_before_battle_version
      or (
        battle_event.battle_version = p_before_battle_version
        and battle_event.event_index < p_before_event_index
      )
    )
  order by battle_event.battle_version desc, battle_event.event_index desc
  limit v_limit;
end;
$$;

comment on function public.get_battle_events_v3(uuid, uuid, integer, bigint, integer) is
  'Service-role-only participant-scoped keyset page of persisted battle events for complete sanitized battle-log history.';

revoke all on function public.get_battle_events_v3(uuid, uuid, integer, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.get_battle_events_v3(uuid, uuid, integer, bigint, integer)
  to service_role;

create or replace function public.list_pvp_battle_events_v2(
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
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_authorized boolean;
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 100));
begin
  if (p_before_battle_version is null) <> (p_before_event_index is null)
    or coalesce(p_before_battle_version, 1) < 1
    or coalesce(p_before_event_index, 0) < 0 then
    raise exception using errcode = '22023', message = 'BATTLE_EVENT_CURSOR_INVALID';
  end if;

  select (
    exists (
      select 1
      from app_private.battle_participants participant
      where participant.battle_session_id = p_battle_session_id
        and participant.user_id = p_user_id
    )
    or exists (
      select 1
      from app_private.pvp_active_spectating spectator
      where spectator.battle_session_id = p_battle_session_id
        and spectator.user_id = p_user_id
    )
  ) into v_authorized;

  if not v_authorized then
    raise exception 'PVP_BATTLE_FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    battle_event.battle_version,
    battle_event.event_index,
    battle_event.event,
    battle_event.created_at
  from app_private.battle_events battle_event
  where battle_event.battle_session_id = p_battle_session_id
    and (
      p_before_battle_version is null
      or battle_event.battle_version < p_before_battle_version
      or (
        battle_event.battle_version = p_before_battle_version
        and battle_event.event_index < p_before_event_index
      )
    )
  order by battle_event.battle_version desc, battle_event.event_index desc
  limit v_limit;
end;
$$;

comment on function public.list_pvp_battle_events_v2(uuid, uuid, integer, bigint, integer) is
  'Service-role-only participant-or-active-spectator keyset page of persisted PvP battle events for complete sanitized history.';

revoke all on function public.list_pvp_battle_events_v2(uuid, uuid, integer, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.list_pvp_battle_events_v2(uuid, uuid, integer, bigint, integer)
  to service_role;

commit;
