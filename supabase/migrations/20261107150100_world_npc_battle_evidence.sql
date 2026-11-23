begin;

-- Only sessions admitted from a published World NPC can acquire either receipt.
-- Start recording at installation; do not reconstruct past quest credit from old logs.
-- Event IDs are durable references by value so later log retention cannot remove evidence.
create table app_private.world_npc_terminal_receipts (
  battle_session_id uuid primary key references app_private.world_npc_battles(battle_session_id) on delete cascade,
  battle_version bigint not null check (battle_version>0),
  outcome text not null check (outcome in ('victory','defeat','draw','surrender','timeout','no-contest','abandoned','unresolved')),
  result_event_id uuid unique,
  cause_event_id uuid,
  occurred_at timestamptz not null,
  check ((outcome='abandoned')=(result_event_id is null)),
  check ((outcome in ('surrender','timeout'))=(cause_event_id is not null))
);
create table app_private.world_npc_defeat_evidence (
  battle_session_id uuid not null references app_private.world_npc_terminal_receipts(battle_session_id) on delete cascade,
  opponent_combatant_id text not null,
  damage_event_id uuid not null unique,
  occurred_at timestamptz not null,
  primary key (battle_session_id,opponent_combatant_id)
);
alter table app_private.world_npc_terminal_receipts enable row level security;
alter table app_private.world_npc_defeat_evidence enable row level security;
revoke all on app_private.world_npc_terminal_receipts,app_private.world_npc_defeat_evidence
  from public,anon,authenticated,service_role;

create function app_private.record_world_npc_battle_evidence_v1()
returns trigger language plpgsql set search_path='' as $$
declare terminal record;
declare cause record;
declare final_outcome text;
declare winner text;
declare units jsonb;
declare starting_units jsonb;
declare player_id text;
declare player_team text;
declare opponent_team text;
declare player_unit jsonb;
declare opponent_unit jsonb;
declare living_teams text[];
declare valid_units boolean;
begin
  -- A command writes the whole engine event batch at once. A statement trigger
  -- sees surrender/timeout markers regardless of their order within that batch.
  for terminal in
    select distinct on (e.battle_session_id) e.*, admission.character_id,
      admission.opponent_combatant_id, battle.lifecycle, snapshot.snapshot, initial.snapshot initial_snapshot
    from committed_events e
    join app_private.world_npc_battles admission using(battle_session_id)
    join app_private.battle_sessions battle on battle.id=e.battle_session_id
      and battle.current_version=e.battle_version
    join app_private.battle_snapshots snapshot on snapshot.battle_session_id=e.battle_session_id
      and snapshot.battle_version=e.battle_version
    join app_private.battle_snapshots initial on initial.battle_session_id=e.battle_session_id
      and initial.battle_version=1
    where (battle.lifecycle='completed' and e.event->>'event'='battle_completed')
      or (battle.lifecycle='abandoned' and e.event->>'event'='administrative_no_contest'
        and snapshot.snapshot->>'administrativeOutcome'='NoContest'
        and snapshot.snapshot->>'rewardOutcome'='NoRewards'
        and exists (select 1 from app_private.battle_no_contests recovery
          where recovery.battle_session_id=e.battle_session_id and recovery.terminal_version=e.battle_version))
    order by e.battle_session_id,e.event_index
  loop
    select e.event_id,e.event->>'event' kind,e.event->>'combatantId' combatant_id into cause
    from committed_events e where e.battle_session_id=terminal.battle_session_id
      and e.battle_version=terminal.battle_version
      and e.event->>'event' in ('ai_combatant_surrendered','pvp_combatant_surrendered','ai_turn_timed_out','pvp_turn_timed_out')
    order by (e.event->>'event' in ('ai_combatant_surrendered','pvp_combatant_surrendered')) desc,e.event_index
    limit 1;

    player_id := 'character:'||terminal.character_id::text;
    if terminal.lifecycle='abandoned' then
      final_outcome := 'no-contest';
    elsif cause.kind is not null and not coalesce(
      cause.combatant_id in (player_id,terminal.opponent_combatant_id)
      -- AI surrender concedes the whole player team. A downed player has no
      -- surrender marker of their own when their surviving summon concedes.
      or (cause.kind='ai_combatant_surrendered' and exists (
        select 1 from app_private.battle_snapshots prior
        cross join lateral jsonb_array_elements(prior.snapshot#>'{tactical,battle,combatants}') actor
        cross join lateral jsonb_array_elements(prior.snapshot#>'{tactical,battle,combatants}') player
        where prior.battle_session_id=terminal.battle_session_id
          and prior.battle_version=terminal.battle_version-1
          and prior.snapshot#>>'{tactical,battle,lifecycle}'='active'
          and actor->>'id'=cause.combatant_id and actor->>'kind'='summon'
          and case when jsonb_typeof(actor->'hp')='number' then (actor->>'hp')::numeric>0 else false end
          and player->>'id'=player_id and player->'hp'='0'::jsonb
          and actor->>'teamId'=player->>'teamId'
          and prior.snapshot#>'{effectState,summons}' @> jsonb_build_array(jsonb_build_object(
            'combatantId',cause.combatant_id,'ownerCombatantId',player_id))
      )),false
    ) then
      final_outcome := 'unresolved';
    elsif cause.kind in ('ai_combatant_surrendered','pvp_combatant_surrendered') then
      final_outcome := 'surrender';
    elsif cause.kind in ('ai_turn_timed_out','pvp_turn_timed_out') then
      final_outcome := 'timeout';
    else
      final_outcome := 'unresolved';
      units := terminal.snapshot#>'{tactical,battle,combatants}';
      starting_units := terminal.initial_snapshot#>'{tactical,battle,combatants}';
      -- The final event and HP can explain the outcome only for the original sides.
      -- Version-one startup commits already require the same roster and teams as admission.
      if jsonb_typeof(units)='array' and jsonb_typeof(starting_units)='array'
        and terminal.snapshot#>'{tactical,battle,currentTurn}'='null'::jsonb
        and terminal.snapshot->>'worldBattleOrigin'='npc'
        and terminal.snapshot->'arenaNpc'=terminal.initial_snapshot->'arenaNpc'
        and not exists (
          select 1 from committed_events e
          where e.battle_session_id=terminal.battle_session_id and e.battle_version=terminal.battle_version
            and e.event->>'event'='battle_completed'
            and (e.event->'winningTeamId') is distinct from (terminal.event->'winningTeamId')
        ) then
        winner := terminal.event->>'winningTeamId';
        select min(u->>'teamId') into player_team from jsonb_array_elements(starting_units) u
          where u->>'id'=player_id having count(*)=1;
        select min(u->>'teamId') into opponent_team from jsonb_array_elements(starting_units) u
          where u->>'id'=terminal.opponent_combatant_id having count(*)=1;
        select count(*)=count(distinct u->>'id') and coalesce(bool_and(coalesce(
            jsonb_typeof(u->'id')='string' and u->>'id'<>''
            and jsonb_typeof(u->'teamId')='string' and u->>'teamId' in (player_team,opponent_team)
            and case when jsonb_typeof(u->'hp')='number' then (u->>'hp')::numeric>=0 else false end,
          false)),false),
          array(select distinct alive->>'teamId' from jsonb_array_elements(units) alive
            where case when jsonb_typeof(alive->'hp')='number' then (alive->>'hp')::numeric>0 else false end)
          into valid_units,living_teams from jsonb_array_elements(units) u;
        select u into player_unit from jsonb_array_elements(units) u where u->>'id'=player_id;
        select u into opponent_unit from jsonb_array_elements(units) u where u->>'id'=terminal.opponent_combatant_id;
        if valid_units and player_team<>opponent_team and player_unit->>'teamId'=player_team
          and opponent_unit->>'teamId'=opponent_team then
          if terminal.event->'winningTeamId'='null'::jsonb and cardinality(living_teams)=0
            and player_unit->'hp'='0'::jsonb and opponent_unit->'hp'='0'::jsonb then
            final_outcome := 'draw';
          elsif winner is not null and living_teams=array[winner] then
            if winner=player_team and opponent_unit->'hp'='0'::jsonb then
              final_outcome := 'victory';
            elsif winner=opponent_team and player_unit->'hp'='0'::jsonb then
              final_outcome := 'defeat';
            end if;
          end if;
        end if;
      end if;
    end if;

    insert into app_private.world_npc_terminal_receipts(battle_session_id,battle_version,outcome,
      result_event_id,cause_event_id,occurred_at)
    values(terminal.battle_session_id,terminal.battle_version,final_outcome,terminal.event_id,
      case when final_outcome in ('surrender','timeout') then cause.event_id end,terminal.created_at)
    on conflict (battle_session_id) do nothing;

    -- The first evidence version supports exact player-sourced lethal damage to the
    -- admitted opponent in the terminal winning command, linked to the player's
    -- resolved action. Periodic ticks and reactions do not supply that evidence.
    if found and final_outcome='victory' then
      insert into app_private.world_npc_defeat_evidence(battle_session_id,opponent_combatant_id,damage_event_id,occurred_at)
      select terminal.battle_session_id,terminal.opponent_combatant_id,damage.event_id,damage.created_at
      from (
        select e.event_id,e.event,e.created_at,e.event_index from committed_events e
        where e.battle_session_id=terminal.battle_session_id and e.battle_version=terminal.battle_version
          and e.event->>'event'='damage_applied' and e.event->>'targetCombatantId'=terminal.opponent_combatant_id
          and e.event->'hpAfter'='0'::jsonb
          and case when jsonb_typeof(e.event->'hpBefore')='number' and jsonb_typeof(e.event->'amount')='number'
            then (e.event->>'hpBefore')::numeric>0 and (e.event->>'amount')::numeric=(e.event->>'hpBefore')::numeric
            else false end
        order by e.event_index desc limit 1
      ) damage where damage.event->>'sourceCombatantId'=player_id
        and not (damage.event ? 'damageTrigger' or damage.event ? 'statusId')
        and exists (
          select 1 from committed_events action
          where action.battle_session_id=terminal.battle_session_id and action.battle_version=terminal.battle_version
            and action.event_index<damage.event_index and action.event->>'event'='combat_action_used'
            and action.event->>'actorId'=player_id and action.event->>'actionId'=damage.event->>'actionId'
        )
      on conflict (battle_session_id,opponent_combatant_id) do nothing;
    end if;
  end loop;
  return null;
end; $$;

create trigger record_world_npc_battle_evidence_v1 after insert on app_private.battle_events
  referencing new table as committed_events for each statement
  execute function app_private.record_world_npc_battle_evidence_v1();

-- Account/battle replacement can abandon an active battle without an engine event.
-- Owner No Contest writes its separate canonical event after changing the head.
create function app_private.record_world_npc_battle_abandoned_v1()
returns trigger language plpgsql set search_path='' as $$
begin
  insert into app_private.world_npc_terminal_receipts(battle_session_id,battle_version,outcome,occurred_at)
  select a.battle_session_id,new.current_version,'abandoned',new.updated_at
  from app_private.world_npc_battles a where a.battle_session_id=new.id
    and not exists (select 1 from app_private.battle_no_contests recovery
      where recovery.battle_session_id=new.id and recovery.terminal_version=new.current_version)
  on conflict (battle_session_id) do nothing;
  return new;
end; $$;

create trigger record_world_npc_battle_abandoned_v1 after update of lifecycle on app_private.battle_sessions
  for each row when (old.lifecycle is distinct from new.lifecycle and new.lifecycle='abandoned')
  execute function app_private.record_world_npc_battle_abandoned_v1();

revoke all on function app_private.record_world_npc_battle_evidence_v1(),
  app_private.record_world_npc_battle_abandoned_v1() from public,anon,authenticated,service_role;
commit;
