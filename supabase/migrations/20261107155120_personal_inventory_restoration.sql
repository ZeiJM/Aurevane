begin;

alter table app_private.event_personal_quest_attempts
  add column restoration_selected_at timestamptz check (restoration_selected_at >= completed_at),
  add column restoration_arrived_at timestamptz check (
    restoration_arrived_at is null or (restoration_selected_at is not null and restoration_arrived_at >= restoration_selected_at)
  ),
  add column restoration_settled_at timestamptz check (
    restoration_settled_at is null or (restoration_arrived_at is not null and restoration_settled_at >= restoration_arrived_at)
  ),
  add column restoration_item_id text check ((restoration_item_id is null) = (restoration_settled_at is null));

create unique index personal_restoration_unique_weapon_idx
  on app_private.event_personal_quest_attempts(character_id,restoration_item_id)
  where restoration_item_id is not null;
create index personal_restoration_pending_weapon_idx
  on app_private.event_personal_quest_attempts(restoration_item_id)
  where item_claim_pending and restoration_item_id is not null;

-- There are at most three successful restoration commands per attempt. Keep
-- their exact intent after movement replaces the ordinary last World command.
create table app_private.personal_restoration_commands (
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null,
  attempt_id uuid not null references app_private.event_personal_quest_attempts(id) on delete cascade,
  command_id uuid not null,
  expected_version bigint not null,
  action text not null check (action in ('choose-restoration','restore-item','claim-restoration')),
  request_fingerprint text not null,
  primary key (character_id,command_id),
  unique (attempt_id,action)
);
alter table app_private.personal_restoration_commands enable row level security;
revoke all on app_private.personal_restoration_commands from public,anon,authenticated,service_role;

create function app_private.available_restoration_weapon_v1(p_item_id text)
returns jsonb language sql stable set search_path = '' as $$
  select item from app_private.available_runtime_item_v1(p_item_id) item
  where item->'enabled' = 'true'::jsonb and item->>'itemClass' = 'weapon'
    and item->>'inventoryCategory' = 'gear' and item#>>'{equipment,slot}' = 'hand';
$$;

alter function app_private.assert_event_inventory_discovery_v1(jsonb)
  rename to assert_event_inventory_discovery_before_restoration_v1;
create function app_private.assert_event_inventory_discovery_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  discovery jsonb := p_definition->'inventoryDiscovery';
  restoration jsonb := discovery->'restoration';
  checkpoint jsonb := restoration->'checkpoint';
  giver jsonb := app_private.event_personal_quest_giver_v1(restoration->>'giverNpcId');
  line text;
begin
  perform app_private.assert_event_inventory_discovery_before_restoration_v1(
    case when restoration is null then p_definition
      else jsonb_set(p_definition,'{inventoryDiscovery}',discovery - 'restoration') end
  );
  if restoration is null then return; end if;
  if jsonb_typeof(restoration) is distinct from 'object'
    or (restoration - array['giverNpcId','checkpoint','outputItemId','offer','travel','ready','completed']) <> '{}'::jsonb
    or not coalesce(restoration->>'giverNpcId' ~ app_private.personal_realm_npc_id_pattern_v1(), false)
    or giver is null
    or jsonb_typeof(checkpoint) is distinct from 'object'
    or (checkpoint - array['sectorId','x','y']) <> '{}'::jsonb
    or checkpoint = giver
    or not coalesce(checkpoint->>'sectorId' ~ '^[a-z0-9][a-z0-9._:-]{1,159}$', false)
    or jsonb_typeof(checkpoint->'sectorId') is distinct from 'string'
    or jsonb_typeof(checkpoint->'x') is distinct from 'number'
    or not coalesce(checkpoint->>'x' ~ '^([0-9]|1[0-2])$', false)
    or jsonb_typeof(checkpoint->'y') is distinct from 'number'
    or not coalesce(checkpoint->>'y' ~ '^[0-8]$', false)
    or jsonb_typeof(restoration->'outputItemId') is distinct from 'string'
    or char_length(restoration->>'outputItemId') > 160
    or not coalesce(restoration->>'outputItemId' ~ '^[a-z0-9]+([._-][a-z0-9]+)*$', false)
    or restoration->>'outputItemId' in (discovery->>'firstItemId',discovery->>'secondItemId') then
    raise exception using errcode = '22023', message = 'EVENT_INVENTORY_RESTORATION_INVALID';
  end if;
  if app_private.available_restoration_weapon_v1(restoration->>'outputItemId') is null then
    raise exception using errcode = '22023', message = 'EVENT_INVENTORY_RESTORATION_WEAPON_UNAVAILABLE';
  end if;
  foreach line in array array['offer','travel','ready','completed'] loop
    if jsonb_typeof(restoration->line) is distinct from 'string'
      or char_length(restoration->>line) not between 1 and 800
      or btrim(restoration->>line) is distinct from restoration->>line then
      raise exception using errcode = '22023', message = 'EVENT_INVENTORY_RESTORATION_INVALID';
    end if;
  end loop;
end; $$;

create function app_private.capture_inventory_restoration_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  definition jsonb;
  restoration jsonb;
  giver_id uuid;
begin
  if new.run_mode <> 'production' then return new; end if;
  select version.definition into definition
    from app_private.event_definition_versions version where version.id = new.definition_version_id;
  restoration := definition#>'{inventoryDiscovery,restoration}';
  if restoration is null then return new; end if;
  -- The earlier inventory-discovery capture has validated this definition.
  giver_id := (restoration->>'giverNpcId')::uuid;
  perform 1 from app_private.npc_designs where id = giver_id for share;
  perform app_private.assert_event_inventory_discovery_v1(definition);
  update app_private.event_run_personal_journeys
  set destination = restoration->'checkpoint',
    journey = journey || jsonb_build_object('restoration',restoration || jsonb_build_object(
      'giverPosition',app_private.event_personal_quest_giver_v1(giver_id::text),
      'giver',app_private.personal_realm_story_npc_v1(giver_id::text),
      'firstName',app_private.available_runtime_item_v1(journey->>'firstItemId')->>'name',
      'secondName',app_private.available_runtime_item_v1(journey->>'secondItemId')->>'name',
      'outputName',app_private.available_restoration_weapon_v1(restoration->>'outputItemId')->>'name'
    ))
  where run_id = new.id;
  return new;
end; $$;
create trigger capture_inventory_restoration_v1
after insert on app_private.event_runs
for each row execute function app_private.capture_inventory_restoration_v1();

-- Reuse the authoritative World arrival hook. Only the committed route prefix
-- after the explicit recovery choice can qualify.
alter function app_private.record_world_personal_arrivals_v1(uuid,uuid,jsonb,bigint,bigint)
  rename to record_world_personal_arrivals_before_restoration_v1;
create function app_private.record_world_personal_arrivals_v1(
  p_user_id uuid,p_character_id uuid,p_route jsonb,p_prefix bigint,p_first_at bigint
)
returns void language plpgsql set search_path = '' as $$
declare
  candidate record;
  current_run app_private.event_runs%rowtype;
begin
  perform app_private.record_world_personal_arrivals_before_restoration_v1(
    p_user_id,p_character_id,p_route,p_prefix,p_first_at
  );
  if not exists (
    select 1 from app_private.event_personal_quest_attempts
    where character_id = p_character_id and user_id = p_user_id
      and restoration_selected_at is not null and restoration_arrived_at is null
  ) then return; end if;

  for candidate in
    with arrivals as (
      select step.value->'position' position,
        to_timestamp((p_first_at + sum(
          case when step.ordinality = 1 then 0 else (step.value->>'durationMs')::bigint end
        ) over (order by step.ordinality)) / 1000.0) arrived_at
      from jsonb_array_elements(p_route) with ordinality step(value,ordinality)
      where step.ordinality <= p_prefix
    )
    select attempt.id,attempt.run_id,min(arrivals.arrived_at) arrived_at
    from app_private.event_personal_quest_attempts attempt
    join app_private.event_run_personal_journeys quest on quest.run_id = attempt.run_id
    join arrivals on arrivals.position = quest.destination and arrivals.arrived_at >= attempt.restoration_selected_at
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id
      and attempt.restoration_arrived_at is null and quest.journey ? 'restoration'
    group by attempt.id,attempt.run_id
    order by attempt.run_id
  loop
    select * into current_run from app_private.event_runs where id = candidate.run_id for share;
    if found and app_private.personal_quest_run_available_v1(current_run,candidate.arrived_at)
      and coalesce((
        select transition.to_status from app_private.event_run_transitions transition
        where transition.run_id = candidate.run_id and transition.occurred_at <= candidate.arrived_at
        order by transition.occurred_at desc,transition.id desc limit 1
      ),'live') = 'live' then
      update app_private.event_personal_quest_attempts set restoration_arrived_at = candidate.arrived_at
      where id = candidate.id and restoration_arrived_at is null;
    end if;
  end loop;
end; $$;

create function app_private.settle_personal_inventory_restoration_v1(
  p_attempt app_private.event_personal_quest_attempts,p_journey jsonb,p_restore boolean
)
returns void language plpgsql set search_path = '' as $$
declare
  output_id text := p_journey#>>'{restoration,outputItemId}';
  input_id text;
  item_stack record;
  inventory_revision bigint;
  already_owned boolean;
  pending boolean := false;
begin
  perform app_private.lock_character_item_inventory_v1(p_attempt.user_id,p_attempt.character_id,true);
  if app_private.available_restoration_weapon_v1(output_id) is null then
    raise exception using errcode = '22023', message = 'EVENT_INVENTORY_RESTORATION_WEAPON_UNAVAILABLE';
  end if;
  select revision into strict inventory_revision from app_private.character_item_inventory
    where character_id = p_attempt.character_id;
  select exists (
    select 1 from app_private.character_item_stacks
    where character_id = p_attempt.character_id and item_id = output_id
  ) into already_owned;
  if p_restore then
    if already_owned or exists (
      select 1 from app_private.event_personal_quest_attempts
      where character_id = p_attempt.character_id and restoration_item_id = output_id
    ) then raise exception using errcode = '22023', message = 'WORLD_RESTORATION_WEAPON_ALREADY_EARNED'; end if;

    foreach input_id in array array[p_journey->>'firstItemId',p_journey->>'secondItemId'] loop
      select id,quantity into item_stack from app_private.character_item_stacks
      where character_id = p_attempt.character_id and item_id = input_id order by slot_index,id limit 1;
      if not found then raise exception using errcode = '22023', message = 'WORLD_QUEST_ITEMS_MISSING'; end if;
      if item_stack.quantity = 1 then
        delete from app_private.character_item_stacks where id = item_stack.id;
      else
        update app_private.character_item_stacks set quantity = quantity - 1 where id = item_stack.id;
      end if;
    end loop;
  end if;

  if not already_owned then
    begin
      perform public.grant_character_items_v1(
        p_attempt.user_id,p_attempt.character_id,inventory_revision,'event.restoration:' || p_attempt.id,
        jsonb_build_array(jsonb_build_object('itemId',output_id,'quantity',1))
      );
    exception when sqlstate '22023' then
      if sqlerrm <> 'ITEM_CAPACITY' or not p_restore then raise; end if;
      update app_private.character_item_inventory set revision = revision + 1
        where character_id = p_attempt.character_id;
      pending := true;
    end;
  end if;
  update app_private.event_personal_quest_attempts
    set restoration_settled_at = coalesce(restoration_settled_at,clock_timestamp()),
      restoration_item_id = output_id,item_claim_pending = pending
    where id = p_attempt.id;
end; $$;

alter function public.commit_world_personal_quest_v1(uuid,uuid,bigint,uuid,uuid,text,text)
  rename to commit_world_personal_quest_before_restoration_v1;
revoke all on function public.commit_world_personal_quest_before_restoration_v1(uuid,uuid,bigint,uuid,uuid,text,text)
  from public,anon,authenticated,service_role;
create function public.commit_world_personal_quest_v1(
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
  state jsonb;
begin
  if p_action is null or p_action not in ('choose-restoration','restore-item','claim-restoration') then
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
  if p_action <> 'claim-restoration' then
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
    update app_private.event_personal_quest_attempts set restoration_selected_at = clock_timestamp()
      where id = attempt.id;
  elsif (p_action = 'restore-item' and attempt.restoration_arrived_at is not null and attempt.restoration_settled_at is null)
     or (p_action = 'claim-restoration' and attempt.restoration_settled_at is not null and attempt.item_claim_pending) then
    perform app_private.settle_personal_inventory_restoration_v1(attempt,quest.journey,p_action = 'restore-item');
  else
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  insert into app_private.personal_restoration_commands(
    character_id,user_id,attempt_id,command_id,expected_version,action,request_fingerprint
  ) values (p_character_id,p_user_id,attempt.id,p_command_id,p_expected_version,p_action,p_request_fingerprint);
  return state;
end; $$;

-- The predecessor can discover an existing pair on this same World read.
-- Read the new attempt as well, rather than returning an incomplete clue first.
create function app_private.project_personal_inventory_restoration_v1(
  p_user_id uuid,p_character_id uuid,p_run_id uuid,p_position jsonb,p_now timestamptz
)
returns jsonb language sql volatile set search_path = '' as $$
  with progress as (
    select a.restoration_selected_at,a.restoration_arrived_at,a.restoration_settled_at,a.item_claim_pending,
      quest.journey->'restoration' restoration,quest.destination checkpoint,
      app_private.personal_quest_run_available_v1(run,p_now)
        and app_private.event_personal_quest_giver_v1(quest.journey#>>'{restoration,giverNpcId}')
          = quest.journey#>'{restoration,giverPosition}' available,
      p_position = quest.journey#>'{restoration,giverPosition}' at_giver
    from app_private.event_personal_quest_attempts a
    join app_private.event_run_personal_journeys quest on quest.run_id = a.run_id
    join app_private.event_runs run on run.id = a.run_id
    where a.user_id = p_user_id and a.character_id = p_character_id and a.run_id = p_run_id
      and a.completed_at is not null and quest.journey ? 'restoration'
  )
  select jsonb_build_object(
    'giverId',restoration->>'giverNpcId',
    'speaker',restoration#>>'{giver,name}',
    'portraitUrl',restoration#>>'{giver,imageUrl}',
    'portraitRef',restoration#>>'{giver,portraitRef}',
    'body',case when restoration_settled_at is not null then restoration->>'completed'
      when available is not true then 'The restoration route is currently unavailable.'
      when restoration_selected_at is null then restoration->>'offer'
      when restoration_arrived_at is null then restoration->>'travel'
      else restoration->>'ready' end,
    'progress',case when restoration_settled_at is not null then 'completed'
      when restoration_arrived_at is not null then 'ready' else 'active' end,
    'destination',case when item_claim_pending then restoration->'giverPosition'
      when restoration_settled_at is not null or available is not true then null
      when restoration_selected_at is not null and restoration_arrived_at is null then checkpoint
      else restoration->'giverPosition' end,
    'local',at_giver and (item_claim_pending or available is true),
    'action',case when not at_giver then null when item_claim_pending then 'claim-restoration'
      when available is not true or restoration_settled_at is not null then null
      when restoration_selected_at is null then 'choose-restoration'
      when restoration_arrived_at is not null then 'restore-item' end,
    'firstName',restoration->>'firstName','secondName',restoration->>'secondName',
    'outputName',restoration->>'outputName','itemClaimPending',item_claim_pending
  )
  from progress;
$$;

alter function app_private.read_world_personal_quests_v1(uuid,uuid,jsonb,timestamptz)
  rename to read_world_personal_quests_before_restoration_v1;
create function app_private.read_world_personal_quests_v1(
  p_user_id uuid,p_character_id uuid,p_position jsonb,p_now timestamptz
)
returns jsonb language sql volatile set search_path = '' as $$
  select coalesce(jsonb_agg(
    case when row->'discovery' = 'true'::jsonb then
      row || coalesce(
        jsonb_build_object('discoveryClue',row->'body')
        || app_private.project_personal_inventory_restoration_v1(
          p_user_id,p_character_id,(row->>'runId')::uuid,p_position,p_now
        ),'{}'::jsonb)
    else row end order by ordinal
  ),'[]'::jsonb)
  from jsonb_array_elements(app_private.read_world_personal_quests_before_restoration_v1(
    p_user_id,p_character_id,p_position,p_now
  )) with ordinality rows(row,ordinal);
$$;

-- Keep an earned pending weapon deliverable through the existing catalogue
-- publication transaction and its lock.
do $migration$
declare
  body text;
  anchor constant text := E'  return null;\nend;';
begin
  body := pg_get_functiondef('app_private.guard_pending_personal_exchange_item_v1()'::regprocedure);
  if length(body) - length(replace(body,anchor,'')) <> length(anchor) then
    raise exception 'RESTORATION_ITEM_GUARD_PREDECESSOR_MISSING';
  end if;
  execute replace(body,anchor,$guard$
  if exists (
    select 1 from app_private.event_personal_quest_attempts attempt
    join public.characters character on character.id = attempt.character_id and character.user_id = attempt.user_id
    where attempt.restoration_item_id = item_id and attempt.item_claim_pending
  ) and app_private.available_restoration_weapon_v1(item_id) is null then
    raise exception using errcode = '22023', message = 'ITEM_PENDING_EVENT_EXCHANGE';
  end if;
$guard$||anchor);
end; $migration$;

revoke all on function app_private.available_restoration_weapon_v1(text),
  app_private.assert_event_inventory_discovery_v1(jsonb),app_private.capture_inventory_restoration_v1(),
  app_private.record_world_personal_arrivals_v1(uuid,uuid,jsonb,bigint,bigint),
  app_private.project_personal_inventory_restoration_v1(uuid,uuid,uuid,jsonb,timestamptz),
  app_private.read_world_personal_quests_v1(uuid,uuid,jsonb,timestamptz),
  app_private.settle_personal_inventory_restoration_v1(app_private.event_personal_quest_attempts,jsonb,boolean)
from public,anon,authenticated,service_role;
revoke all on function public.commit_world_personal_quest_v1(uuid,uuid,bigint,uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.commit_world_personal_quest_v1(uuid,uuid,bigint,uuid,uuid,text,text)
  to service_role;

commit;
