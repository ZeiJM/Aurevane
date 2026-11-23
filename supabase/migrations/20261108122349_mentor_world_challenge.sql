begin;

create table app_private.event_run_mentor_challenges (
  run_id uuid primary key references app_private.event_runs(id) on delete cascade,
  rule jsonb not null,
  opponent jsonb not null,
  victory_xp bigint not null check (victory_xp > 0),
  defeat_xp bigint not null check (defeat_xp > 0),
  fast_xp bigint check (fast_xp > 0)
);

create index event_mentor_sector_idx
  on app_private.event_run_mentor_challenges((opponent->>'sectorId'));

create table app_private.event_mentor_attempts (
  battle_session_id uuid primary key references app_private.world_npc_battles(battle_session_id) on delete cascade,
  run_id uuid not null references app_private.event_run_mentor_challenges(run_id) on delete restrict,
  event_key text not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  training boolean not null,
  awarded_xp bigint check (awarded_xp >= 0),
  claim_command_id uuid,
  claim_fingerprint text,
  unique(character_id,claim_command_id),
  check ((awarded_xp is null) = (claim_command_id is null)),
  check ((claim_command_id is null) = (claim_fingerprint is null)),
  check (not training or awarded_xp is null)
);
create index event_mentor_character_idx
  on app_private.event_mentor_attempts(character_id,event_key) where not training;
create index event_mentor_run_idx on app_private.event_mentor_attempts(run_id);
alter table app_private.event_run_mentor_challenges enable row level security;
alter table app_private.event_mentor_attempts enable row level security;
revoke all on app_private.event_run_mentor_challenges,app_private.event_mentor_attempts
  from public,anon,authenticated,service_role;

create function app_private.assert_event_mentor_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  rule jsonb := p_definition->'mentorChallenge';
  recurrence jsonb := rule->'recurrence';
  bonus jsonb := rule->'fastVictory';
  line text;
begin
  if exists (
    select from app_private.event_definition_versions version
    where version.event_key = p_definition->>'eventKey'
      and (version.definition ? 'mentorChallenge') is distinct from (rule is not null)
  ) then
    raise exception using errcode = '22023', message = 'EVENT_MENTOR_IDENTITY_IMMUTABLE';
  end if;
  if rule is null then return; end if;
  if jsonb_typeof(rule) is distinct from 'object'
    or (rule - array['opponentNpcId','offer','victory','defeat','victoryRewardPackageRef',
      'defeatRewardPackageRef','fastVictory','recurrence']) <> '{}'::jsonb
    or p_definition->>'category' is distinct from 'repeatable-activities'
    or p_definition#>>'{scope,type}' is distinct from 'global'
    or p_definition ?| array['inventoryDiscovery','personalJourney','repeatableTravel','combatDiscovery']
    or jsonb_array_length(coalesce(p_definition->'phases','[]')) <> 1
    or p_definition#>>'{phases,0,transition,type}' is distinct from 'manual'
    or coalesce(p_definition#>'{phases,0,objectives}','[]'::jsonb) <> '[]'::jsonb
    or coalesce(p_definition#>'{phases,0,effects}','[]'::jsonb) <> '[]'::jsonb
    or coalesce(p_definition#>'{phases,0,cleanupEffects}','[]'::jsonb) <> '[]'::jsonb
    or coalesce(p_definition->'rewardPackageRefs','[]'::jsonb) <> '[]'::jsonb
    or coalesce(p_definition->'aftermathRefs','[]'::jsonb) <> '[]'::jsonb
    or not coalesce(rule->>'opponentNpcId' ~ app_private.personal_realm_npc_id_pattern_v1(),false)
    or jsonb_typeof(rule->'victoryRewardPackageRef') is distinct from 'string'
    or jsonb_typeof(rule->'defeatRewardPackageRef') is distinct from 'string'
    or rule->>'victoryRewardPackageRef' = rule->>'defeatRewardPackageRef'
    or (bonus is not null and (
      jsonb_typeof(bonus) is distinct from 'object'
      or (bonus - array['withinSeconds','rewardPackageRef']) <> '{}'::jsonb
      or jsonb_typeof(bonus->'withinSeconds') is distinct from 'number'
      or not coalesce(bonus->>'withinSeconds' ~ '^[1-9][0-9]{0,3}$',false)
      or jsonb_typeof(bonus->'rewardPackageRef') is distinct from 'string'
      or bonus->>'rewardPackageRef' in (rule->>'victoryRewardPackageRef',rule->>'defeatRewardPackageRef')
    )) then
    raise exception using errcode = '22023', message = 'EVENT_MENTOR_INVALID';
  end if;
  if bonus is not null and (bonus->>'withinSeconds')::integer > 3600 then
    raise exception using errcode = '22023', message = 'EVENT_MENTOR_INVALID';
  end if;
  foreach line in array array['offer','victory','defeat'] loop
    if jsonb_typeof(rule->line) is distinct from 'string'
      or char_length(rule->>line) not between 1 and 800
      or btrim(rule->>line) is distinct from rule->>line then
      raise exception using errcode = '22023', message = 'EVENT_MENTOR_INVALID';
    end if;
  end loop;
  if jsonb_typeof(recurrence) is distinct from 'object'
    or not coalesce(recurrence->>'mode' in ('rolling-24h','calendar-day','calendar-week'),false) then
    raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_RECURRENCE_INVALID';
  end if;
  if recurrence->>'mode' = 'rolling-24h' then
    if (recurrence - 'mode') <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_RECURRENCE_INVALID';
    end if;
  elsif (recurrence - array['mode','timeZone','resetMinute']) <> '{}'::jsonb
    or jsonb_typeof(recurrence->'timeZone') is distinct from 'string'
    or not exists (select from pg_timezone_names where name = recurrence->>'timeZone')
    or jsonb_typeof(recurrence->'resetMinute') is distinct from 'number'
    or not coalesce(recurrence->>'resetMinute' ~ '^[0-9]{1,4}$',false) then
    raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_RECURRENCE_INVALID';
  elsif (recurrence->>'resetMinute')::integer > 1439 then
    raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_RECURRENCE_INVALID';
  end if;
  if not exists (
    select from app_private.npc_designs npc where npc.id = (rule->>'opponentNpcId')::uuid
      and npc.world->>'sectorId' not like 'sealed-realm:%'
      and app_private.valid_npc_world_encounter_v1(npc.world->'encounter')
      and npc.world#>'{encounter,tags}' = '[]'::jsonb
  ) then
    raise exception using errcode = '22023', message = 'EVENT_MENTOR_OPPONENT_UNAVAILABLE';
  end if;
  if app_private.personal_restoration_reward_amount_v1(rule->>'victoryRewardPackageRef') is null
    or app_private.personal_restoration_reward_amount_v1(rule->>'defeatRewardPackageRef') is null
    or (bonus is not null and app_private.personal_restoration_reward_amount_v1(bonus->>'rewardPackageRef') is null) then
    raise exception using errcode = '22023', message = 'EVENT_MENTOR_REWARD_UNAVAILABLE';
  end if;
end;
$$;

alter function app_private.assert_event_runtime_supported_v1(jsonb)
  rename to assert_event_runtime_before_mentor_v1;
create function app_private.assert_event_runtime_supported_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
begin
  perform app_private.assert_event_mentor_v1(p_definition);
  perform app_private.assert_event_runtime_before_mentor_v1(p_definition);
end;
$$;

create function app_private.capture_event_mentor_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  definition jsonb;
  rule jsonb;
  opponent jsonb;
begin
  if new.run_mode <> 'production' then return new; end if;
  select version.definition into definition
  from app_private.event_definition_versions version where version.id = new.definition_version_id;
  if not (definition ? 'mentorChallenge') then return new; end if;
  rule := definition->'mentorChallenge';
  select npc.world into opponent from app_private.npc_designs npc
  where npc.id = (rule->>'opponentNpcId')::uuid for share;
  perform app_private.assert_event_mentor_v1(definition);
  insert into app_private.event_run_mentor_challenges(run_id,rule,opponent,victory_xp,defeat_xp,fast_xp)
  values(new.id,rule,opponent,
    app_private.personal_restoration_reward_amount_v1(rule->>'victoryRewardPackageRef'),
    app_private.personal_restoration_reward_amount_v1(rule->>'defeatRewardPackageRef'),
    app_private.personal_restoration_reward_amount_v1(rule#>>'{fastVictory,rewardPackageRef}'));
  return new;
end;
$$;
create trigger capture_event_mentor_v1 after insert on app_private.event_runs
for each row execute function app_private.capture_event_mentor_v1();

-- A World knockout can be committed separately from the timeout that handed
-- control to the NPC. Only a later player command can establish resumed play.
create function app_private.mentor_defeat_is_eligible_v1(
  p_session uuid,p_character uuid,p_terminal_version bigint
)
returns boolean language sql stable set search_path = '' as $$
  with last_timeout as (
    select max(event.battle_version) version
    from app_private.battle_events event
    where event.battle_session_id = p_session and event.battle_version <= p_terminal_version
      and event.event->>'event' in ('ai_turn_timed_out','pvp_turn_timed_out')
      and event.event->>'combatantId' = 'character:' || p_character::text
  )
  select last_timeout.version is null or exists (
    select from app_private.battle_events event
    join app_private.battle_privacy_journal journal using(battle_session_id,battle_version)
    where event.battle_session_id = p_session
      and event.battle_version > last_timeout.version and event.battle_version <= p_terminal_version
      and journal.journal->>'actorCombatantId' = 'character:' || p_character::text
      and ((event.event->>'event' = 'combat_action_used'
          and event.event->>'actorId' = 'character:' || p_character::text)
        or (event.event->>'event' in ('combatant_moved','turn_ended')
          and event.event->>'combatantId' = 'character:' || p_character::text))
  ) from last_timeout;
$$;

create index event_mentor_opponent_idx
  on app_private.event_run_mentor_challenges(((rule->>'opponentNpcId')::uuid));

create function app_private.mentor_opponent_reserved_v1(p_npc_id uuid,p_at timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select from app_private.event_run_mentor_challenges mentor
    join app_private.event_runs run on run.id = mentor.run_id
    where (mentor.rule->>'opponentNpcId')::uuid = p_npc_id
      and run.started_at <= p_at and run.lifecycle_status in ('live','paused')
      and (run.scheduled_end_at is null or p_at < run.scheduled_end_at)
  );
$$;

-- Preserve the same encounter engine for authored challenges. Only the normal
-- World NPC entrypoints hide and reject a reserved opponent.
alter function public.read_world_npc_battle_v1(uuid,uuid,uuid,bigint) set schema app_private;
alter function public.start_world_npc_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)
  set schema app_private;

create function public.read_world_npc_battle_v1(
  p_user_id uuid,p_character_id uuid,p_npc_id uuid,p_expected_version bigint
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare opponent jsonb;
begin
  opponent := app_private.read_world_npc_battle_v1(p_user_id,p_character_id,p_npc_id,p_expected_version);
  if app_private.mentor_opponent_reserved_v1(p_npc_id,statement_timestamp()) then
    raise exception using errcode = '22023', message = 'WORLD_NPC_CHALLENGE_UNAVAILABLE';
  end if;
  return opponent;
end;
$$;

create function public.start_world_npc_battle_v1(
  p_user_id uuid,p_character_id uuid,p_expected_version bigint,p_command_id uuid,p_npc_id uuid,
  p_world_fingerprint text,p_request_fingerprint text,p_battle_id text,p_rules_version integer,
  p_content_version integer,p_initial_snapshot jsonb,p_participants jsonb,p_start_snapshot jsonb,
  p_initial_events jsonb,p_privacy_journal jsonb
)
returns table(battle_session_id uuid,battle_version bigint,snapshot jsonb,created_at timestamptz,replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare created record;
begin
  select * into strict created from app_private.start_world_npc_battle_v1(
    p_user_id,p_character_id,p_expected_version,p_command_id,p_npc_id,p_world_fingerprint,
    p_request_fingerprint,p_battle_id,p_rules_version,p_content_version,p_initial_snapshot,
    p_participants,p_start_snapshot,p_initial_events,p_privacy_journal
  );
  if not created.replayed and app_private.mentor_opponent_reserved_v1(p_npc_id,created.created_at) then
    raise exception using errcode = '22023', message = 'WORLD_NPC_CHALLENGE_UNAVAILABLE';
  end if;
  return query select created.battle_session_id,created.battle_version,created.snapshot,created.created_at,created.replayed;
end;
$$;

create or replace function public.read_published_world_npcs_v1(p_sector_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(case when app_private.mentor_opponent_reserved_v1(d.id,statement_timestamp())
    then d.world - 'encounter' else d.world end order by d.id),'[]'::jsonb)
  from app_private.npc_designs d
  where d.world is not null and d.world->>'sectorId' = p_sector_id;
$$;

-- Already-earned Ashen Sentinel tickets are an independently authorized use.
do $migration$
declare target record;
declare definition text;
declare patched integer := 0;
begin
  for target in select proc.oid,proc.proname from pg_proc proc join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public' and proc.proname in ('read_world_avenger_battle_v1','start_world_avenger_battle_v1')
  loop
    definition := pg_get_functiondef(target.oid);
    if target.proname = 'read_world_avenger_battle_v1' then
      if strpos(definition,'public.read_world_npc_battle_v1(') = 0 then raise exception 'MENTOR_AVENGER_PREDECESSOR_MISSING'; end if;
      definition := replace(definition,'public.read_world_npc_battle_v1(','app_private.read_world_npc_battle_v1(');
    else
      if strpos(definition,'public.start_world_npc_battle_v1(') = 0 then raise exception 'MENTOR_AVENGER_PREDECESSOR_MISSING'; end if;
      definition := replace(definition,'public.start_world_npc_battle_v1(','app_private.start_world_npc_battle_v1(');
    end if;
    execute definition;
    patched := patched + 1;
  end loop;
  if patched <> 2 then raise exception 'MENTOR_AVENGER_PREDECESSOR_MISSING'; end if;
end;
$migration$;

create function app_private.mentor_admission_open_v1(
  p_run app_private.event_runs,p_rule app_private.event_run_mentor_challenges,
  p_character_id uuid,p_training boolean,p_now timestamptz
)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(app_private.personal_quest_run_available_v1(p_run,p_now)
    and exists (select from app_private.npc_designs npc
      where npc.id = (p_rule.rule->>'opponentNpcId')::uuid
        and npc.world#>'{encounter,tags}' = '[]'::jsonb
        and app_private.combat_discovery_opponent_matches_v1(npc.world,p_rule.opponent))
    and case when p_training then exists (
      select from app_private.event_mentor_attempts attempt
      join app_private.world_npc_terminal_receipts terminal using(battle_session_id)
      join app_private.world_npc_battles battle using(battle_session_id)
      where attempt.character_id = p_character_id and attempt.event_key = p_run.event_key
        and battle.npc_id = (p_rule.rule->>'opponentNpcId')::uuid
        and not attempt.training and terminal.outcome = 'defeat'
        and app_private.mentor_defeat_is_eligible_v1(terminal.battle_session_id,p_character_id,terminal.battle_version)
    ) else not exists (
      select from app_private.event_mentor_attempts attempt
      join app_private.event_run_mentor_challenges captured on captured.run_id = attempt.run_id
      left join app_private.world_npc_terminal_receipts terminal using(battle_session_id)
      where attempt.character_id = p_character_id and attempt.event_key = p_run.event_key
        and not attempt.training and (terminal.battle_session_id is null
          or p_now < app_private.repeatable_travel_next_v1(terminal.occurred_at,captured.rule->'recurrence'))
    ) end,false);
$$;

create function public.read_world_mentor_battle_replay_v1(
  p_user_id uuid,p_character_id uuid,p_mentor_run_id uuid,p_training boolean,
  p_command_id uuid,p_world_fingerprint text
)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  previous app_private.world_npc_battles%rowtype;
begin
  if not exists (select from public.characters c where c.id = p_character_id and c.user_id = p_user_id
    and not exists (select from app_private.character_deletion_requests d where d.character_id = c.id)) then
    raise exception using errcode = '42501', message = 'WORLD_NOT_OWNED';
  end if;
  select * into previous from app_private.world_npc_battles battle
  where battle.character_id = p_character_id and battle.command_id = p_command_id;
  if not found then return null; end if;
  if previous.world_fingerprint is distinct from p_world_fingerprint or not exists (
    select from app_private.event_mentor_attempts attempt
    where attempt.battle_session_id = previous.battle_session_id and attempt.run_id = p_mentor_run_id
      and attempt.training = p_training
  ) then
    raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT';
  end if;
  return previous.battle_session_id;
end;
$$;

create function public.read_world_mentor_battle_v1(
  p_user_id uuid,p_character_id uuid,p_expected_version bigint,p_mentor_run_id uuid,p_training boolean
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare npc_id uuid;
begin
  select (mentor.rule->>'opponentNpcId')::uuid into npc_id
  from app_private.event_run_mentor_challenges mentor
  join app_private.event_runs run on run.id = mentor.run_id
  where run.id = p_mentor_run_id and p_training is not null
    and app_private.mentor_admission_open_v1(run,mentor,p_character_id,p_training,statement_timestamp());
  if not found then raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE'; end if;
  return app_private.read_world_npc_battle_v1(p_user_id,p_character_id,npc_id,p_expected_version);
end;
$$;

create function public.start_world_mentor_battle_v1(
  p_user_id uuid,p_character_id uuid,p_expected_version bigint,p_command_id uuid,p_npc_id uuid,
  p_world_fingerprint text,p_request_fingerprint text,p_battle_id text,p_rules_version integer,
  p_content_version integer,p_initial_snapshot jsonb,p_participants jsonb,p_start_snapshot jsonb,
  p_initial_events jsonb,p_privacy_journal jsonb,p_mentor_run_id uuid,p_training boolean
)
returns table(battle_session_id uuid,battle_version bigint,snapshot jsonb,created_at timestamptz,replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare
  mentor app_private.event_run_mentor_challenges%rowtype;
  run app_private.event_runs%rowtype;
  replay_id uuid;
  created record;
begin
  if not pg_try_advisory_xact_lock_shared(hashtextextended('combat-catalogue-publication',0))
    or not pg_try_advisory_xact_lock(hashtextextended(p_user_id::text,0)) then
    raise exception using errcode = 'PT409', message = 'WORLD_STALE_BATTLE_ADMISSION';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
  replay_id := public.read_world_mentor_battle_replay_v1(
    p_user_id,p_character_id,p_mentor_run_id,p_training,p_command_id,p_world_fingerprint
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

  select * into run from app_private.event_runs where id = p_mentor_run_id for share nowait;
  select * into mentor from app_private.event_run_mentor_challenges where run_id = p_mentor_run_id;
  if p_training is null or p_npc_id is distinct from (mentor.rule->>'opponentNpcId')::uuid
    or not app_private.mentor_admission_open_v1(run,mentor,p_character_id,p_training,clock_timestamp()) then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;

  select * into strict created from app_private.start_world_npc_battle_v1(
    p_user_id,p_character_id,p_expected_version,p_command_id,p_npc_id,p_world_fingerprint,
    p_request_fingerprint,p_battle_id,p_rules_version,p_content_version,p_initial_snapshot,
    p_participants,p_start_snapshot,p_initial_events,p_privacy_journal
  );
  if created.replayed then raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT'; end if;
  if not app_private.mentor_admission_open_v1(run,mentor,p_character_id,p_training,created.created_at) then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  insert into app_private.event_mentor_attempts(battle_session_id,run_id,event_key,character_id,training)
  values(created.battle_session_id,run.id,run.event_key,p_character_id,p_training);
  return query select created.battle_session_id,created.battle_version,created.snapshot,created.created_at,created.replayed;
exception when lock_not_available then
  raise exception using errcode = 'PT409', message = 'WORLD_STALE_BATTLE_ADMISSION';
end;
$$;

create function app_private.mentor_reward_v1(
  p_attempt app_private.event_mentor_attempts,p_mentor app_private.event_run_mentor_challenges
)
returns table(outcome text,occurred_at timestamptz,base_xp bigint,bonus_xp bigint)
language sql stable set search_path = '' as $$
  select terminal.outcome,terminal.occurred_at,
    case terminal.outcome when 'victory' then p_mentor.victory_xp else p_mentor.defeat_xp end,
    case when terminal.outcome = 'victory'
      and terminal.occurred_at >= battle.admitted_at
      and terminal.occurred_at <= battle.admitted_at + make_interval(
        secs => (p_mentor.rule#>>'{fastVictory,withinSeconds}')::integer)
      then p_mentor.fast_xp end
  from app_private.world_npc_terminal_receipts terminal
  join app_private.world_npc_battles battle using(battle_session_id)
  where terminal.battle_session_id = p_attempt.battle_session_id
    and terminal.character_id = p_attempt.character_id
    and not p_attempt.training
    and (terminal.outcome = 'victory' or (terminal.outcome = 'defeat'
      and app_private.mentor_defeat_is_eligible_v1(
        terminal.battle_session_id,terminal.character_id,terminal.battle_version)));
$$;

alter function app_private.read_world_personal_quests_v1(uuid,uuid,jsonb,timestamptz)
  rename to read_world_quests_before_mentor_v1;
create function app_private.read_world_personal_quests_v1(
  p_user_id uuid,p_character_id uuid,p_position jsonb,p_now timestamptz
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  previous jsonb;
  choices jsonb;
  idle boolean;
begin
  previous := app_private.read_world_quests_before_mentor_v1(p_user_id,p_character_id,p_position,p_now);
  if not exists (select from app_private.event_run_mentor_challenges) then return previous; end if;
  select app_private.combat_discovery_idle_world_v1(p_user_id,p_character_id,world.state)
    into idle from app_private.character_world_state world where world.character_id = p_character_id;

  with offers as (
    select mentor.run_id as reference,mentor.opponent,definition.definition->>'title' title,
      mentor.rule->>'offer' body,'ready' progress,false pending,
      case when open.challenge then 'challenge-mentor' else 'train-mentor' end action,
      case when open.challenge and open.training then 'train-mentor' end alternative,
      null::timestamptz earned_at
    from app_private.event_run_mentor_challenges mentor
    join app_private.event_runs run on run.id = mentor.run_id
    join app_private.event_definition_versions definition on definition.id = run.definition_version_id
    cross join lateral (select
      app_private.mentor_admission_open_v1(run,mentor,p_character_id,false,p_now) challenge,
      app_private.mentor_admission_open_v1(run,mentor,p_character_id,true,p_now) training
    ) open
    where mentor.opponent->>'sectorId' = p_position->>'sectorId'
      and app_private.personal_quest_run_available_v1(run,p_now)
      and (open.challenge or open.training)
    order by mentor.run_id limit 24
  ), claims as (
    select attempt.battle_session_id as reference,mentor.opponent,definition.definition->>'title' title,
      (mentor.rule->>reward.outcome) || case when reward.bonus_xp is not null
        then ' You earned the fast victory bonus.' else '' end body,
      'completed' progress,true pending,'claim-mentor-reward' action,null::text alternative,
      reward.occurred_at earned_at
    from app_private.event_mentor_attempts attempt
    join app_private.event_run_mentor_challenges mentor on mentor.run_id = attempt.run_id
    join app_private.event_runs run on run.id = mentor.run_id
    join app_private.event_definition_versions definition on definition.id = run.definition_version_id
    cross join lateral app_private.mentor_reward_v1(attempt,mentor) reward
    where attempt.character_id = p_character_id and not attempt.training and attempt.awarded_xp is null
    order by reward.occurred_at,attempt.battle_session_id limit 24
  ), visible as (
    select * from claims union all select * from offers
    order by pending desc,earned_at,reference limit 24
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'mentor',true,'runId',reference,'title',title,'speaker',opponent->>'name',
    'giverId',opponent->>'id','portraitRef',opponent->'portraitRef','portraitUrl',opponent->'imageUrl',
    'progress',progress,'body',body,'rewardPending',pending,
    'local',coalesce(idle and app_private.combat_discovery_in_reach_v1(p_position,opponent),false),
    'action',action,'alternativeAction',alternative,
    'destination',jsonb_build_object('sectorId',opponent->'sectorId','x',opponent->'x','y',opponent->'y')
  ) order by pending desc,earned_at,reference),'[]'::jsonb) into choices from visible;
  return previous || choices;
end;
$$;

create function public.claim_world_mentor_reward_v1(
  p_user_id uuid,p_character_id uuid,p_expected_version bigint,p_command_id uuid,
  p_mentor_battle_id uuid,p_request_fingerprint text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  world app_private.character_world_state%rowtype;
  attempt app_private.event_mentor_attempts%rowtype;
  mentor app_private.event_run_mentor_challenges%rowtype;
  reward record;
  component record;
  xp record;
  reward_key text;
  awarded bigint := 0;
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
  select * into attempt from app_private.event_mentor_attempts
    where character_id = p_character_id and claim_command_id = p_command_id;
  if found then
    if attempt.battle_session_id is distinct from p_mentor_battle_id
      or attempt.claim_fingerprint is distinct from p_request_fingerprint then
      raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT';
    end if;
    return world.state;
  end if;
  if world.last_command_id = p_command_id then raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT'; end if;
  if (world.state->>'version')::bigint is distinct from p_expected_version then
    raise exception using errcode = 'PT409', message = 'WORLD_STALE_VERSION';
  end if;
  select * into attempt from app_private.event_mentor_attempts
    where battle_session_id = p_mentor_battle_id and character_id = p_character_id for update;
  if not found or attempt.awarded_xp is not null or attempt.training
    or not app_private.combat_discovery_idle_world_v1(p_user_id,p_character_id,world.state) then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  select * into mentor from app_private.event_run_mentor_challenges where run_id = attempt.run_id;
  if not app_private.combat_discovery_in_reach_v1(world.state->'position',mentor.opponent) then
    raise exception using errcode = '22023', message = 'WORLD_NPC_CHALLENGE_OUT_OF_RANGE';
  end if;
  select * into reward from app_private.mentor_reward_v1(attempt,mentor);
  if not found then raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE'; end if;

  world.state := public.commit_world_state_v1(p_user_id,p_character_id,p_expected_version,
    p_command_id,'interact',world.state,p_request_fingerprint);
  for component in select * from (values ('base',reward.base_xp),('fast-victory',reward.bonus_xp)) as part(kind,amount)
    where amount is not null order by kind
  loop
    reward_key := md5(jsonb_build_array('event.mentor',attempt.battle_session_id,component.kind)::text);
    select * into xp from public.grant_character_xp_v1(
      p_character_id,reward_key::uuid,reward_key,'system:event-quest','gameplay',
      'event.mentor:' || reward_key,'event.quest.reward',component.amount
    );
    if not found or xp.grant_id is null then raise exception 'WORLD_QUEST_REWARD_UNAVAILABLE'; end if;
    awarded := awarded + xp.applied_amount;
  end loop;
  update app_private.event_mentor_attempts set awarded_xp = awarded,
    claim_command_id = p_command_id,claim_fingerprint = p_request_fingerprint
  where battle_session_id = attempt.battle_session_id;
  return world.state;
end;
$$;

revoke all on function
  app_private.mentor_defeat_is_eligible_v1(uuid,uuid,bigint),
  app_private.mentor_opponent_reserved_v1(uuid,timestamptz),
  app_private.read_world_npc_battle_v1(uuid,uuid,uuid,bigint),
  app_private.start_world_npc_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function
  public.read_world_npc_battle_v1(uuid,uuid,uuid,bigint),
  public.start_world_npc_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function
  public.read_world_npc_battle_v1(uuid,uuid,uuid,bigint),
  public.start_world_npc_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)
  to service_role;

revoke all on function
  app_private.assert_event_mentor_v1(jsonb),
  app_private.assert_event_runtime_supported_v1(jsonb),
  app_private.assert_event_runtime_before_mentor_v1(jsonb),
  app_private.capture_event_mentor_v1(),
  app_private.mentor_admission_open_v1(app_private.event_runs,app_private.event_run_mentor_challenges,uuid,boolean,timestamptz),
  app_private.mentor_reward_v1(app_private.event_mentor_attempts,app_private.event_run_mentor_challenges),
  app_private.read_world_quests_before_mentor_v1(uuid,uuid,jsonb,timestamptz),
  app_private.read_world_personal_quests_v1(uuid,uuid,jsonb,timestamptz)
  from public,anon,authenticated,service_role;
revoke all on function
  public.read_world_mentor_battle_v1(uuid,uuid,bigint,uuid,boolean),
  public.read_world_mentor_battle_replay_v1(uuid,uuid,uuid,boolean,uuid,text),
  public.start_world_mentor_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,boolean),
  public.claim_world_mentor_reward_v1(uuid,uuid,bigint,uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function
  public.read_world_mentor_battle_v1(uuid,uuid,bigint,uuid,boolean),
  public.read_world_mentor_battle_replay_v1(uuid,uuid,uuid,boolean,uuid,text),
  public.start_world_mentor_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,boolean),
  public.claim_world_mentor_reward_v1(uuid,uuid,bigint,uuid,uuid,text)
  to service_role;

commit;
