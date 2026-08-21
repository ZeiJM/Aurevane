begin;

create table if not exists app_private.ai_turn_clocks (
  battle_session_id uuid primary key references app_private.battle_sessions(id) on delete cascade,
  turn_number bigint not null check (turn_number > 0),
  combatant_id text not null check (char_length(combatant_id) between 1 and 160),
  deadline_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp()
);

revoke all on table app_private.ai_turn_clocks from public, anon, authenticated;
grant select, insert, update, delete on table app_private.ai_turn_clocks to service_role;

create or replace function public.ensure_ai_turn_clock_v1(
  p_user_id uuid,
  p_battle_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_session app_private.battle_sessions%rowtype;
  v_turn_number bigint;
  v_combatant_id text;
  v_clock app_private.ai_turn_clocks%rowtype;
begin
  select s.* into v_session
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and not exists (
      select 1 from app_private.pvp_lobbies l where l.battle_session_id = s.id
    )
    and exists (
      select 1 from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    )
  for update;

  if not found then return null; end if;
  if v_session.lifecycle <> 'active' then
    delete from app_private.ai_turn_clocks where battle_session_id = p_battle_session_id;
    return jsonb_build_object('active', false);
  end if;

  v_turn_number := (v_session.current_snapshot #>> '{tactical,battle,turnNumber}')::bigint;
  v_combatant_id := v_session.current_snapshot #>> '{tactical,battle,currentTurn,combatantId}';
  if v_turn_number is null or v_combatant_id is null then
    raise exception using errcode = '22023', message = 'AI_INVALID_TURN_CLOCK_STATE';
  end if;

  -- Only human-controlled turns receive the 60-second clock. Recruit AI turns resolve immediately.
  if not exists (
    select 1 from app_private.battle_participants p
    where p.battle_session_id = p_battle_session_id
      and p.user_id = p_user_id
      and p.participant_role = 'player'
      and p.combatant_id = v_combatant_id
  ) then
    delete from app_private.ai_turn_clocks where battle_session_id = p_battle_session_id;
    return jsonb_build_object('active', false);
  end if;

  select * into v_clock
  from app_private.ai_turn_clocks
  where battle_session_id = p_battle_session_id
  for update;

  if not found or v_clock.turn_number <> v_turn_number or v_clock.combatant_id <> v_combatant_id then
    insert into app_private.ai_turn_clocks (
      battle_session_id, turn_number, combatant_id, deadline_at, updated_at
    ) values (
      p_battle_session_id,
      v_turn_number,
      v_combatant_id,
      clock_timestamp() + interval '60 seconds',
      clock_timestamp()
    )
    on conflict (battle_session_id) do update
    set turn_number = excluded.turn_number,
        combatant_id = excluded.combatant_id,
        deadline_at = excluded.deadline_at,
        updated_at = excluded.updated_at
    returning * into v_clock;
  end if;

  return jsonb_build_object(
    'active', true,
    'turn_number', v_clock.turn_number,
    'combatant_id', v_clock.combatant_id,
    'deadline_at', v_clock.deadline_at,
    'expired', clock_timestamp() >= v_clock.deadline_at
  );
end;
$$;

create or replace function public.get_ai_timeout_context_v1(
  p_user_id uuid,
  p_battle_session_id uuid,
  p_combatant_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private
stable
as $$
declare
  v_last_timeout_version bigint;
  v_activity_after boolean := false;
begin
  if not exists (
    select 1
    from app_private.battle_participants p
    where p.battle_session_id = p_battle_session_id
      and p.user_id = p_user_id
      and p.participant_role = 'player'
      and p.combatant_id = p_combatant_id
  ) then
    return null;
  end if;

  select max(e.battle_version)
  into v_last_timeout_version
  from app_private.battle_events e
  where e.battle_session_id = p_battle_session_id
    and e.event ->> 'event' = 'ai_turn_timed_out'
    and e.event ->> 'combatantId' = p_combatant_id;

  if v_last_timeout_version is not null then
    select exists (
      select 1
      from app_private.battle_events e
      where e.battle_session_id = p_battle_session_id
        and e.battle_version > v_last_timeout_version
        and (
          (e.event ->> 'event' = 'combat_action_used' and e.event ->> 'actorId' = p_combatant_id)
          or (e.event ->> 'event' = 'combatant_moved' and e.event ->> 'combatantId' = p_combatant_id)
          or (e.event ->> 'event' = 'final_facing_selected' and e.event ->> 'combatantId' = p_combatant_id)
        )
    ) into v_activity_after;
  end if;

  return jsonb_build_object(
    'previous_turn_missed', v_last_timeout_version is not null and not v_activity_after,
    'last_timeout_version', v_last_timeout_version
  );
end;
$$;

revoke all on function public.ensure_ai_turn_clock_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_ai_timeout_context_v1(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ensure_ai_turn_clock_v1(uuid, uuid) to service_role;
grant execute on function public.get_ai_timeout_context_v1(uuid, uuid, text) to service_role;

commit;
