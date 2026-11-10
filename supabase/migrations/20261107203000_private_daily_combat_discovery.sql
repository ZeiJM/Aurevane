begin;

-- Qualify by the canonical terminal instant. Keep the character on its private
-- receipt to index only that character's wins in the relevant calendar window.
alter table app_private.world_npc_terminal_receipts add column character_id uuid;
update app_private.world_npc_terminal_receipts receipt set character_id = battle.character_id
from app_private.world_npc_battles battle where battle.battle_session_id = receipt.battle_session_id;
alter table app_private.world_npc_terminal_receipts alter column character_id set not null;
create index world_npc_terminal_character_victory_idx
  on app_private.world_npc_terminal_receipts(character_id,occurred_at,battle_session_id)
  where outcome = 'victory';

create function app_private.capture_world_terminal_character_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  select battle.character_id into strict new.character_id
  from app_private.world_npc_battles battle where battle.battle_session_id = new.battle_session_id;
  return new;
end;
$$;
create trigger capture_world_terminal_character_v1
before insert on app_private.world_npc_terminal_receipts
for each row execute function app_private.capture_world_terminal_character_v1();

create table app_private.event_run_combat_discoveries (
  run_id uuid primary key references app_private.event_runs(id) on delete cascade,
  rule jsonb not null,
  opponent jsonb not null,
  first_xp bigint not null check (first_xp > 0),
  repeat_xp bigint check (repeat_xp > 0)
);
create index event_run_combat_discovery_tag_idx on app_private.event_run_combat_discoveries((rule->>'npcTag'));

create table app_private.event_combat_discovery_qualifications (
  run_id uuid not null references app_private.event_run_combat_discoveries(run_id) on delete cascade,
  event_key text not null,
  character_id uuid not null,
  day_start timestamptz not null,
  day_end timestamptz not null,
  qualified_at timestamptz not null,
  evidence_battle_id uuid not null references app_private.world_npc_terminal_receipts(battle_session_id) on delete cascade,
  processed_at timestamptz,
  primary key(character_id,event_key,day_start),
  check (day_start <= qualified_at and qualified_at < day_end)
);
create index event_combat_discovery_qualification_pending_idx
  on app_private.event_combat_discovery_qualifications(character_id,qualified_at,run_id)
  where processed_at is null;
create index event_combat_discovery_qualification_evidence_idx
  on app_private.event_combat_discovery_qualifications(evidence_battle_id);
create index event_combat_discovery_qualification_run_idx
  on app_private.event_combat_discovery_qualifications(run_id);

create table app_private.event_combat_discovery_tickets (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references app_private.event_run_combat_discoveries(run_id) on delete restrict,
  event_key text not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  day_start timestamptz not null,
  day_end timestamptz not null,
  qualified_at timestamptz not null,
  battle_session_id uuid unique references app_private.world_npc_battles(battle_session_id) on delete cascade,
  closed_at timestamptz,
  won boolean,
  reward_xp bigint check (reward_xp > 0),
  awarded_xp bigint check (awarded_xp >= 0),
  claim_command_id uuid,
  claim_fingerprint text,
  unique(character_id,event_key,day_start),
  unique(character_id,claim_command_id),
  check (day_start <= qualified_at and qualified_at < day_end),
  check (won is null or (closed_at is not null and battle_session_id is not null)),
  check (reward_xp is null or won is true),
  check (awarded_xp is null or reward_xp is not null),
  check ((awarded_xp is null) = (claim_command_id is null)),
  check ((claim_command_id is null) = (claim_fingerprint is null))
);
create unique index event_combat_discovery_open_ticket_idx
  on app_private.event_combat_discovery_tickets(character_id,event_key) where closed_at is null;
create index event_combat_discovery_first_clear_idx
  on app_private.event_combat_discovery_tickets(character_id,event_key,qualified_at,id) where won;
create index event_combat_discovery_pending_reward_idx
  on app_private.event_combat_discovery_tickets(character_id,qualified_at desc,id)
  where reward_xp is not null and awarded_xp is null;
create index event_combat_discovery_complete_idx
  on app_private.event_combat_discovery_tickets(character_id,qualified_at desc,id)
  where won and (reward_xp is null or awarded_xp is not null);
create index event_combat_discovery_run_idx on app_private.event_combat_discovery_tickets(run_id);
alter table app_private.event_run_combat_discoveries enable row level security;
alter table app_private.event_combat_discovery_tickets enable row level security;
alter table app_private.event_combat_discovery_qualifications enable row level security;
revoke all on app_private.event_run_combat_discoveries,app_private.event_combat_discovery_tickets,
  app_private.event_combat_discovery_qualifications
  from public,anon,authenticated,service_role;

create function app_private.assert_event_combat_discovery_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  rule jsonb := p_definition->'combatDiscovery';
  target_tag text := rule->>'npcTag';
  opponent_id uuid;
  opponent jsonb;
  line text;
begin
  if jsonb_typeof(rule) is distinct from 'object'
    or (rule - array['npcTag','requiredDefeats','timeZone','resetMinute','opponentNpcId','mode',
      'ready','completed','firstRewardPackageRef','repeatRewardPackageRef']) <> '{}'::jsonb
    or not app_private.event_definition_is_hidden_v1(p_definition)
    or p_definition#>>'{scope,type}' is distinct from 'global'
    or p_definition ?| array['inventoryDiscovery','personalJourney','repeatableTravel']
    or jsonb_array_length(coalesce(p_definition->'phases','[]')) <> 1
    or p_definition#>>'{phases,0,transition,type}' is distinct from 'manual'
    or coalesce(p_definition#>'{phases,0,objectives}','[]'::jsonb) <> '[]'::jsonb
    or coalesce(p_definition#>'{phases,0,effects}','[]'::jsonb) <> '[]'::jsonb
    or coalesce(p_definition#>'{phases,0,cleanupEffects}','[]'::jsonb) <> '[]'::jsonb
    or coalesce(p_definition->'rewardPackageRefs','[]'::jsonb) <> '[]'::jsonb
    or coalesce(p_definition->'aftermathRefs','[]'::jsonb) <> '[]'::jsonb
    or jsonb_typeof(rule->'npcTag') is distinct from 'string'
    or not coalesce(target_tag ~ '^[a-z][a-z0-9-]{1,31}$',false)
    or jsonb_typeof(rule->'requiredDefeats') is distinct from 'number'
    or not coalesce(rule->>'requiredDefeats' ~ '^([1-9]|[1-4][0-9]|50)$',false)
    or jsonb_typeof(rule->'resetMinute') is distinct from 'number'
    or not coalesce(rule->>'resetMinute' ~ '^[0-9]{1,4}$',false)
    or not coalesce(rule->>'mode' in ('evergreen','seasonal'),false)
    or jsonb_typeof(rule->'timeZone') is distinct from 'string'
    or not exists (select from pg_timezone_names where name = rule->>'timeZone')
    or jsonb_typeof(rule->'opponentNpcId') is distinct from 'string'
    or not coalesce(rule->>'opponentNpcId' ~ app_private.personal_realm_npc_id_pattern_v1(),false)
  then
    raise exception using errcode = '22023', message = 'EVENT_COMBAT_DISCOVERY_INVALID';
  end if;
  if (rule->>'resetMinute')::integer not between 0 and 1439 then
    raise exception using errcode = '22023', message = 'EVENT_COMBAT_DISCOVERY_INVALID';
  end if;
  foreach line in array array['ready','completed'] loop
    if jsonb_typeof(rule->line) is distinct from 'string'
      or char_length(rule->>line) not between 1 and 800
      or btrim(rule->>line) is distinct from rule->>line then
      raise exception using errcode = '22023', message = 'EVENT_COMBAT_DISCOVERY_INVALID';
    end if;
  end loop;
  opponent_id := (rule->>'opponentNpcId')::uuid;
  select npc.world into opponent from app_private.npc_designs npc where npc.id = opponent_id;
  if not app_private.valid_npc_world_encounter_v1(opponent->'encounter')
    or opponent->>'sectorId' like 'sealed-realm:%'
    or opponent#>'{encounter,tags}' ? target_tag then
    raise exception using errcode = '22023', message = 'EVENT_COMBAT_DISCOVERY_OPPONENT_UNAVAILABLE';
  end if;
  if not exists (
    select from app_private.npc_designs npc where npc.id <> opponent_id
      and npc.world->>'sectorId' not like 'sealed-realm:%'
      and app_private.valid_npc_world_encounter_v1(npc.world->'encounter')
      and npc.world#>'{encounter,tags}' ? target_tag
  ) then
    raise exception using errcode = '22023', message = 'EVENT_COMBAT_DISCOVERY_TARGET_UNAVAILABLE';
  end if;
  if jsonb_typeof(rule->'firstRewardPackageRef') is distinct from 'string'
    or app_private.personal_restoration_reward_amount_v1(rule->>'firstRewardPackageRef') is null
    or (rule ? 'repeatRewardPackageRef' and (
      jsonb_typeof(rule->'repeatRewardPackageRef') is distinct from 'string'
      or app_private.personal_restoration_reward_amount_v1(rule->>'repeatRewardPackageRef') is null
    )) then
    raise exception using errcode = '22023', message = 'EVENT_COMBAT_DISCOVERY_REWARD_UNAVAILABLE';
  end if;
end;
$$;

alter function app_private.assert_event_runtime_supported_v1(jsonb)
  rename to assert_event_runtime_before_daily_combat_v1;
create function app_private.assert_event_runtime_supported_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
begin
  if p_definition ? 'combatDiscovery' then
    perform app_private.assert_event_combat_discovery_v1(p_definition);
  end if;
  perform app_private.assert_event_runtime_before_daily_combat_v1(p_definition);
end;
$$;

create function app_private.capture_event_combat_discovery_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  definition jsonb;
  rule jsonb;
  opponent jsonb;
begin
  if new.run_mode <> 'production' then return new; end if;
  select version.definition into definition
  from app_private.event_definition_versions version where version.id = new.definition_version_id;
  if not (definition ? 'combatDiscovery') then return new; end if;
  perform app_private.assert_event_combat_discovery_v1(definition);
  rule := definition->'combatDiscovery';
  if rule->>'mode' = 'seasonal' and new.scheduled_end_at is null then
    raise exception using errcode = '22023', message = 'EVENT_COMBAT_DISCOVERY_SEASON_END_REQUIRED';
  end if;
  select npc.world into opponent
  from app_private.npc_designs npc where npc.id = (rule->>'opponentNpcId')::uuid for share;
  if not app_private.valid_npc_world_encounter_v1(opponent->'encounter')
    or opponent->>'sectorId' like 'sealed-realm:%'
    or opponent#>'{encounter,tags}' ? (rule->>'npcTag') then
    raise exception using errcode = '22023', message = 'EVENT_COMBAT_DISCOVERY_OPPONENT_UNAVAILABLE';
  end if;
  insert into app_private.event_run_combat_discoveries(run_id,rule,opponent,first_xp,repeat_xp)
  values (new.id,rule,opponent,
    app_private.personal_restoration_reward_amount_v1(rule->>'firstRewardPackageRef'),
    app_private.personal_restoration_reward_amount_v1(rule->>'repeatRewardPackageRef'));
  return new;
end;
$$;
create trigger capture_event_combat_discovery_v1 after insert on app_private.event_runs
for each row execute function app_private.capture_event_combat_discovery_v1();

create function app_private.combat_discovery_opponent_matches_v1(p_current jsonb,p_captured jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    app_private.valid_npc_world_encounter_v1(p_current->'encounter')
    and p_current->>'id' = p_captured->>'id'
    and p_current->>'sectorId' = p_captured->>'sectorId'
    and p_current->>'x' = p_captured->>'x'
    and p_current->>'y' = p_captured->>'y'
    and p_current->>'radius' = p_captured->>'radius'
    and ((p_current->'encounter') - 'tags'::text) = ((p_captured->'encounter') - 'tags'::text),
    false);
$$;

create function app_private.combat_discovery_admission_open_v1(
  p_run app_private.event_runs,p_mode text,p_now timestamptz
)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(
    app_private.personal_quest_run_available_v1(p_run,p_now)
    or (p_mode = 'evergreen' and p_run.started_at <= p_now
      and (p_run.lifecycle_status in ('ended','archived')
        or (p_run.lifecycle_status = 'live' and p_run.scheduled_end_at <= p_now))), false);
$$;

create function app_private.combat_discovery_in_reach_v1(p_position jsonb,p_opponent jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    p_position->>'sectorId' = p_opponent->>'sectorId'
    and abs((p_position->>'x')::integer-(p_opponent->>'x')::integer)
      + abs((p_position->>'y')::integer-(p_opponent->>'y')::integer) <= (p_opponent->>'radius')::integer,
    false);
$$;

create function app_private.combat_discovery_victory_xp_v1(
  p_ticket app_private.event_combat_discovery_tickets,
  p_discovery app_private.event_run_combat_discoveries
)
returns bigint language sql stable set search_path = '' as $$
  select case when exists (
    select from app_private.event_combat_discovery_tickets prior
    where prior.won and prior.character_id = p_ticket.character_id and prior.event_key = p_ticket.event_key
      and (prior.qualified_at,prior.id) < (p_ticket.qualified_at,p_ticket.id)
  ) then p_discovery.repeat_xp else p_discovery.first_xp end;
$$;

create function app_private.combat_discovery_ticket_expired_v1(
  p_run app_private.event_runs,p_mode text,p_published boolean,p_now timestamptz
)
returns boolean language sql stable set search_path = '' as $$
  select not coalesce(p_published,false) or p_run.lifecycle_status in ('cancelled','emergency-stopped')
    or (p_mode = 'seasonal' and (
      p_run.scheduled_end_at <= p_now or p_run.lifecycle_status in ('resolving','ended','archived')
    ));
$$;

-- A staged qualification already occupies the same slot as its eventual
-- ticket. Inspect a linked battle's actual terminal instant so World read
-- timing cannot change whether a later day's qualification is eligible.
create function app_private.combat_discovery_slot_available_v1(
  p_character_id uuid,p_event_key text,p_at timestamptz
)
returns boolean language sql stable set search_path = '' as $$
  select not exists (
    select from app_private.event_combat_discovery_qualifications prior
    join app_private.event_run_combat_discoveries discovery using(run_id)
    join app_private.event_runs run on run.id = discovery.run_id
    left join app_private.npc_designs npc on npc.id = (discovery.rule->>'opponentNpcId')::uuid
    where prior.character_id = p_character_id and prior.event_key = p_event_key
      and prior.processed_at is null and prior.qualified_at <= p_at
      and not app_private.combat_discovery_ticket_expired_v1(
        run,discovery.rule->>'mode',app_private.combat_discovery_opponent_matches_v1(npc.world,discovery.opponent),p_at
      )
  ) and not exists (
    select from app_private.event_combat_discovery_tickets prior
    join app_private.event_run_combat_discoveries discovery using(run_id)
    join app_private.event_runs run on run.id = discovery.run_id
    left join app_private.npc_designs npc on npc.id = (discovery.rule->>'opponentNpcId')::uuid
    where prior.character_id = p_character_id and prior.event_key = p_event_key
      and prior.qualified_at <= p_at and (prior.closed_at is null or prior.closed_at > p_at)
      and (
        (prior.battle_session_id is null and not app_private.combat_discovery_ticket_expired_v1(
          run,discovery.rule->>'mode',app_private.combat_discovery_opponent_matches_v1(npc.world,discovery.opponent),p_at
        )) or (prior.battle_session_id is not null and not exists (
          select from app_private.world_npc_terminal_receipts terminal
          where terminal.battle_session_id = prior.battle_session_id and terminal.occurred_at <= p_at
        ))
      )
  );
$$;

-- Persist the qualifying day in the battle transaction. This trigger only
-- appends evidence. The owned World read promotes evidence into tickets.
create function app_private.capture_combat_discovery_qualification_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  admission app_private.world_npc_battles%rowtype;
begin
  select * into strict admission from app_private.world_npc_battles
  where battle_session_id = new.battle_session_id;
  if admission.placement->>'sectorId' like 'sealed-realm:%' then return new; end if;
  insert into app_private.event_combat_discovery_qualifications(
    run_id,event_key,character_id,day_start,day_end,qualified_at,evidence_battle_id,processed_at
  )
  select run.id,run.event_key,new.character_id,day.starts_at,day.resets_at,progress.occurred_at,progress.battle_session_id,
    case when not app_private.combat_discovery_slot_available_v1(
      new.character_id,run.event_key,progress.occurred_at
    ) then new.occurred_at end
  from jsonb_array_elements_text(admission.tags) tag(value)
  join app_private.event_run_combat_discoveries discovery on discovery.rule->>'npcTag' = tag.value
  join app_private.event_runs run on run.id = discovery.run_id
    and run.started_at <= admission.admitted_at
    and (run.scheduled_end_at is null or run.scheduled_end_at > admission.admitted_at)
    and (run.resolving_at is null or run.resolving_at > admission.admitted_at)
    and (run.ended_at is null or run.ended_at > admission.admitted_at)
    and (run.emergency_stopped_at is null or run.emergency_stopped_at > admission.admitted_at)
  cross join lateral app_private.calendar_reset_window_v1(new.occurred_at,'day',
    discovery.rule->>'timeZone',(discovery.rule->>'resetMinute')::integer) day
  cross join lateral (
    select terminal.occurred_at,terminal.battle_session_id
    from app_private.world_npc_terminal_receipts terminal
    join app_private.world_npc_battles battle using(battle_session_id)
    where terminal.character_id = new.character_id and terminal.outcome = 'victory'
      and terminal.occurred_at >= day.starts_at and terminal.occurred_at < day.resets_at
      and terminal.occurred_at <= new.occurred_at and terminal.occurred_at >= battle.admitted_at
      and battle.placement->>'sectorId' not like 'sealed-realm:%'
      and battle.npc_id <> (discovery.rule->>'opponentNpcId')::uuid and battle.tags ? tag.value
      and app_private.repeatable_hunt_run_status_at_v1(run,battle.admitted_at) = 'live'
    order by terminal.occurred_at,terminal.battle_session_id
    offset (discovery.rule->>'requiredDefeats')::integer - 1 limit 1
  ) progress
  where admission.npc_id <> (discovery.rule->>'opponentNpcId')::uuid
    and app_private.repeatable_hunt_run_status_at_v1(run,admission.admitted_at) = 'live'
    and not exists (select from app_private.event_combat_discovery_qualifications known
      where known.character_id = new.character_id and known.event_key = run.event_key
        and known.day_start < day.resets_at and known.day_end > day.starts_at)
  on conflict do nothing;
  return new;
end;
$$;
create trigger capture_combat_discovery_qualification_v1 after insert on app_private.world_npc_terminal_receipts
for each row when (new.outcome = 'victory') execute function app_private.capture_combat_discovery_qualification_v1();

-- An owned World read already holds the heartbeat row. The nonblocking
-- account and character checks preserve the canonical mutation lock order.
create function app_private.reconcile_combat_discovery_v1(
  p_user_id uuid,p_character_id uuid,p_now timestamptz
)
returns void language plpgsql set search_path = '' as $$
begin
  if not exists (select from app_private.event_run_combat_discoveries)
    or not pg_try_advisory_xact_lock(hashtextextended(p_user_id::text,1))
    or not exists (select from public.characters
      where id = p_character_id and user_id = p_user_id for key share skip locked) then
    return;
  end if;

  update app_private.event_combat_discovery_tickets ticket
    set closed_at = terminal.occurred_at,won = terminal.outcome = 'victory',
      reward_xp = case when terminal.outcome = 'victory'
        then app_private.combat_discovery_victory_xp_v1(ticket,discovery) end
  from app_private.event_run_combat_discoveries discovery,app_private.world_npc_terminal_receipts terminal
  where ticket.character_id = p_character_id and ticket.closed_at is null
    and terminal.battle_session_id = ticket.battle_session_id and ticket.run_id = discovery.run_id;

  update app_private.event_combat_discovery_tickets ticket set closed_at = p_now
  from app_private.event_run_combat_discoveries discovery
  join app_private.event_runs run on run.id = discovery.run_id
  left join app_private.npc_designs npc on npc.id = (discovery.rule->>'opponentNpcId')::uuid
  where ticket.character_id = p_character_id and ticket.closed_at is null
    and ticket.battle_session_id is null and ticket.run_id = discovery.run_id
    and app_private.combat_discovery_ticket_expired_v1(
      run,discovery.rule->>'mode',app_private.combat_discovery_opponent_matches_v1(npc.world,discovery.opponent),p_now
    );

  -- Consume expired or duplicate evidence in bounded batches.
  with stale as (
    select qualification.run_id,qualification.day_start
    from app_private.event_combat_discovery_qualifications qualification
    join app_private.event_run_combat_discoveries discovery using(run_id)
    join app_private.event_runs run on run.id = discovery.run_id
    left join app_private.npc_designs npc on npc.id = (discovery.rule->>'opponentNpcId')::uuid
    where qualification.character_id = p_character_id and qualification.processed_at is null
      and (app_private.combat_discovery_ticket_expired_v1(
        run,discovery.rule->>'mode',app_private.combat_discovery_opponent_matches_v1(npc.world,discovery.opponent),p_now
      ) or exists (select from app_private.event_combat_discovery_tickets prior
        where prior.character_id = p_character_id and prior.event_key = run.event_key
          and prior.day_start < qualification.day_end and prior.day_end > qualification.day_start))
    order by qualification.qualified_at,qualification.run_id
    limit 24
  )
  update app_private.event_combat_discovery_qualifications qualification set processed_at = p_now
  from stale where qualification.character_id = p_character_id and qualification.run_id = stale.run_id
    and qualification.day_start = stale.day_start;

  with eligible as (
    select qualification.*
    from app_private.event_combat_discovery_qualifications qualification
    join app_private.event_run_combat_discoveries discovery using(run_id)
    join app_private.event_runs run on run.id = discovery.run_id
    left join app_private.npc_designs npc on npc.id = (discovery.rule->>'opponentNpcId')::uuid
    where qualification.character_id = p_character_id and qualification.processed_at is null
      and qualification.qualified_at <= p_now
      and not app_private.combat_discovery_ticket_expired_v1(
        run,discovery.rule->>'mode',app_private.combat_discovery_opponent_matches_v1(npc.world,discovery.opponent),p_now
      )
      and not exists (select from app_private.event_combat_discovery_tickets prior
        where prior.character_id = p_character_id and prior.event_key = run.event_key
          and (prior.closed_at is null
            or (prior.day_start < qualification.day_end and prior.day_end > qualification.day_start)))
    order by qualification.qualified_at,qualification.run_id
    limit 8
  ), issued as (
    insert into app_private.event_combat_discovery_tickets(run_id,event_key,character_id,day_start,day_end,qualified_at)
    select run_id,event_key,p_character_id,day_start,day_end,qualified_at from eligible
    order by qualified_at,run_id on conflict do nothing
    returning run_id,day_start
  )
  update app_private.event_combat_discovery_qualifications qualification set processed_at = p_now
  from issued where qualification.character_id = p_character_id and qualification.run_id = issued.run_id
    and qualification.day_start = issued.day_start;
end;
$$;

create function app_private.combat_discovery_idle_world_v1(
  p_user_id uuid,p_character_id uuid,p_state jsonb
)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(
    p_state->'route' = '[]'::jsonb and p_state->>'ferry' is null
    and (p_state#>>'{position,sectorId}') not like 'sealed-realm:%'
    and app_private.world_block_reason_v1(p_user_id,p_character_id) is null,
    false);
$$;

alter function app_private.read_world_personal_quests_v1(uuid,uuid,jsonb,timestamptz)
  rename to read_world_quests_before_combat_discovery_v1;
create function app_private.read_world_personal_quests_v1(
  p_user_id uuid,p_character_id uuid,p_position jsonb,p_now timestamptz
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  previous jsonb;
  discoveries jsonb;
  idle boolean;
begin
  previous := app_private.read_world_quests_before_combat_discovery_v1(
    p_user_id,p_character_id,p_position,p_now
  );
  perform app_private.reconcile_combat_discovery_v1(p_user_id,p_character_id,p_now);
  if not exists (
    select from app_private.event_combat_discovery_tickets ticket where ticket.character_id = p_character_id
  ) then return previous; end if;
  select app_private.combat_discovery_idle_world_v1(p_user_id,p_character_id,world.state)
    into idle from app_private.character_world_state world where world.character_id = p_character_id;
  with candidates as (
    (select * from app_private.event_combat_discovery_tickets ticket
      where ticket.character_id = p_character_id and ticket.reward_xp is not null and ticket.awarded_xp is null
      order by ticket.qualified_at desc,ticket.id limit 24)
    union all
    (select * from app_private.event_combat_discovery_tickets ticket
      where ticket.character_id = p_character_id and ticket.closed_at is null
      order by ticket.qualified_at desc,ticket.id limit 24)
    union all
    (select distinct on (recent.event_key) recent.* from (
      select * from app_private.event_combat_discovery_tickets ticket
      where ticket.character_id = p_character_id and ticket.won
        and (ticket.reward_xp is null or ticket.awarded_xp is not null)
      order by ticket.qualified_at desc,ticket.id limit 24
    ) recent order by recent.event_key,recent.qualified_at desc,recent.id)
  ), visible as (
    select ticket.*,version.definition->>'title' title,discovery.rule,discovery.opponent,
      app_private.combat_discovery_admission_open_v1(run,discovery.rule->>'mode',p_now)
        and app_private.combat_discovery_opponent_matches_v1(npc.world,discovery.opponent) admissible,
      ticket.reward_xp is not null and ticket.awarded_xp is null reward_pending
    from candidates ticket
    join public.characters character on character.id = ticket.character_id and character.user_id = p_user_id
    join app_private.event_run_combat_discoveries discovery on discovery.run_id = ticket.run_id
    join app_private.event_runs run on run.id = ticket.run_id
    join app_private.event_definition_versions version on version.id = run.definition_version_id
    left join app_private.npc_designs npc on npc.id = (discovery.rule->>'opponentNpcId')::uuid
    where ticket.battle_session_id is not null or not app_private.combat_discovery_ticket_expired_v1(
      run,discovery.rule->>'mode',app_private.combat_discovery_opponent_matches_v1(npc.world,discovery.opponent),p_now
    )
    order by reward_pending desc,(ticket.closed_at is null) desc,ticket.qualified_at desc,ticket.id
    limit 24
  ), projected as (
    select *, idle and app_private.combat_discovery_in_reach_v1(p_position,opponent)
      and admissible and battle_session_id is null can_challenge,
      idle and app_private.combat_discovery_in_reach_v1(p_position,opponent) and reward_pending can_claim
    from visible
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'avenger',true,'runId',id,'title',title,'speaker',opponent->>'name',
    'giverId',opponent->>'id','portraitRef',opponent->'portraitRef','portraitUrl',opponent->'imageUrl',
    'progress',case when won then 'completed' when battle_session_id is not null then 'active' else 'ready' end,
    'body',case when won then rule->>'completed' else rule->>'ready' end,
    'local',coalesce(can_challenge or can_claim,false),
    'action',case when can_challenge then 'challenge-avenger' when can_claim then 'claim-avenger-reward' end,
    'destination',case when reward_pending or (battle_session_id is null and admissible)
      then jsonb_build_object('sectorId',opponent->'sectorId','x',opponent->'x','y',opponent->'y') end,
    'rewardPending',coalesce(reward_pending,false),'awardedXp',awarded_xp
  ) order by reward_pending desc nulls last,(closed_at is null) desc,qualified_at desc,id),'[]'::jsonb)
    into discoveries from projected;
  return discoveries || previous;
end;
$$;

create function public.read_world_avenger_battle_replay_v1(
  p_user_id uuid,p_character_id uuid,p_ticket_id uuid,p_command_id uuid,p_world_fingerprint text
)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  ticket_battle uuid;
  npc_id uuid;
  replay_id uuid;
begin
  select ticket.battle_session_id,(discovery.rule->>'opponentNpcId')::uuid into ticket_battle,npc_id
  from app_private.event_combat_discovery_tickets ticket
  join public.characters character on character.id = ticket.character_id and character.user_id = p_user_id
  join app_private.event_run_combat_discoveries discovery on discovery.run_id = ticket.run_id
  where ticket.id = p_ticket_id and ticket.character_id = p_character_id;
  if not found then raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE'; end if;
  replay_id := public.read_world_npc_battle_replay_v1(
    p_user_id,p_character_id,npc_id,p_command_id,p_world_fingerprint
  );
  if replay_id is not null and replay_id is distinct from ticket_battle then
    raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT';
  end if;
  return replay_id;
end;
$$;

create function public.read_world_avenger_battle_v1(
  p_user_id uuid,p_character_id uuid,p_expected_version bigint,p_ticket_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  npc_id uuid;
begin
  select npc.id into npc_id
  from app_private.event_combat_discovery_tickets ticket
  join public.characters character on character.id = ticket.character_id and character.user_id = p_user_id
  join app_private.event_run_combat_discoveries discovery on discovery.run_id = ticket.run_id
  join app_private.event_runs run on run.id = ticket.run_id
  join app_private.npc_designs npc on npc.id = (discovery.rule->>'opponentNpcId')::uuid
    and app_private.combat_discovery_opponent_matches_v1(npc.world,discovery.opponent)
  where ticket.id = p_ticket_id and ticket.character_id = p_character_id
    and ticket.closed_at is null and ticket.battle_session_id is null
    and app_private.combat_discovery_admission_open_v1(run,discovery.rule->>'mode',statement_timestamp());
  if not found then raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE'; end if;
  return public.read_world_npc_battle_v1(p_user_id,p_character_id,npc_id,p_expected_version);
end;
$$;

create function public.start_world_avenger_battle_v1(
  p_user_id uuid,p_character_id uuid,p_expected_version bigint,p_command_id uuid,p_npc_id uuid,
  p_world_fingerprint text,p_request_fingerprint text,p_battle_id text,p_rules_version integer,
  p_content_version integer,p_initial_snapshot jsonb,p_participants jsonb,p_start_snapshot jsonb,
  p_initial_events jsonb,p_privacy_journal jsonb,p_ticket_id uuid
)
returns table(battle_session_id uuid,battle_version bigint,snapshot jsonb,created_at timestamptz,replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare
  ticket app_private.event_combat_discovery_tickets%rowtype;
  discovery app_private.event_run_combat_discoveries%rowtype;
  run app_private.event_runs%rowtype;
  replay_id uuid;
  created record;
begin
  if not pg_try_advisory_xact_lock_shared(hashtextextended('combat-catalogue-publication',0))
    or not pg_try_advisory_xact_lock(hashtextextended(p_user_id::text,0)) then
    raise exception using errcode = 'PT409', message = 'WORLD_STALE_BATTLE_ADMISSION';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
  replay_id := public.read_world_avenger_battle_replay_v1(
    p_user_id,p_character_id,p_ticket_id,p_command_id,p_world_fingerprint
  );
  if replay_id is not null then
    if not exists (select from app_private.world_npc_battles battle
      where battle.battle_session_id = replay_id and battle.npc_id = p_npc_id) then
      raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT';
    end if;
    return query select replay.* from public.get_battle_creation_replay_v1(
      p_user_id,p_command_id,p_request_fingerprint
    ) replay where replay.battle_session_id = replay_id;
    if not found then raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT'; end if;
    return;
  end if;
  select * into ticket from app_private.event_combat_discovery_tickets
    where id = p_ticket_id and character_id = p_character_id for update;
  select * into discovery from app_private.event_run_combat_discoveries where run_id = ticket.run_id;
  if ticket.battle_session_id is not null or ticket.closed_at is not null
    or p_npc_id is distinct from (discovery.rule->>'opponentNpcId')::uuid then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  select * into run from app_private.event_runs where id = ticket.run_id for share nowait;
  if not app_private.combat_discovery_admission_open_v1(run,discovery.rule->>'mode',clock_timestamp()) then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;

  select * into strict created from public.start_world_npc_battle_v1(
    p_user_id,p_character_id,p_expected_version,p_command_id,p_npc_id,p_world_fingerprint,
    p_request_fingerprint,p_battle_id,p_rules_version,p_content_version,p_initial_snapshot,
    p_participants,p_start_snapshot,p_initial_events,p_privacy_journal
  );
  if created.replayed then raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT'; end if;
  if not app_private.combat_discovery_admission_open_v1(run,discovery.rule->>'mode',created.created_at)
    or not exists (select from app_private.npc_designs npc
      where npc.id = p_npc_id and app_private.combat_discovery_opponent_matches_v1(npc.world,discovery.opponent)) then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  update app_private.event_combat_discovery_tickets set battle_session_id = created.battle_session_id
  where id = ticket.id;
  return query select created.battle_session_id,created.battle_version,created.snapshot,created.created_at,created.replayed;
exception when lock_not_available then
  raise exception using errcode = 'PT409', message = 'WORLD_STALE_BATTLE_ADMISSION';
end;
$$;

create function public.claim_world_avenger_reward_v1(
  p_user_id uuid,p_character_id uuid,p_expected_version bigint,p_command_id uuid,
  p_ticket_id uuid,p_request_fingerprint text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  world app_private.character_world_state%rowtype;
  ticket app_private.event_combat_discovery_tickets%rowtype;
  discovery app_private.event_run_combat_discoveries%rowtype;
  prior_claim app_private.event_combat_discovery_tickets%rowtype;
  xp_amount bigint;
  reward_key text;
  xp record;
begin
  if p_command_id is null or p_request_fingerprint is null then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
  perform 1 from public.characters character where character.id = p_character_id and character.user_id = p_user_id
    and not exists(select from app_private.character_deletion_requests deletion where deletion.character_id = character.id)
    for update;
  if not found then raise exception using errcode = '42501', message = 'WORLD_NOT_OWNED'; end if;
  select * into world from app_private.character_world_state where character_id = p_character_id for update;
  if not found then raise exception 'WORLD_STATE_UNAVAILABLE'; end if;
  select * into prior_claim from app_private.event_combat_discovery_tickets
    where character_id = p_character_id and claim_command_id = p_command_id;
  if found then
    if prior_claim.id is distinct from p_ticket_id or prior_claim.claim_fingerprint is distinct from p_request_fingerprint then
      raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT';
    end if;
    return world.state;
  end if;
  if world.last_command_id = p_command_id then raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT'; end if;
  if (world.state->>'version')::bigint is distinct from p_expected_version then
    raise exception using errcode = 'PT409', message = 'WORLD_STALE_VERSION';
  end if;
  select * into ticket from app_private.event_combat_discovery_tickets where id = p_ticket_id
    and character_id = p_character_id for update;
  if not found or ticket.awarded_xp is not null or not exists (
    select from app_private.world_npc_terminal_receipts terminal
    where terminal.battle_session_id = ticket.battle_session_id and terminal.outcome = 'victory'
  ) or not app_private.combat_discovery_idle_world_v1(p_user_id,p_character_id,world.state) then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  select * into discovery from app_private.event_run_combat_discoveries where run_id = ticket.run_id;
  if not app_private.combat_discovery_in_reach_v1(world.state->'position',discovery.opponent) then
    raise exception using errcode = '22023', message = 'WORLD_NPC_CHALLENGE_OUT_OF_RANGE';
  end if;
  xp_amount := coalesce(ticket.reward_xp,app_private.combat_discovery_victory_xp_v1(ticket,discovery));
  if xp_amount is null then raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE'; end if;

  world.state := public.commit_world_state_v1(p_user_id,p_character_id,p_expected_version,
    p_command_id,'interact',world.state,p_request_fingerprint);
  reward_key := md5(jsonb_build_array('event.combat-discovery',ticket.id)::text);
  select * into xp from public.grant_character_xp_v1(
    p_character_id,reward_key::uuid,reward_key,'system:event-quest','gameplay',
    'event.combat-discovery:' || reward_key,'event.quest.reward',xp_amount
  );
  if not found or xp.grant_id is null then raise exception 'WORLD_QUEST_REWARD_UNAVAILABLE'; end if;
  update app_private.event_combat_discovery_tickets
    set won = true,reward_xp = xp_amount,awarded_xp = xp.applied_amount,
      closed_at = coalesce(closed_at,(select terminal.occurred_at
        from app_private.world_npc_terminal_receipts terminal where terminal.battle_session_id = ticket.battle_session_id)),
      claim_command_id = p_command_id,claim_fingerprint = p_request_fingerprint
    where id = ticket.id;
  return world.state;
end;
$$;

revoke all on function
  app_private.capture_world_terminal_character_v1(),
  app_private.assert_event_combat_discovery_v1(jsonb),
  app_private.assert_event_runtime_supported_v1(jsonb),
  app_private.assert_event_runtime_before_daily_combat_v1(jsonb),
  app_private.capture_event_combat_discovery_v1(),
  app_private.capture_combat_discovery_qualification_v1(),
  app_private.combat_discovery_opponent_matches_v1(jsonb,jsonb),
  app_private.combat_discovery_slot_available_v1(uuid,text,timestamptz),
  app_private.combat_discovery_admission_open_v1(app_private.event_runs,text,timestamptz),
  app_private.combat_discovery_in_reach_v1(jsonb,jsonb),
  app_private.combat_discovery_ticket_expired_v1(app_private.event_runs,text,boolean,timestamptz),
  app_private.reconcile_combat_discovery_v1(uuid,uuid,timestamptz),
  app_private.combat_discovery_victory_xp_v1(app_private.event_combat_discovery_tickets,app_private.event_run_combat_discoveries),
  app_private.combat_discovery_idle_world_v1(uuid,uuid,jsonb),
  app_private.read_world_personal_quests_v1(uuid,uuid,jsonb,timestamptz),
  app_private.read_world_quests_before_combat_discovery_v1(uuid,uuid,jsonb,timestamptz)
from public,anon,authenticated,service_role;

revoke all on function
  public.read_world_avenger_battle_replay_v1(uuid,uuid,uuid,uuid,text),
  public.read_world_avenger_battle_v1(uuid,uuid,bigint,uuid),
  public.start_world_avenger_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb,uuid),
  public.claim_world_avenger_reward_v1(uuid,uuid,bigint,uuid,uuid,text)
from public,anon,authenticated;
grant execute on function
  public.read_world_avenger_battle_replay_v1(uuid,uuid,uuid,uuid,text),
  public.read_world_avenger_battle_v1(uuid,uuid,bigint,uuid),
  public.start_world_avenger_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb,uuid),
  public.claim_world_avenger_reward_v1(uuid,uuid,bigint,uuid,uuid,text)
to service_role;

commit;
