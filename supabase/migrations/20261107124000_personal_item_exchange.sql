begin;

alter table app_private.event_run_personal_journeys alter column destination drop not null;
alter table app_private.event_personal_quest_attempts
  add column item_claim_pending boolean not null default false
  check (not item_claim_pending or completed_at is not null);

create index event_personal_pending_item_claim_idx
  on app_private.event_personal_quest_attempts (run_id) where item_claim_pending;
create index event_personal_output_item_idx
  on app_private.event_run_personal_journeys ((journey->>'outputItemId'))
  where journey->>'type' = 'item-exchange';

-- An earned key has a stable Item identity. Its current eligible edition is
-- delivered through the usual inventory grant. Prevent catalogue writes from
-- stranding a pending claim while allowing approved successors and unrelated edits.
create function app_private.guard_pending_personal_exchange_item_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  item_id text;
  item jsonb;
begin
  if tg_table_name = 'runtime_item_source_definitions' then
    item_id := new.item_id;
  elsif tg_op = 'DELETE' then
    if old.content_kind = 'item' then item_id := old.content_key; end if;
  elsif new.content_kind = 'item' then
    item_id := new.content_key;
  end if;
  if item_id is null then return null; end if;

  if not pg_try_advisory_xact_lock(hashtextextended('combat-catalogue-publication', 0)) then
    raise exception using errcode = 'PT409', message = 'COMBAT_CONTENT_CATALOGUE_CONFLICT';
  end if;
  if exists (
    select 1 from app_private.event_run_personal_journeys quest
    join app_private.event_personal_quest_attempts attempt on attempt.run_id = quest.run_id
    join public.characters character on character.id = attempt.character_id and character.user_id = attempt.user_id
    where quest.journey->>'type' = 'item-exchange'
      and quest.journey->>'outputItemId' = item_id and attempt.item_claim_pending
  ) then
    item := app_private.available_runtime_item_v1(item_id);
    if item->'enabled' is distinct from 'true'::jsonb
      or not coalesce(item->>'itemClass' in ('event','general'), false) then
      raise exception using errcode = '22023', message = 'ITEM_PENDING_EVENT_EXCHANGE';
    end if;
  end if;
  return null;
end; $$;

create trigger guard_personal_exchange_item_source
after insert on app_private.runtime_item_source_definitions
for each row execute function app_private.guard_pending_personal_exchange_item_v1();
create trigger guard_personal_exchange_item_archive
after update of lifecycle on app_private.combat_content_records
for each row when (new.lifecycle = 'archived' and old.lifecycle is distinct from new.lifecycle)
execute function app_private.guard_pending_personal_exchange_item_v1();
create trigger guard_personal_exchange_item_publication
after insert or update or delete on app_private.combat_content_publications
for each row execute function app_private.guard_pending_personal_exchange_item_v1();

-- Restrict inputs and keys to ordinary carried items that cannot be equipped.
create function app_private.personal_exchange_items_v1(p_journey jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  input_id text := p_journey->>'inputItemId';
  output_id text := p_journey->>'outputItemId';
  input_item jsonb;
  output_item jsonb;
begin
  if jsonb_typeof(p_journey->'inputItemId') is distinct from 'string'
    or jsonb_typeof(p_journey->'outputItemId') is distinct from 'string'
    or input_id = output_id or length(input_id) > 160 or length(output_id) > 160
    or input_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    or output_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'EVENT_PERSONAL_EXCHANGE_ITEMS_INVALID';
  end if;
  input_item := app_private.available_runtime_item_v1(input_id);
  output_item := app_private.available_runtime_item_v1(output_id);
  if input_item->'enabled' is distinct from 'true'::jsonb
    or output_item->'enabled' is distinct from 'true'::jsonb
    or not coalesce(input_item->>'itemClass' in ('material','event','general'), false)
    or not coalesce(output_item->>'itemClass' in ('event','general'), false) then
    raise exception using errcode = '22023', message = 'EVENT_PERSONAL_EXCHANGE_ITEMS_UNAVAILABLE';
  end if;
  return jsonb_build_object('inputName', input_item->>'name', 'outputName', output_item->>'name');
end; $$;

-- This entitlement follows the accepted event identity and is independent of
-- the key's inventory slot and the original occurrence's lifecycle.
create function app_private.has_personal_exchange_access_v1(
  p_user_id uuid, p_character_id uuid, p_event_key text
)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from app_private.event_personal_quest_attempts attempt
    join app_private.event_run_personal_journeys journey on journey.run_id = attempt.run_id
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id
      and attempt.event_key = p_event_key and attempt.completed_at is not null
      and journey.journey->>'type' = 'item-exchange'
  );
$$;

create function app_private.settle_personal_item_exchange_v1(
  p_attempt app_private.event_personal_quest_attempts, p_journey jsonb,
  p_hand_over boolean, p_now timestamptz
)
returns void language plpgsql set search_path = '' as $$
declare
  remaining integer := (p_journey->>'inputQuantity')::integer;
  input_id text := p_journey->>'inputItemId';
  current_revision bigint;
  stack record;
  pending boolean := false;
begin
  perform app_private.lock_character_item_inventory_v1(p_attempt.user_id, p_attempt.character_id, true);
  select revision into strict current_revision from app_private.character_item_inventory
  where character_id = p_attempt.character_id;
  if p_hand_over then
    perform app_private.personal_exchange_items_v1(p_journey);
    for stack in
      select id, quantity from app_private.character_item_stacks
      where character_id = p_attempt.character_id and item_id = input_id
      order by slot_index
    loop
      exit when remaining = 0;
      if stack.quantity <= remaining then
        delete from app_private.character_item_stacks where id = stack.id;
        remaining := remaining - stack.quantity;
      else
        update app_private.character_item_stacks set quantity = quantity - remaining where id = stack.id;
        remaining := 0;
      end if;
    end loop;
    if remaining <> 0 then
      raise exception using errcode = '22023', message = 'WORLD_QUEST_ITEMS_MISSING';
    end if;
  end if;

  begin
    perform public.grant_character_items_v1(
      p_attempt.user_id, p_attempt.character_id, current_revision,
      'event.exchange:' || p_attempt.id,
      jsonb_build_array(jsonb_build_object('itemId', p_journey->>'outputItemId', 'quantity', 1))
    );
  exception when sqlstate '22023' then
    if sqlerrm <> 'ITEM_CAPACITY' or not p_hand_over then raise; end if;
    -- The failed grant rolls back to its savepoint. The consumed stock and
    -- access settle with a claim, so the player never has to hand over twice.
    update app_private.character_item_inventory set revision = revision + 1
    where character_id = p_attempt.character_id;
    pending := true;
  end;

  update app_private.event_personal_quest_attempts
  set arrived_at = coalesce(arrived_at, p_now), completed_at = coalesce(completed_at, p_now),
    item_claim_pending = pending
  where id = p_attempt.id;
end; $$;

revoke all on function app_private.guard_pending_personal_exchange_item_v1(),
  app_private.personal_exchange_items_v1(jsonb),
  app_private.has_personal_exchange_access_v1(uuid,uuid,text),
  app_private.settle_personal_item_exchange_v1(app_private.event_personal_quest_attempts,jsonb,boolean,timestamptz)
from public, anon, authenticated, service_role;

create or replace function app_private.assert_event_personal_journey_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  journey jsonb := p_definition->'personalJourney';
  giver jsonb := app_private.event_personal_quest_giver_v1(journey->>'giverId');
  destination jsonb := journey->'destination';
  item_exchange boolean := journey->>'type' = 'item-exchange';
  line text;
begin
  if jsonb_typeof(journey) is distinct from 'object'
    or not coalesce(journey->>'type' in ('travel-and-report','item-exchange'), false)
    or not coalesce(p_definition->>'category' = 'story-campaigns' or (
      not (p_definition ? 'category') and p_definition->>'family' = 'narrative-event'
    ), false)
    or giver is null
    or (not item_exchange and (
      jsonb_typeof(destination) is distinct from 'object'
      or jsonb_typeof(destination->'sectorId') is distinct from 'string'
      or not coalesce(destination->>'sectorId' ~ '^[a-z0-9][a-z0-9._:-]{1,159}$', false)
      or jsonb_typeof(destination->'x') is distinct from 'number'
      or coalesce(destination->>'x','') !~ '^([0-9]|1[0-2])$'
      or jsonb_typeof(destination->'y') is distinct from 'number'
      or coalesce(destination->>'y','') !~ '^[0-8]$'
      or giver = jsonb_build_object('sectorId', destination->'sectorId',
        'x', destination->'x', 'y', destination->'y')
    ))
    or (item_exchange and (
      (journey - array['type','giverId','inputItemId','inputQuantity','outputItemId','offer','active','ready','completed']) <> '{}'::jsonb
      or jsonb_typeof(journey->'inputQuantity') is distinct from 'number'
      or not coalesce(journey->>'inputQuantity' ~ '^[1-9][0-9]{0,2}$', false)
      or jsonb_array_length(coalesce(p_definition->'rewardPackageRefs', '[]')) <> 0
    ))
    or not coalesce(
      p_definition#>>'{scope,type}' = 'global' or (
        p_definition#>>'{scope,type}' = 'region'
        and p_definition#>>'{scope,key}' in (giver->>'sectorId', 'region.'||(giver->>'sectorId'))
      ), false)
    or jsonb_array_length(p_definition->'phases') <> 1
    or p_definition#>>'{phases,0,transition,type}' is distinct from 'manual'
    or jsonb_array_length(coalesce(p_definition#>'{phases,0,objectives}', '[]')) <> 0
    or jsonb_array_length(coalesce(p_definition->'rewardPackageRefs', '[]')) > 8
    or jsonb_array_length(coalesce(p_definition->'rewardPackageRefs', '[]')) <> (
      select count(distinct reference.value)
      from jsonb_array_elements_text(coalesce(p_definition->'rewardPackageRefs', '[]')) reference
    ) then
    raise exception using errcode = '22023', message = 'EVENT_PERSONAL_JOURNEY_INVALID';
  end if;

  if item_exchange then perform app_private.personal_exchange_items_v1(journey); end if;

  foreach line in array array['offer','active','ready','completed'] loop
    if jsonb_typeof(journey->line) is distinct from 'string'
      or char_length(journey->>line) not between 1 and 800
      or btrim(journey->>line) is distinct from journey->>line then
      raise exception using errcode = '22023', message = 'EVENT_PERSONAL_JOURNEY_DIALOGUE_INVALID';
    end if;
  end loop;
end; $$;

create or replace function app_private.capture_event_personal_journey_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  definition jsonb;
  journey jsonb;
  destination jsonb;
begin
  select version.definition into definition
  from app_private.event_definition_versions version where version.id = new.definition_version_id;
  if new.run_mode <> 'production' or not (definition ? 'personalJourney') then return new; end if;
  perform app_private.assert_event_personal_journey_v1(definition);
  journey := definition->'personalJourney';
  if journey->>'type' = 'item-exchange' then
    journey := journey || app_private.personal_exchange_items_v1(journey);
  else
    destination := jsonb_build_object('sectorId', journey#>'{destination,sectorId}',
      'x', journey#>'{destination,x}', 'y', journey#>'{destination,y}');
  end if;
  insert into app_private.event_run_personal_journeys(run_id, giver_position, destination, journey)
  values (new.id, app_private.event_personal_quest_giver_v1(journey->>'giverId'), destination, journey);
  return new;
end; $$;

create or replace function app_private.read_world_personal_quests_v1(
  p_user_id uuid, p_character_id uuid, p_position jsonb, p_now timestamptz
)
returns jsonb language sql stable set search_path = '' as $$
  with known as (
    select attempt.run_id, attempt.accepted_at, attempt.arrived_at, attempt.completed_at, attempt.awarded_xp, attempt.item_claim_pending
    from app_private.event_personal_quest_attempts attempt
    join app_private.event_runs original on original.id = attempt.run_id
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id
      and (attempt.completed_at is not null or app_private.personal_quest_attempt_is_current_v1(original,p_now))
    union all
    select journey.run_id, null, null, null, 0, false
    from app_private.event_run_personal_journeys journey
    join app_private.event_runs run on run.id = journey.run_id
    where journey.giver_position = p_position
      and app_private.personal_quest_run_available_v1(run, p_now)
      and not exists (
        select 1 from app_private.event_personal_quest_attempts attempt
        join app_private.event_runs original on original.id = attempt.run_id
        where attempt.character_id = p_character_id and attempt.event_key = run.event_key
          and (attempt.completed_at is not null or app_private.personal_quest_attempt_is_current_v1(original,p_now))
      )
  ), public_rows as (
    select known.*, journey.journey, journey.destination, journey.giver_position,
      version.definition->>'title' title, app_private.personal_quest_run_available_v1(run, p_now) available
    from known
    join app_private.event_run_personal_journeys journey on journey.run_id = known.run_id
    join app_private.event_runs run on run.id = known.run_id
    join app_private.event_definition_versions version on version.id = run.definition_version_id
    order by known.item_claim_pending desc, (known.completed_at is not null), known.accepted_at desc nulls first, known.run_id
    limit 48
  ), with_inventory as (
    select public_rows.*,
      case when journey->>'type' = 'item-exchange' and completed_at is null then (
        select coalesce(sum(stack.quantity), 0)
        from app_private.character_item_stacks stack
        where stack.character_id = p_character_id and stack.item_id = journey->>'inputItemId'
      ) end input_owned
    from public_rows
  ), progress_rows as (
    select with_inventory.*, accepted_at is not null and completed_at is null
      and (arrived_at is not null or input_owned >= (journey->>'inputQuantity')::integer) ready
    from with_inventory
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'runId', run_id,
    'title', title,
    'giverId', journey->>'giverId',
    'progress', case when completed_at is not null then 'completed'
      when ready then 'ready' when accepted_at is not null then 'active' else 'available' end,
    'body', case when completed_at is not null then journey->>'completed'
      when not available then 'This quest is currently paused.'
      when ready then journey->>'ready'
      when accepted_at is not null then journey->>'active' else journey->>'offer' end,
    'destination', case when not available or accepted_at is null or completed_at is not null then null
      when ready then giver_position else destination end,
    'local', giver_position = p_position,
    'action', case when giver_position <> p_position then null
      when item_claim_pending then 'claim-exchange'
      when not available or completed_at is not null then null
      when accepted_at is null then 'accept'
      when ready and journey->>'type' = 'item-exchange' then 'hand-over'
      when ready then 'report' end,
    'awardedXp', awarded_xp
  ) || case when journey->>'type' = 'item-exchange' then jsonb_build_object(
    'inputOwned', input_owned,
    'inputQuantity', (journey->>'inputQuantity')::integer,
    'inputName', journey->>'inputName',
    'outputName', journey->>'outputName',
    'accessGranted', completed_at is not null,
    'itemClaimPending', item_claim_pending
  ) else '{}'::jsonb end order by item_claim_pending desc, (completed_at is not null), accepted_at desc nulls first, run_id), '[]'::jsonb)
  from progress_rows;
$$;

create or replace function public.commit_world_personal_quest_v1(
  p_user_id uuid, p_character_id uuid, p_expected_version bigint, p_command_id uuid,
  p_run_id uuid, p_action text, p_request_fingerprint text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  world app_private.character_world_state%rowtype;
  current_run app_private.event_runs%rowtype;
  quest app_private.event_run_personal_journeys%rowtype;
  attempt app_private.event_personal_quest_attempts%rowtype;
  reward record;
  xp record;
  xp_total bigint := 0;
  xp_key text;
  action_at timestamptz;
begin
  -- Inventory writers lock catalogue, account battle, World, then character and build.
  -- Take that order before entering the existing World transaction.
  if p_action in ('hand-over','claim-exchange') then
    perform app_private.lock_character_item_inventory_v1(p_user_id, p_character_id, false);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
  perform 1 from public.characters c where c.id = p_character_id and c.user_id = p_user_id for update;
  if not found or exists (select 1 from app_private.character_deletion_requests d
    where d.character_id = p_character_id) then
    raise exception 'WORLD_NOT_OWNED' using errcode = '42501';
  end if;
  select * into world from app_private.character_world_state w where w.character_id = p_character_id for update;
  if not found then raise exception 'WORLD_STATE_UNAVAILABLE'; end if;

  if world.last_command_id = p_command_id then
    if world.last_command_fingerprint is distinct from p_request_fingerprint then
      raise exception 'WORLD_COMMAND_CONFLICT' using errcode = '22023';
    end if;
    return world.state;
  end if;
  if (world.state->>'version')::bigint <> p_expected_version then
    raise exception 'WORLD_STALE_VERSION' using errcode = 'PT409';
  end if;
  if p_action is null or p_action not in ('accept', 'report', 'hand-over', 'claim-exchange') then
    raise exception 'WORLD_QUEST_ACTION_UNAVAILABLE' using errcode = '22023';
  end if;
  select * into current_run from app_private.event_runs where id = p_run_id for update;
  action_at := clock_timestamp();
  if not found or (p_action <> 'claim-exchange'
    and not app_private.personal_quest_run_available_v1(current_run, action_at)) then
    raise exception 'WORLD_QUEST_ACTION_UNAVAILABLE' using errcode = '22023';
  end if;
  select * into quest from app_private.event_run_personal_journeys where run_id = p_run_id;
  if not found then raise exception 'WORLD_QUEST_ACTION_UNAVAILABLE' using errcode = '22023'; end if;
  if world.state->'position' is distinct from quest.giver_position or
    jsonb_array_length(world.state->'route') <> 0 then
    raise exception 'WORLD_QUEST_OUT_OF_RANGE' using errcode = '22023';
  end if;
  -- This also validates combat/training/spectating authority and advances the world receipt.
  world.state := public.commit_world_state_v1(p_user_id, p_character_id, p_expected_version,
    p_command_id, 'interact', world.state, p_request_fingerprint);

  select * into attempt from app_private.event_personal_quest_attempts
  where character_id = p_character_id and run_id = p_run_id for update;
  if p_action = 'accept' and not found and not exists (
    select 1 from app_private.event_personal_quest_attempts prior
    join app_private.event_runs original on original.id = prior.run_id
    where prior.character_id = p_character_id and prior.event_key = current_run.event_key
      and (prior.completed_at is not null or app_private.personal_quest_attempt_is_current_v1(original,action_at))
  ) then
    insert into app_private.event_personal_quest_attempts(
      character_id, user_id, event_key, run_id, accepted_at
    ) values (p_character_id, p_user_id, current_run.event_key, p_run_id, action_at);
  elsif p_action in ('hand-over','claim-exchange') and found and attempt.user_id = p_user_id
    and quest.journey->>'type' = 'item-exchange'
    and ((p_action = 'hand-over' and attempt.completed_at is null)
      or (p_action = 'claim-exchange' and attempt.item_claim_pending)) then
    perform app_private.settle_personal_item_exchange_v1(
      attempt, quest.journey, p_action = 'hand-over', action_at
    );
  elsif p_action = 'report' and found and attempt.run_id = p_run_id
    and quest.journey->>'type' = 'travel-and-report'
    and attempt.user_id = p_user_id and attempt.arrived_at is not null and attempt.completed_at is null then
    for reward in
      select package.*
      from app_private.event_definition_versions version
      cross join lateral jsonb_array_elements_text(version.definition->'rewardPackageRefs') reference
      join app_private.event_reward_packages package on package.reward_package_ref = reference.value
      where version.id = current_run.definition_version_id
      order by package.reward_package_ref
    loop
      xp_key := md5(jsonb_build_array(attempt.id,reward.reward_package_ref)::text);
      select * into xp from public.grant_character_xp_v1(
        p_character_id, xp_key::uuid, xp_key, 'system:event-quest', 'gameplay',
        'event.quest:' || xp_key, 'event.quest.reward', reward.amount
      );
      if not found or xp.grant_id is null then raise exception 'WORLD_QUEST_REWARD_UNAVAILABLE'; end if;
      xp_total := xp_total + xp.applied_amount;
    end loop;
    update app_private.event_personal_quest_attempts
    set completed_at = action_at, awarded_xp = xp_total where id = attempt.id;
  else
    raise exception 'WORLD_QUEST_ACTION_UNAVAILABLE' using errcode = '22023';
  end if;
  return world.state;
end; $$;

commit;
