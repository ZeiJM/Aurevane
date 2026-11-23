begin;

-- Recovery keeps its existing choice/arrival receipt. A trial cannot set those
-- fields, so walking through the checkpoint can never qualify the other route.
alter table app_private.event_personal_quest_attempts
  drop constraint event_personal_quest_attempts_check7,
  add column restoration_trial_selected_at timestamptz,
  add constraint personal_restoration_trial_choice_valid check (
    restoration_trial_selected_at is null or (
      completed_at is not null and restoration_trial_selected_at >= completed_at
      and restoration_selected_at is null
    )
  ),
  add constraint personal_restoration_settled_valid check (
    restoration_settled_at is null
    or (restoration_arrived_at is not null and restoration_settled_at >= restoration_arrived_at)
    or (restoration_trial_selected_at is not null and restoration_settled_at >= restoration_trial_selected_at)
  );

alter table app_private.personal_restoration_commands
  drop constraint personal_restoration_commands_action_check,
  add constraint personal_restoration_commands_action_check check (
    action in ('choose-restoration','choose-restoration-trial','restore-item','claim-restoration')
  );
create index personal_restoration_open_trial_idx
  on app_private.event_personal_quest_attempts(character_id,restoration_trial_selected_at,id)
  where restoration_trial_selected_at is not null and restoration_settled_at is null;

-- An admission belongs to at most one attempt. Failed challenges can be
-- retried without replacing or reinterpreting an earlier admission.
create table app_private.personal_restoration_trial_battles (
  battle_session_id uuid primary key references app_private.world_npc_battles(battle_session_id) on delete cascade,
  attempt_id uuid not null references app_private.event_personal_quest_attempts(id) on delete cascade
);
create index personal_restoration_trial_battles_attempt_idx
  on app_private.personal_restoration_trial_battles(attempt_id);
alter table app_private.personal_restoration_trial_battles enable row level security;
revoke all on app_private.personal_restoration_trial_battles from public,anon,authenticated,service_role;

create function app_private.personal_restoration_trial_target_v1(p_npc_id text)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'revision',world->'revision',
    'position',jsonb_build_object('sectorId',world->'sectorId','x',world->'x','y',world->'y')
  )
  from app_private.npc_designs
  where id = case when p_npc_id ~ app_private.personal_realm_npc_id_pattern_v1() then p_npc_id::uuid end
    and world->>'sectorId' not like 'sealed-realm:%'
    and app_private.valid_npc_world_encounter_v1(world->'encounter');
$$;

create function app_private.personal_restoration_reward_amount_v1(p_ref text)
returns bigint language sql stable set search_path = '' as $$
  select package.amount
  from app_private.event_reward_packages package
  join app_private.event_reward_budget_policies budget using (budget_ref)
  where package.reward_package_ref = p_ref and package.reward_kind = 'character-xp'
    and budget.reward_kind = package.reward_kind and package.amount between 1 and budget.max_per_claim;
$$;

alter function app_private.assert_event_inventory_discovery_v1(jsonb)
  rename to assert_event_inventory_discovery_before_restoration_trial_v1;
create function app_private.assert_event_inventory_discovery_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  restoration jsonb := p_definition#>'{inventoryDiscovery,restoration}';
  trial jsonb := restoration->'trial';
  recovery_ref text := restoration->>'recoveryRewardPackageRef';
  trial_ref text := trial->>'rewardPackageRef';
  recovery_amount bigint;
  trial_amount bigint;
  line text;
begin
  perform app_private.assert_event_inventory_discovery_before_restoration_trial_v1(
    case when jsonb_typeof(restoration) = 'object' then
      jsonb_set(p_definition,'{inventoryDiscovery,restoration}',restoration - array['trial','recoveryRewardPackageRef'])
    else p_definition end
  );
  if trial is null and not coalesce(restoration ? 'recoveryRewardPackageRef',false) then return; end if;
  if trial is null then
    raise exception using errcode = '22023', message = 'EVENT_INVENTORY_RESTORATION_REWARDS_INVALID';
  end if;
  if jsonb_typeof(trial) is distinct from 'object'
    or (trial - array['npcId','offer','active','ready','rewardPackageRef']) <> '{}'::jsonb
    or jsonb_typeof(trial->'npcId') is distinct from 'string'
    or not coalesce(trial->>'npcId' ~ app_private.personal_realm_npc_id_pattern_v1(),false) then
    raise exception using errcode = '22023', message = 'EVENT_INVENTORY_RESTORATION_TRIAL_INVALID';
  end if;
  foreach line in array array['offer','active','ready'] loop
    if jsonb_typeof(trial->line) is distinct from 'string'
      or char_length(trial->>line) not between 1 and 800
      or btrim(trial->>line) is distinct from trial->>line then
      raise exception using errcode = '22023', message = 'EVENT_INVENTORY_RESTORATION_TRIAL_INVALID';
    end if;
  end loop;
  if app_private.personal_restoration_trial_target_v1(trial->>'npcId') is null then
    raise exception using errcode = '22023', message = 'EVENT_INVENTORY_RESTORATION_TRIAL_NPC_UNAVAILABLE';
  end if;
  recovery_amount := app_private.personal_restoration_reward_amount_v1(recovery_ref);
  trial_amount := app_private.personal_restoration_reward_amount_v1(trial_ref);
  if jsonb_typeof(restoration->'recoveryRewardPackageRef') is distinct from 'string'
    or jsonb_typeof(trial->'rewardPackageRef') is distinct from 'string'
    or recovery_ref = trial_ref or recovery_amount is null or trial_amount is null
    or recovery_amount = trial_amount then
    raise exception using errcode = '22023', message = 'EVENT_INVENTORY_RESTORATION_REWARDS_INVALID';
  end if;
end; $$;

-- Run after the existing capture has saved the validated recovery journey.
-- Keep the published revision and placement, and pin each immutable XP amount.
create function app_private.pin_inventory_restoration_trial_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  restoration jsonb;
  trial jsonb;
  target jsonb;
begin
  if new.run_mode <> 'production' then return new; end if;
  select journey->'restoration' into restoration
    from app_private.event_run_personal_journeys where run_id = new.id;
  trial := restoration->'trial';
  if trial is null then return new; end if;
  perform 1 from app_private.npc_designs where id = (trial->>'npcId')::uuid for share;
  target := app_private.personal_restoration_trial_target_v1(trial->>'npcId');
  if target is null then
    raise exception using errcode = '22023', message = 'EVENT_INVENTORY_RESTORATION_TRIAL_NPC_UNAVAILABLE';
  end if;
  update app_private.event_run_personal_journeys
    set journey = jsonb_set(journey,'{restoration}',restoration || jsonb_build_object(
      'trialTarget',target,
      'trialRewardAmount',app_private.personal_restoration_reward_amount_v1(trial->>'rewardPackageRef'),
      'recoveryRewardAmount',app_private.personal_restoration_reward_amount_v1(restoration->>'recoveryRewardPackageRef')
    ))
    where run_id = new.id;
  return new;
end; $$;
create trigger pin_inventory_restoration_trial_v1
after insert on app_private.event_runs
for each row execute function app_private.pin_inventory_restoration_trial_v1();

create function app_private.personal_restoration_trial_status_v1(p_attempt_id uuid)
returns table(won boolean, in_battle boolean)
language sql stable set search_path = '' as $$
  select coalesce(bool_or(receipt.outcome = 'victory'),false),
    coalesce(bool_or(battle.lifecycle in ('pending','active')),false)
  from app_private.personal_restoration_trial_battles link
  join app_private.battle_sessions battle on battle.id = link.battle_session_id
  left join app_private.world_npc_terminal_receipts receipt on receipt.battle_session_id = link.battle_session_id
  where link.attempt_id = p_attempt_id;
$$;

-- A character can reserve a current opponent for only one unresolved trial.
-- A paused trial may resume, and an already admitted battle can finish after closure.
create function app_private.personal_restoration_trial_reserved_v1(
  p_user_id uuid,p_character_id uuid,p_attempt_id uuid,p_npc_id text,p_target jsonb,p_now timestamptz
)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
    from app_private.event_personal_quest_attempts other
    join app_private.event_run_personal_journeys quest on quest.run_id = other.run_id
    join app_private.event_runs run on run.id = other.run_id
    cross join lateral app_private.personal_restoration_trial_status_v1(other.id) evidence
    where other.character_id = p_character_id and other.user_id = p_user_id and other.id <> p_attempt_id
      and other.restoration_trial_selected_at is not null and other.restoration_settled_at is null
      and quest.journey#>>'{restoration,trial,npcId}' = p_npc_id
      and not evidence.won and (
        evidence.in_battle
        or (quest.journey#>'{restoration,trialTarget}' = p_target
          and app_private.personal_quest_attempt_is_current_v1(run,p_now))
      )
  );
$$;

-- The canonical starter inserts its World admission before appending startup
-- events. Bind here so a victory at startup counts, without adding any work
-- or quest-row locks to the canonical battle terminal writer.
create function app_private.bind_personal_restoration_trial_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into app_private.personal_restoration_trial_battles(battle_session_id,attempt_id)
  select new.battle_session_id,attempt.id
  from app_private.event_personal_quest_attempts attempt
  join public.characters character on character.id = attempt.character_id and character.user_id = attempt.user_id
  join app_private.event_run_personal_journeys quest on quest.run_id = attempt.run_id
  join app_private.event_runs run on run.id = attempt.run_id
  where attempt.character_id = new.character_id
    and attempt.restoration_trial_selected_at <= new.admitted_at and attempt.restoration_settled_at is null
    and quest.journey#>>'{restoration,trial,npcId}' = new.npc_id::text
    and quest.journey#>'{restoration,trialTarget,revision}' = to_jsonb(new.npc_revision)
    and quest.journey#>'{restoration,trialTarget,position}' = new.placement
    and app_private.personal_quest_run_available_v1(run,new.admitted_at)
    and not (select won from app_private.personal_restoration_trial_status_v1(attempt.id))
  order by attempt.restoration_trial_selected_at,attempt.id
  limit 1
  for share of run;
  return new;
end; $$;
create trigger bind_personal_restoration_trial_v1
after insert on app_private.world_npc_battles
for each row execute function app_private.bind_personal_restoration_trial_v1();

create or replace function public.commit_world_personal_quest_v1(
  p_user_id uuid,p_character_id uuid,p_expected_version bigint,p_command_id uuid,
  p_run_id uuid,p_action text,p_request_fingerprint text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  world app_private.character_world_state%rowtype;
  attempt app_private.event_personal_quest_attempts%rowtype;
  receipt record;
  quest app_private.event_run_personal_journeys%rowtype;
  current_run app_private.event_runs%rowtype;
  restoration jsonb;
  trial_npc_id text;
  trial_target jsonb;
  trial_won boolean := false;
  trial_in_battle boolean := false;
  reward_ref text;
  reward_amount bigint;
  reward_key text;
  xp record;
  state jsonb;
begin
  if p_action is null or p_action not in ('choose-restoration','choose-restoration-trial','restore-item','claim-restoration') then
    if exists (
      select 1 from app_private.personal_restoration_commands
      where character_id = p_character_id and user_id = p_user_id and command_id = p_command_id
    ) then raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT'; end if;
    return public.commit_world_personal_quest_before_restoration_v1(
      p_user_id,p_character_id,p_expected_version,p_command_id,p_run_id,p_action,p_request_fingerprint
    );
  end if;

  perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,false);
  select * into world from app_private.character_world_state where character_id = p_character_id for update;
  if not found then raise exception 'WORLD_STATE_UNAVAILABLE'; end if;
  if p_command_id is null or p_request_fingerprint is null then
    raise exception using errcode = '22023', message = 'WORLD_INVALID_COMMAND';
  end if;
  select command.expected_version,command.action,command.request_fingerprint,a.run_id into receipt
  from app_private.personal_restoration_commands command
  join app_private.event_personal_quest_attempts a on a.id = command.attempt_id
  where command.character_id = p_character_id and command.user_id = p_user_id
    and command.command_id = p_command_id;
  if found then
    if receipt.expected_version is distinct from p_expected_version
      or receipt.action is distinct from p_action or receipt.run_id is distinct from p_run_id
      or receipt.request_fingerprint is distinct from p_request_fingerprint then
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

  select * into quest from app_private.event_run_personal_journeys where run_id = p_run_id;
  restoration := quest.journey->'restoration';
  select * into attempt from app_private.event_personal_quest_attempts
    where character_id = p_character_id and user_id = p_user_id and run_id = p_run_id;
  if restoration is null or attempt.completed_at is null then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  if world.state->'position' is distinct from restoration->'giverPosition'
    or jsonb_array_length(world.state->'route') <> 0 then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_OUT_OF_RANGE';
  end if;
  if attempt.restoration_trial_selected_at is not null then
    select won,in_battle into trial_won,trial_in_battle
    from app_private.personal_restoration_trial_status_v1(attempt.id);
  end if;
  if p_action <> 'claim-restoration' and not (p_action = 'restore-item' and trial_won) then
    select * into current_run from app_private.event_runs where id = p_run_id for share;
    perform 1 from app_private.npc_designs where id = (restoration->>'giverNpcId')::uuid for share;
    if not app_private.personal_quest_run_available_v1(current_run,clock_timestamp())
      or app_private.event_personal_quest_giver_v1(restoration->>'giverNpcId') is distinct from restoration->'giverPosition' then
      raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
    end if;
  end if;
  state := public.commit_world_state_v1(
    p_user_id,p_character_id,p_expected_version,p_command_id,'interact',world.state,p_request_fingerprint
  );

  if p_action = 'choose-restoration' and attempt.restoration_selected_at is null then
    if attempt.restoration_trial_selected_at is not null then
      trial_npc_id := restoration#>>'{trial,npcId}';
      perform 1 from app_private.npc_designs where id = trial_npc_id::uuid for share;
      if trial_won or trial_in_battle or app_private.personal_restoration_trial_target_v1(trial_npc_id)
        is not distinct from restoration->'trialTarget' then
        raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
      end if;
    end if;
    -- Only a stranded trial can fall back. Keep both original command receipts;
    -- the existing (attempt, action) uniqueness permits each choice once.
    update app_private.event_personal_quest_attempts
      set restoration_selected_at = clock_timestamp(),restoration_trial_selected_at = null
      where id = attempt.id;
  elsif p_action = 'choose-restoration-trial'
    and attempt.restoration_selected_at is null and attempt.restoration_trial_selected_at is null then
    trial_npc_id := restoration#>>'{trial,npcId}';
    perform 1 from app_private.npc_designs where id = trial_npc_id::uuid for share;
    trial_target := app_private.personal_restoration_trial_target_v1(trial_npc_id);
    if trial_target is null or trial_target is distinct from restoration->'trialTarget'
      or app_private.personal_restoration_trial_reserved_v1(
        p_user_id,p_character_id,attempt.id,trial_npc_id,trial_target,clock_timestamp()
      ) then
      raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
    end if;
    update app_private.event_personal_quest_attempts set restoration_trial_selected_at = clock_timestamp()
      where id = attempt.id;
  elsif p_action = 'restore-item' and attempt.restoration_settled_at is null
    and (attempt.restoration_arrived_at is not null or trial_won) then
    perform app_private.settle_personal_inventory_restoration_v1(attempt,quest.journey,true);
    if restoration ? 'trial' then
      if attempt.restoration_trial_selected_at is not null then
        reward_ref := restoration#>>'{trial,rewardPackageRef}';
        reward_amount := (restoration->>'trialRewardAmount')::bigint;
      else
        reward_ref := restoration->>'recoveryRewardPackageRef';
        reward_amount := (restoration->>'recoveryRewardAmount')::bigint;
      end if;
      reward_key := md5(jsonb_build_array('event.restoration',attempt.id,reward_ref)::text);
      select * into xp from public.grant_character_xp_v1(
        attempt.character_id,reward_key::uuid,reward_key,'system:event-quest','gameplay',
        'event.restoration:' || reward_key,'event.quest.reward',reward_amount
      );
      if not found or xp.grant_id is null then raise exception 'WORLD_QUEST_REWARD_UNAVAILABLE'; end if;
      update app_private.event_personal_quest_attempts set awarded_xp = xp.applied_amount where id = attempt.id;
    end if;
  elsif p_action = 'claim-restoration' and attempt.restoration_settled_at is not null and attempt.item_claim_pending then
    perform app_private.settle_personal_inventory_restoration_v1(attempt,quest.journey,false);
  else
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  insert into app_private.personal_restoration_commands(
    character_id,user_id,attempt_id,command_id,expected_version,action,request_fingerprint
  ) values (p_character_id,p_user_id,attempt.id,p_command_id,p_expected_version,p_action,p_request_fingerprint);
  return state;
end; $$;

create or replace function app_private.project_personal_inventory_restoration_v1(
  p_user_id uuid,p_character_id uuid,p_run_id uuid,p_position jsonb,p_now timestamptz
)
returns jsonb language sql volatile set search_path = '' as $$
  with progress as (
    select a.id,a.restoration_selected_at,a.restoration_arrived_at,a.restoration_trial_selected_at,
      a.restoration_settled_at,a.item_claim_pending,a.awarded_xp,
      quest.journey->'restoration' restoration,quest.destination checkpoint,
      app_private.personal_quest_run_available_v1(run,p_now)
        and app_private.event_personal_quest_giver_v1(quest.journey#>>'{restoration,giverNpcId}')
          = quest.journey#>'{restoration,giverPosition}' available,
      p_position = quest.journey#>'{restoration,giverPosition}' at_giver,
      evidence.won,
      evidence.in_battle,
      quest.journey#>'{restoration,trialTarget}' =
        app_private.personal_restoration_trial_target_v1(quest.journey#>>'{restoration,trial,npcId}') trial_current
    from app_private.event_personal_quest_attempts a
    join app_private.event_run_personal_journeys quest on quest.run_id = a.run_id
    join app_private.event_runs run on run.id = a.run_id
    left join lateral app_private.personal_restoration_trial_status_v1(a.id) evidence
      on a.restoration_trial_selected_at is not null and a.restoration_settled_at is null
    where a.user_id = p_user_id and a.character_id = p_character_id and a.run_id = p_run_id
      and a.completed_at is not null and quest.journey ? 'restoration'
  ), state as (
    select *,
      restoration_selected_at is null and restoration_trial_selected_at is null choosing,
      restoration_arrived_at is not null or won is true ready,
      trial_current is true or in_battle is true trial_active
    from progress
  )
  select jsonb_build_object(
    'giverId',restoration->>'giverNpcId',
    'speaker',restoration#>>'{giver,name}',
    'portraitUrl',restoration#>>'{giver,imageUrl}',
    'portraitRef',restoration#>>'{giver,portraitRef}',
    'body',case when restoration_settled_at is not null then restoration->>'completed'
      when won is true then restoration#>>'{trial,ready}'
      when available is not true then 'The restoration route is currently unavailable.'
      when choosing then restoration->>'offer'
      when restoration_trial_selected_at is not null then case
        when trial_active then restoration#>>'{trial,active}'
        else 'The trial opponent is no longer available. Return to the smith to choose the recovery route.' end
      when ready then restoration->>'ready'
      else restoration->>'travel' end,
    'progress',case when restoration_settled_at is not null then 'completed'
      when ready then 'ready' else 'active' end,
    'destination',case when item_claim_pending or won is true then restoration->'giverPosition'
      when restoration_settled_at is not null or available is not true then null
      when not choosing and not ready then case
        when restoration_trial_selected_at is null then checkpoint
        when trial_active then restoration#>'{trialTarget,position}'
        else restoration->'giverPosition' end
      else restoration->'giverPosition' end,
    'local',at_giver and (item_claim_pending or won is true or available is true),
    'action',case when not at_giver then null when item_claim_pending then 'claim-restoration'
      when won is true then 'restore-item'
      when available is not true or restoration_settled_at is not null then null
      when choosing or (restoration_trial_selected_at is not null and not trial_active)
        then 'choose-restoration'
      when ready then 'restore-item' end,
    'firstName',restoration->>'firstName','secondName',restoration->>'secondName',
    'outputName',restoration->>'outputName','itemClaimPending',item_claim_pending,
    'awardedXp',awarded_xp
  ) || case when choosing and available is true and trial_current is true
    and not app_private.personal_restoration_trial_reserved_v1(
      p_user_id,p_character_id,id,restoration#>>'{trial,npcId}',restoration->'trialTarget',p_now
    ) then
    jsonb_build_object('trialOffer',restoration#>>'{trial,offer}')
    || case when at_giver then jsonb_build_object('alternativeAction','choose-restoration-trial')
       else '{}'::jsonb end
    else '{}'::jsonb end
  from state;
$$;

revoke all on function app_private.personal_restoration_trial_target_v1(text),
  app_private.personal_restoration_reward_amount_v1(text),
  app_private.assert_event_inventory_discovery_v1(jsonb),
  app_private.pin_inventory_restoration_trial_v1(),
  app_private.personal_restoration_trial_status_v1(uuid),
  app_private.personal_restoration_trial_reserved_v1(uuid,uuid,uuid,text,jsonb,timestamptz),
  app_private.bind_personal_restoration_trial_v1()
from public,anon,authenticated,service_role;


-- The staff reward list should reflect settlement, not initial discovery.
-- Preserve its access checks, pending count, and other personal reward rows.
do $migration$
declare
  body text := pg_get_functiondef('public.read_event_operation_dashboard_v1(uuid,uuid,uuid)'::regprocedure);
  patch record;
begin
  for patch in select * from (values
    ($before$select attempt.id,attempt.character_id,attempt.completed_at,attempt.awarded_xp,
      attempt.item_claim_pending,captured.journey$before$,
     $after$select attempt.id,attempt.character_id,
      coalesce(attempt.restoration_settled_at,attempt.completed_at) completed_at,attempt.awarded_xp,
      attempt.item_claim_pending,case when attempt.restoration_settled_at is not null
        then captured.journey->'restoration' else captured.journey end journey$after$),
    ($before$and (attempt.awarded_xp>0 or captured.journey->>'type'='item-exchange')$before$,
     $after$and (attempt.restoration_settled_at is not null
        or attempt.awarded_xp>0 or captured.journey->>'type'='item-exchange')$after$),
    ($before$order by attempt.item_claim_pending desc,attempt.completed_at desc,attempt.id$before$,
     $after$order by attempt.item_claim_pending desc,completed_at desc,attempt.id$after$)
  ) edits(anchor,replacement)
  loop
    if length(body)-length(replace(body,patch.anchor,'')) <> length(patch.anchor) then
      raise exception 'EVENT_RESTORATION_REWARDS_DASHBOARD_PREDECESSOR';
    end if;
    body := replace(body,patch.anchor,patch.replacement);
  end loop;
  execute body;
end;
$migration$;

commit;
