begin;

-- CSR-3 historical privacy authority remains server-only. The browser-facing event payload
-- stays unchanged; this RPC exposes only the persisted viewer relationship inputs and private
-- journal rows needed by the server to project complete history before presentation.
create or replace function public.get_battle_history_privacy_v1(
  p_user_id uuid,
  p_battle_session_id uuid,
  p_battle_versions bigint[]
)
returns table (
  viewer_kind text,
  controlled_combatant_ids text[],
  snapshot jsonb,
  journals jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_is_participant boolean;
  v_is_spectator boolean;
  v_snapshot jsonb;
  v_controlled_combatant_ids text[] := array[]::text[];
  v_versions bigint[] := coalesce(p_battle_versions, array[]::bigint[]);
begin
  if p_user_id is null or p_battle_session_id is null then
    raise exception using errcode = '22023', message = 'BATTLE_HISTORY_PRIVACY_INVALID';
  end if;

  if exists (
    select 1
    from unnest(v_versions) version_value
    where version_value is null or version_value < 1
  ) then
    raise exception using errcode = '22023', message = 'BATTLE_HISTORY_PRIVACY_INVALID';
  end if;

  select battle.current_snapshot
  into v_snapshot
  from app_private.battle_sessions battle
  where battle.id = p_battle_session_id;

  if not found then
    raise exception using errcode = '42501', message = 'BATTLE_NOT_AVAILABLE';
  end if;

  select exists (
    select 1
    from app_private.battle_participants participant
    where participant.battle_session_id = p_battle_session_id
      and participant.user_id = p_user_id
  ) into v_is_participant;

  select exists (
    select 1
    from app_private.pvp_active_spectating spectator
    where spectator.battle_session_id = p_battle_session_id
      and spectator.user_id = p_user_id
  ) into v_is_spectator;

  if not v_is_participant and not v_is_spectator then
    raise exception using errcode = '42501', message = 'BATTLE_NOT_AVAILABLE';
  end if;

  if v_is_participant then
    select coalesce(
      array_agg(participant.combatant_id order by participant.combatant_id),
      array[]::text[]
    )
    into v_controlled_combatant_ids
    from app_private.battle_participants participant
    where participant.battle_session_id = p_battle_session_id
      and participant.user_id = p_user_id;
  end if;

  return query
  select
    case when v_is_participant then 'participant' else 'spectator' end,
    v_controlled_combatant_ids,
    v_snapshot,
    coalesce(
      (
        select jsonb_agg(
          journal.journal || jsonb_build_object('battleVersion', journal.battle_version)
          order by journal.battle_version
        )
        from app_private.battle_privacy_journal journal
        where journal.battle_session_id = p_battle_session_id
          and journal.battle_version = any(v_versions)
      ),
      '[]'::jsonb
    );
end;
$$;

comment on function public.get_battle_history_privacy_v1(uuid, uuid, bigint[]) is
  'Service-role-only CSR-3 authority returning persisted viewer inputs plus private journal rows for requested battle versions. Missing journal rows remain legacy/public history.';

revoke all on function public.get_battle_history_privacy_v1(uuid, uuid, bigint[])
  from public, anon, authenticated;
grant execute on function public.get_battle_history_privacy_v1(uuid, uuid, bigint[])
  to service_role;

-- Preserve the generic event RPC shape while allowing the same active PvP spectators that the
-- dedicated PvP event RPC already authorizes. History privacy still happens server-side after
-- complete raw pagination, using the private authority above.
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

  if not (
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
  'Service-role-only participant-or-active-spectator keyset page of persisted battle events. Browser payload shape is unchanged; CSR-3 privacy projection occurs server-side.';

revoke all on function public.get_battle_events_v3(uuid, uuid, integer, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.get_battle_events_v3(uuid, uuid, integer, bigint, integer)
  to service_role;

commit;
