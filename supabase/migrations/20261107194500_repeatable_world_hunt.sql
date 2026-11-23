begin;

-- Legacy travel continues to capture a destination. Hunts have no walk
-- checkpoint and use the same private attempt, receipt and cooldown path.
alter table app_private.event_run_repeatable_travel
  alter column destination drop not null,
  add column hunt_giver jsonb,
  add column hunt_reward_amount bigint check (hunt_reward_amount > 0),
  add constraint event_repeatable_hunt_capture_valid check (
    (destination is null and hunt_giver is not null and hunt_reward_amount is not null)
    or (destination is not null and hunt_giver is null and hunt_reward_amount is null)
  );

alter table app_private.event_repeatable_travel_attempts
  add column hunt_reward_amount bigint check (
    hunt_reward_amount is null or (hunt_reward_amount > 0 and completed_at is not null)
  ),
  add column awarded_xp bigint check (
    awarded_xp is null or (awarded_xp >= 0 and hunt_reward_amount is not null and awarded_xp <= hunt_reward_amount)
  );
create index event_repeatable_hunt_pending_idx on app_private.event_repeatable_travel_attempts(character_id)
  where hunt_reward_amount is not null and awarded_xp is null;
create index world_npc_battles_hunt_window_idx
  on app_private.world_npc_battles(character_id,admitted_at);
create index event_run_transitions_hunt_window_idx
  on app_private.event_run_transitions(run_id,occurred_at desc,id desc);

create or replace function app_private.assert_repeatable_travel_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  travel jsonb := p_definition->'repeatableTravel';
  journey jsonb := travel->'journey';
  recurrence jsonb := travel->'recurrence';
  hunt boolean := journey->>'type' = 'defeat-and-report';
  giver jsonb;
  line text;
begin
  if jsonb_typeof(travel) is distinct from 'object'
    or (travel - array['journey','recurrence']) <> '{}'::jsonb
    or p_definition->>'category' is distinct from 'repeatable-activities'
    or p_definition ? 'personalJourney'
    or jsonb_typeof(journey) is distinct from 'object'
    or not coalesce(journey->>'type' in ('travel-and-report','defeat-and-report'),false)
    or (not hunt and (journey - array['type','giverId','destination','offer','active','ready','completed']) <> '{}'::jsonb)
    or coalesce(p_definition->'rewardPackageRefs','[]'::jsonb) <> '[]'::jsonb
    or coalesce(p_definition->'aftermathRefs','[]'::jsonb) <> '[]'::jsonb
    or jsonb_typeof(recurrence) is distinct from 'object'
    or not coalesce(recurrence->>'mode' in ('rolling-24h','calendar-day','calendar-week'), false)
    or exists (select 1 from app_private.event_definition_versions previous
      where previous.event_key = p_definition->>'eventKey' and not (previous.definition ? 'repeatableTravel')) then
    raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_TRAVEL_INVALID';
  end if;
  if recurrence->>'mode' = 'rolling-24h' then
    if (recurrence - 'mode') <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_RECURRENCE_INVALID';
    end if;
  elsif (recurrence - array['mode','timeZone','resetMinute']) <> '{}'::jsonb
    or jsonb_typeof(recurrence->'timeZone') is distinct from 'string'
    or not exists (select 1 from pg_timezone_names where name = recurrence->>'timeZone')
    or jsonb_typeof(recurrence->'resetMinute') is distinct from 'number'
    or coalesce(recurrence->>'resetMinute','') !~ '^[0-9]{1,4}$'
    or (recurrence->>'resetMinute')::integer not between 0 and 1439 then
    raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_RECURRENCE_INVALID';
  end if;
  if not hunt then
    perform app_private.assert_event_personal_journey_v1(
      p_definition || jsonb_build_object('category','story-campaigns','personalJourney',journey)
    );
    return;
  end if;

  if (journey - array['type','giverId','npcTag','requiredDefeats','rewardPackageRef','offer','active','ready','completed']) <> '{}'::jsonb
    or jsonb_typeof(journey->'giverId') is distinct from 'string'
    or not coalesce(journey->>'giverId' ~ app_private.personal_realm_npc_id_pattern_v1(),false)
    or jsonb_typeof(journey->'npcTag') is distinct from 'string'
    or not coalesce(journey->>'npcTag' ~ '^[a-z][a-z0-9-]{1,31}$',false)
    or jsonb_typeof(journey->'requiredDefeats') is distinct from 'number'
    or not coalesce(journey->>'requiredDefeats' ~ '^([1-9]|1[0-9]|2[0-5])$',false)
    or p_definition#>>'{scope,type}' is distinct from 'global'
    or jsonb_array_length(p_definition->'phases') <> 1
    or p_definition#>>'{phases,0,transition,type}' is distinct from 'manual'
    or jsonb_array_length(coalesce(p_definition#>'{phases,0,objectives}','[]')) <> 0
    or jsonb_array_length(coalesce(p_definition#>'{phases,0,effects}','[]')) <> 0
    or jsonb_array_length(coalesce(p_definition#>'{phases,0,cleanupEffects}','[]')) <> 0 then
    raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_HUNT_INVALID';
  end if;

  giver := app_private.event_personal_quest_giver_v1(journey->>'giverId');
  if giver is null then
    raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_HUNT_GIVER_UNAVAILABLE';
  end if;
  if not exists (
    select 1 from app_private.npc_designs npc
    where npc.world->>'sectorId' not like 'sealed-realm:%'
      and app_private.valid_npc_world_encounter_v1(npc.world->'encounter')
      and npc.world#>'{encounter,tags}' ? (journey->>'npcTag')
  ) then
    raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_HUNT_TARGET_UNAVAILABLE';
  end if;
  if jsonb_typeof(journey->'rewardPackageRef') is distinct from 'string'
    or app_private.personal_restoration_reward_amount_v1(journey->>'rewardPackageRef') is null then
    raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_HUNT_REWARD_UNAVAILABLE';
  end if;
  foreach line in array array['offer','active','ready','completed'] loop
    if jsonb_typeof(journey->line) is distinct from 'string'
      or char_length(journey->>line) not between 1 and 800
      or btrim(journey->>line) is distinct from journey->>line then
      raise exception using errcode = '22023', message = 'EVENT_REPEATABLE_HUNT_INVALID';
    end if;
  end loop;
end;
$$;

create or replace function app_private.capture_repeatable_travel_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  definition jsonb;
  travel jsonb;
  journey jsonb;
  giver jsonb;
  giver_position jsonb;
  is_hunt boolean;
begin
  if new.run_mode <> 'production' then return new; end if;
  select version.definition into definition
  from app_private.event_definition_versions version where version.id = new.definition_version_id;
  if not (definition ? 'repeatableTravel') then return new; end if;
  travel := definition->'repeatableTravel';
  journey := travel->'journey';
  is_hunt := journey->>'type' = 'defeat-and-report';
  if is_hunt and journey->>'giverId' ~ app_private.personal_realm_npc_id_pattern_v1() then
    select story into giver from app_private.npc_designs where id = (journey->>'giverId')::uuid for share;
  end if;
  perform app_private.assert_repeatable_travel_v1(definition);
  giver_position := app_private.event_personal_quest_giver_v1(journey->>'giverId');
  insert into app_private.event_run_repeatable_travel(
    run_id, journey, giver_position, destination, recurrence, hunt_giver, hunt_reward_amount
  ) values (
    new.id, journey, giver_position,
    case when not is_hunt then jsonb_build_object(
      'sectorId', journey#>'{destination,sectorId}', 'x', journey#>'{destination,x}', 'y', journey#>'{destination,y}'
    ) end,
    travel->'recurrence',
    case when is_hunt then jsonb_build_object(
      'name',giver->'name','portraitRef',giver->'portraitRef','imageUrl',giver->'imageUrl'
    ) end,
    case when is_hunt then app_private.personal_restoration_reward_amount_v1(journey->>'rewardPackageRef') end
  );
  return new;
end;
$$;

create function app_private.repeatable_hunt_run_status_at_v1(
  p_run app_private.event_runs,p_at timestamptz
)
returns text language sql stable set search_path = '' as $$
  select case when p_run.run_mode <> 'production' or p_run.started_at is null or p_run.started_at > p_at then null
    when p_run.scheduled_end_at <= p_at then 'expired'
    else (
      select transition.to_status from app_private.event_run_transitions transition
      where transition.run_id = p_run.id and transition.occurred_at <= p_at
      order by transition.occurred_at desc, transition.id desc
      limit 1
    ) end;
$$;

-- The canonical terminal receipt is unique per admission and includes
-- legitimate wins from any combat mechanic. An encounter
-- admitted during live time can settle after a pause, but one started during
-- a pause cannot count even if its terminal result arrives after resumption.
create function app_private.repeatable_hunt_progress_v1(
  p_attempt app_private.event_repeatable_travel_attempts,
  p_travel app_private.event_run_repeatable_travel,
  p_run app_private.event_runs,
  p_now timestamptz
)
returns table(defeats integer, ready_at timestamptz) language sql stable set search_path = '' as $$
  select count(*)::integer,
    case when count(*) = (p_travel.journey->>'requiredDefeats')::integer then max(qualified.occurred_at) end
  from (
    select terminal.occurred_at
    from app_private.world_npc_battles battle
    join app_private.world_npc_terminal_receipts terminal using(battle_session_id)
    where battle.character_id = p_attempt.character_id
      and battle.admitted_at >= p_attempt.accepted_at
      and app_private.repeatable_hunt_run_status_at_v1(p_run,battle.admitted_at) = 'live'
      and battle.tags ? (p_travel.journey->>'npcTag')
      and terminal.outcome = 'victory'
      and terminal.occurred_at between battle.admitted_at and p_now
    order by terminal.occurred_at, battle.battle_session_id
    limit (p_travel.journey->>'requiredDefeats')::integer
  ) qualified;
$$;

-- The World commit rejects interactions during active battles. After it succeeds,
-- all visible wins may protect a prior Hunt, even when its terminal receipt
-- arrived between sampling the acceptance clock and the shared World check.
create or replace function app_private.repeatable_travel_can_accept_v1(
  p_character_id uuid, p_event_key text, p_at timestamptz
)
returns boolean language sql stable set search_path = '' as $$
  select not exists (
    select 1 from app_private.event_repeatable_travel_attempts attempt
    join app_private.event_runs run on run.id = attempt.run_id
    join app_private.event_run_repeatable_travel travel on travel.run_id = run.id
    where attempt.character_id = p_character_id and attempt.event_key = p_event_key
      and (attempt.next_available_at > p_at or (
        attempt.completed_at is null and attempt.expired_at is null and (
          app_private.personal_quest_attempt_is_current_v1(run,p_at) or (
            travel.hunt_giver is not null and exists (
              select 1 from app_private.repeatable_hunt_progress_v1(attempt,travel,run,'infinity'::timestamptz) progress
              where progress.ready_at is not null
            )
          )
        )
      ))
  );
$$;

create or replace function app_private.read_world_repeatable_travel_v1(
  p_user_id uuid, p_character_id uuid, p_position jsonb, p_now timestamptz
)
returns jsonb language sql stable set search_path = '' as $$
  with offers as (
    select run.id reference_id, run.id run_id, null::timestamptz accepted_at, null::timestamptz arrived_at,
      null::timestamptz next_available_at, false reward_pending, null::bigint awarded_xp
    from app_private.event_run_repeatable_travel travel
    join app_private.event_runs run on run.id = travel.run_id
    where travel.giver_position = p_position and app_private.personal_quest_run_available_v1(run,p_now)
      and app_private.repeatable_travel_can_accept_v1(p_character_id,run.event_key,p_now)
      and (travel.hunt_giver is null
        or app_private.event_personal_quest_giver_v1(travel.journey->>'giverId') = travel.giver_position)
  ), known as (
    select attempt.id reference_id, attempt.run_id, attempt.accepted_at, attempt.arrived_at, attempt.next_available_at,
      attempt.hunt_reward_amount is not null and attempt.awarded_xp is null reward_pending, attempt.awarded_xp
    from app_private.event_repeatable_travel_attempts attempt
    join app_private.event_runs run on run.id = attempt.run_id
    join app_private.event_run_repeatable_travel travel on travel.run_id = run.id
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id and attempt.expired_at is null
      and (attempt.next_available_at > p_now
        or (attempt.hunt_reward_amount is not null and attempt.awarded_xp is null)
        or (attempt.completed_at is null and (
          app_private.personal_quest_attempt_is_current_v1(run,p_now) or (
            travel.hunt_giver is not null and exists (
              select 1 from app_private.repeatable_hunt_progress_v1(attempt,travel,run,p_now) hunt
              where hunt.ready_at is not null
            )
          )
        )))
  ), visible as (
    select steps.*, travel, travel.journey, travel.destination, travel.giver_position, travel.hunt_giver, run,
      version.definition->>'title' title, app_private.personal_quest_run_available_v1(run,p_now) available,
      travel.hunt_giver is null or
        app_private.event_personal_quest_giver_v1(travel.journey->>'giverId') is not distinct from travel.giver_position giver_current
    from (select * from known union all select * from offers) steps
    join app_private.event_run_repeatable_travel travel on travel.run_id = steps.run_id
    join app_private.event_runs run on run.id = steps.run_id
    join app_private.event_definition_versions version on version.id = run.definition_version_id
    order by steps.reward_pending desc, (steps.next_available_at is not null), steps.accepted_at desc nulls first, steps.reference_id
    limit 48
  ), progress as (
    select visible.*, hunt.defeats, coalesce(visible.arrived_at,hunt.ready_at) ready_at,
      hunt.ready_at is not null and coalesce(app_private.repeatable_hunt_run_status_at_v1(visible.run,p_now)
        in ('expired','resolving','ended','cancelled','emergency-stopped','archived'),false) ready_grace
    from visible
    left join app_private.event_repeatable_travel_attempts attempt on attempt.id = visible.reference_id
    left join lateral (
      select * from app_private.repeatable_hunt_progress_v1(attempt,visible.travel,visible.run,p_now)
      where visible.hunt_giver is not null and visible.accepted_at is not null and visible.next_available_at is null
    ) hunt on true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'runId', reference_id,
    'title', title,
    'giverId', journey->>'giverId',
    'progress', case when next_available_at is not null then 'completed'
      when ready_at is not null then 'ready' when accepted_at is not null then 'active' else 'available' end,
    'body', case when next_available_at is not null then journey->>'completed'
      when ready_grace then journey->>'ready'
      when not giver_current then 'The hunt giver is no longer available here.'
      when not available then 'This activity is currently paused.'
      when ready_at is not null then journey->>'ready'
      when accepted_at is not null then journey->>'active' else journey->>'offer' end,
    'nextAvailableAt', next_available_at,
    'destination', case when reward_pending or ready_grace then giver_position
      when not available or not giver_current or accepted_at is null or next_available_at is not null then null
      when ready_at is not null then giver_position else destination end,
    'local', giver_position = p_position,
    'action', case when giver_position <> p_position then null when reward_pending then 'claim-hunt-reward'
      when ready_grace then 'report'
      when not available or not giver_current or next_available_at is not null then null
      when accepted_at is null then 'accept' when ready_at is not null then 'report' else null end
  ) || case when hunt_giver is null then '{}'::jsonb else jsonb_build_object(
    'speaker',hunt_giver->>'name','portraitRef',hunt_giver->>'portraitRef','portraitUrl',hunt_giver->>'imageUrl'
  ) || case when defeats is null then '{}'::jsonb else jsonb_build_object(
    'defeats',defeats,'requiredDefeats',(journey->>'requiredDefeats')::integer
  ) end || case when reward_pending then jsonb_build_object('rewardPending',true)
    when awarded_xp is not null then jsonb_build_object('awardedXp',awarded_xp)
    else '{}'::jsonb end end
  order by reward_pending desc, (next_available_at is not null), accepted_at desc nulls first, reference_id), '[]'::jsonb)
  from progress;
$$;

create function public.commit_world_repeatable_activity_v2(
  p_user_id uuid, p_character_id uuid, p_expected_version bigint, p_command_id uuid,
  p_reference_id uuid, p_action text, p_request_fingerprint text, p_received_at timestamptz
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  world app_private.character_world_state%rowtype;
  current_run app_private.event_runs%rowtype;
  travel app_private.event_run_repeatable_travel%rowtype;
  attempt app_private.event_repeatable_travel_attempts%rowtype;
  previous_fingerprint text;
  received_at timestamptz;
  action_at timestamptz;
  selected_run uuid;
  ready_at timestamptz;
  hunt_status text;
  hunt_grace boolean := false;
  reward_key text;
  xp record;
  command_name constant text := 'event.repeatable-travel.v1';
begin
  if p_action is null or p_action not in ('accept','report','claim-hunt-reward')
    or p_command_id is null or p_request_fingerprint is null then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  -- The service can preserve its server receipt across waits before the RPC.
  -- The database sample caps future skew and supplies the fallback for v1.
  if p_action = 'report' then
    received_at := least(p_received_at,app_private.repeatable_travel_now_v1());
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
  perform 1 from public.characters character where character.id = p_character_id
    and character.user_id = p_user_id for update;
  if not found or exists (select 1 from app_private.character_deletion_requests
    where character_id = p_character_id) then
    raise exception using errcode = '42501', message = 'WORLD_NOT_OWNED';
  end if;
  select * into world from app_private.character_world_state where character_id = p_character_id for update;
  if not found then raise exception 'WORLD_STATE_UNAVAILABLE'; end if;
  select receipt.request_fingerprint into previous_fingerprint
  from app_private.idempotency_records receipt where receipt.actor_key = p_character_id::text
    and receipt.command_name = 'event.repeatable-travel.v1' and receipt.idempotency_key = p_command_id;
  if found then
    if previous_fingerprint is distinct from p_request_fingerprint then
      raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT';
    end if;
    return world.state;
  end if;
  if world.last_command_id = p_command_id then
    raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT';
  end if;
  if (world.state->>'version')::bigint is distinct from p_expected_version then
    raise exception using errcode = 'PT409', message = 'WORLD_STALE_VERSION';
  end if;

  if p_action in ('report','claim-hunt-reward') then
    select * into attempt from app_private.event_repeatable_travel_attempts
      where id = p_reference_id and character_id = p_character_id and user_id = p_user_id;
    selected_run := attempt.run_id;
  else
    selected_run := p_reference_id;
  end if;
  select * into current_run from app_private.event_runs where id = selected_run for update;
  action_at := app_private.repeatable_travel_now_v1();
  if not found then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  select * into travel from app_private.event_run_repeatable_travel where run_id = selected_run;
  if not found then raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE'; end if;
  if p_action = 'report' and travel.hunt_reward_amount is not null then
    action_at := received_at;
    hunt_status := app_private.repeatable_hunt_run_status_at_v1(current_run,action_at);
    hunt_grace := coalesce(hunt_status in ('expired','resolving','ended','cancelled','emergency-stopped','archived'),false);
    if hunt_status is distinct from 'live' and not hunt_grace then
      raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
    end if;
  elsif p_action <> 'claim-hunt-reward'
    and not app_private.personal_quest_run_available_v1(current_run,action_at) then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  if world.state->'position' is distinct from travel.giver_position
    or jsonb_array_length(world.state->'route') <> 0 then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_OUT_OF_RANGE';
  end if;

  if travel.hunt_reward_amount is not null and p_action <> 'claim-hunt-reward' and not hunt_grace then
    perform 1 from app_private.npc_designs where id = (travel.journey->>'giverId')::uuid for share;
    if app_private.event_personal_quest_giver_v1(travel.journey->>'giverId') is distinct from travel.giver_position then
      raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
    end if;
  end if;

  if p_action = 'report' and attempt.completed_at is null and attempt.expired_at is null then
    ready_at := attempt.arrived_at;
    if travel.hunt_reward_amount is not null then
      select progress.ready_at into ready_at from app_private.repeatable_hunt_progress_v1(
        attempt,travel,current_run,action_at
      ) progress;
    end if;
  end if;

  world.state := public.commit_world_state_v1(p_user_id,p_character_id,p_expected_version,
    p_command_id,'interact',world.state,p_request_fingerprint);

  if p_action = 'accept' and app_private.repeatable_travel_can_accept_v1(p_character_id,current_run.event_key,action_at) then
    update app_private.event_repeatable_travel_attempts prior set expired_at = action_at
    from app_private.event_runs original where original.id = prior.run_id
      and prior.character_id = p_character_id and prior.event_key = current_run.event_key
      and prior.completed_at is null and prior.expired_at is null
      and not app_private.personal_quest_attempt_is_current_v1(original,action_at);
    insert into app_private.event_repeatable_travel_attempts(run_id,event_key,user_id,character_id,accepted_at)
    values(selected_run,current_run.event_key,p_user_id,p_character_id,action_at);
  elsif p_action = 'report' and ready_at <= action_at then
    -- Hunt readiness uses the final qualifying receipt time. The cooldown and
    -- durable entitlement are committed together at turn-in, never at collection.
    update app_private.event_repeatable_travel_attempts
      set arrived_at = ready_at,
        completed_at = action_at,
        next_available_at = app_private.repeatable_travel_next_v1(action_at,travel.recurrence),
        hunt_reward_amount = travel.hunt_reward_amount
      where id = attempt.id;
  elsif p_action = 'claim-hunt-reward' and attempt.hunt_reward_amount is not null
    and attempt.awarded_xp is null then
    reward_key := md5(jsonb_build_array('event.repeatable-hunt',attempt.id,travel.journey->>'rewardPackageRef')::text);
    select * into xp from public.grant_character_xp_v1(
      p_character_id,reward_key::uuid,reward_key,'system:event-quest','gameplay',
      'event.repeatable-hunt:' || reward_key,'event.quest.reward',attempt.hunt_reward_amount
    );
    if not found or xp.grant_id is null then raise exception 'WORLD_QUEST_REWARD_UNAVAILABLE'; end if;
    update app_private.event_repeatable_travel_attempts set awarded_xp = xp.applied_amount
    where id = attempt.id;
  else
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;

  insert into app_private.idempotency_records(actor_key,command_name,idempotency_key,request_fingerprint,result)
  values(p_character_id::text,command_name,p_command_id,p_request_fingerprint,'{}'::jsonb);
  return world.state;
end;
$$;

create or replace function public.commit_world_repeatable_travel_v1(
  p_user_id uuid, p_character_id uuid, p_expected_version bigint, p_command_id uuid,
  p_reference_id uuid, p_action text, p_request_fingerprint text
)
returns jsonb language sql security definer set search_path = '' as $$
  select public.commit_world_repeatable_activity_v2(p_user_id,p_character_id,p_expected_version,
    p_command_id,p_reference_id,p_action,p_request_fingerprint,null::timestamptz);
$$;

revoke all on function public.commit_world_repeatable_activity_v2(uuid,uuid,bigint,uuid,uuid,text,text,timestamptz)
  from public,anon,authenticated,service_role;
grant execute on function public.commit_world_repeatable_activity_v2(uuid,uuid,bigint,uuid,uuid,text,text,timestamptz)
  to service_role;

revoke all on function app_private.repeatable_hunt_progress_v1(
  app_private.event_repeatable_travel_attempts,app_private.event_run_repeatable_travel,
  app_private.event_runs,timestamptz
) from public,anon,authenticated,service_role;
revoke all on function app_private.repeatable_hunt_run_status_at_v1(app_private.event_runs,timestamptz)
  from public,anon,authenticated,service_role;

commit;
