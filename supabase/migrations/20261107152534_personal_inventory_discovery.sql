begin;

-- Inventory discoveries have no map placement or public offer. Reuse the
-- personal quest ledger for the once-per-character discovery receipt.
alter table app_private.event_run_personal_journeys alter column giver_position drop not null;
alter table app_private.event_run_personal_journeys add constraint event_personal_giver_or_inventory_discovery
  check (giver_position is not null or coalesce(journey->>'type' = 'inventory-discovery', false));

create index event_run_personal_inventory_discovery_idx
  on app_private.event_run_personal_journeys ((journey->>'firstItemId'),run_id)
  where journey->>'type' = 'inventory-discovery';

-- Inventory mutations observe their own evidence. Reconcile pre-existing
-- stock only once per character whenever a hidden occurrence becomes live.
alter table app_private.character_world_state
  add column inventory_discovery_revision bigint not null default 0;
create table app_private.event_inventory_discovery_revision (
  singleton boolean primary key check (singleton),
  revision bigint not null check (revision >= 0)
);
insert into app_private.event_inventory_discovery_revision values (true,0);
alter table app_private.event_inventory_discovery_revision enable row level security;
revoke all on app_private.event_inventory_discovery_revision from public,anon,authenticated,service_role;

create function app_private.assert_event_inventory_discovery_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  discovery jsonb := p_definition->'inventoryDiscovery';
  first_id text := discovery->>'firstItemId';
  second_id text := discovery->>'secondItemId';
  item_id text;
  item jsonb;
begin
  if jsonb_typeof(discovery) is distinct from 'object'
    or (discovery - array['firstItemId','secondItemId','clue']) <> '{}'::jsonb
    or not app_private.event_definition_is_hidden_v1(p_definition)
    or p_definition#>>'{scope,type}' is distinct from 'global'
    or p_definition ? 'personalJourney'
    or jsonb_array_length(coalesce(p_definition->'phases','[]')) <> 1
    or p_definition#>>'{phases,0,transition,type}' is distinct from 'manual'
    or jsonb_array_length(coalesce(p_definition#>'{phases,0,objectives}','[]')) <> 0
    or jsonb_array_length(coalesce(p_definition#>'{phases,0,effects}','[]')) <> 0
    or jsonb_array_length(coalesce(p_definition#>'{phases,0,cleanupEffects}','[]')) <> 0
    or jsonb_array_length(coalesce(p_definition->'rewardPackageRefs','[]')) <> 0
    or jsonb_array_length(coalesce(p_definition->'aftermathRefs','[]')) <> 0
    or jsonb_typeof(discovery->'firstItemId') is distinct from 'string'
    or jsonb_typeof(discovery->'secondItemId') is distinct from 'string'
    or first_id = second_id
    or char_length(first_id) > 160 or first_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    or char_length(second_id) > 160 or second_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    or jsonb_typeof(discovery->'clue') is distinct from 'string'
    or char_length(discovery->>'clue') not between 1 and 800
    or btrim(discovery->>'clue') is distinct from discovery->>'clue' then
    raise exception using errcode = '22023', message = 'EVENT_INVENTORY_DISCOVERY_INVALID';
  end if;
  foreach item_id in array array[first_id,second_id] loop
    item := app_private.available_runtime_item_v1(item_id);
    if item->'enabled' is distinct from 'true'::jsonb
      or not coalesce(item->>'itemClass' in ('material','general','event'),false) then
      raise exception using errcode = '22023', message = 'EVENT_INVENTORY_DISCOVERY_ITEM_UNAVAILABLE';
    end if;
  end loop;
end; $$;

alter function app_private.assert_event_runtime_supported_v1(jsonb)
  rename to assert_event_runtime_before_inventory_discovery_v1;
create function app_private.assert_event_runtime_supported_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
begin
  if p_definition ? 'inventoryDiscovery' then
    perform app_private.assert_event_inventory_discovery_v1(p_definition);
  end if;
  perform app_private.assert_event_runtime_before_inventory_discovery_v1(p_definition);
end; $$;

create function app_private.capture_event_inventory_discovery_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  definition jsonb;
  discovery jsonb;
begin
  if new.run_mode <> 'production' then return new; end if;
  select version.definition into definition
    from app_private.event_definition_versions version where version.id = new.definition_version_id;
  if not (definition ? 'inventoryDiscovery') then return new; end if;

  perform app_private.assert_event_inventory_discovery_v1(definition);
  discovery := definition->'inventoryDiscovery';
  insert into app_private.event_run_personal_journeys(run_id,giver_position,destination,journey)
  values (new.id,null,null,jsonb_build_object(
    'type','inventory-discovery','firstItemId',discovery->>'firstItemId',
    'secondItemId',discovery->>'secondItemId','completed',discovery->>'clue'
  ));
  return new;
end; $$;

create trigger capture_event_inventory_discovery_v1
after insert on app_private.event_runs
for each row execute function app_private.capture_event_inventory_discovery_v1();

create function app_private.advance_inventory_discovery_revision_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.lifecycle_status <> 'live' or (tg_op = 'UPDATE' and old.lifecycle_status = 'live') then
    return new;
  end if;
  if exists (
    select 1 from app_private.event_run_personal_journeys
    where run_id = new.id and journey->>'type' = 'inventory-discovery'
  ) then
    update app_private.event_inventory_discovery_revision set revision = revision + 1 where singleton;
  end if;
  return new;
end; $$;

create trigger update_inventory_discovery_revision_v1
after insert or update of lifecycle_status on app_private.event_runs
for each row execute function app_private.advance_inventory_discovery_revision_v1();

create function app_private.record_personal_inventory_discoveries_v1(
  p_user_id uuid,p_character_id uuid,p_item_id text,p_now timestamptz
)
returns void language sql volatile set search_path = '' as $$
  with carried as materialized (
    select distinct stack.item_id
    from app_private.character_item_stacks stack where stack.character_id = p_character_id
  ), eligible as (
    select run.id,run.event_key,run.started_at
    from carried first
    join app_private.event_run_personal_journeys quest on quest.journey->>'firstItemId' = first.item_id
    join carried second on quest.journey->>'secondItemId' = second.item_id
    join app_private.event_runs run on run.id = quest.run_id
    join public.characters character on character.id = p_character_id and character.user_id = p_user_id
    where quest.journey->>'type' = 'inventory-discovery'
      and (p_item_id is null or p_item_id in (quest.journey->>'firstItemId',quest.journey->>'secondItemId'))
      and app_private.personal_quest_run_available_v1(run,p_now)
      and not exists (
        select 1 from app_private.event_personal_quest_attempts attempt
        where attempt.character_id = p_character_id and attempt.event_key = run.event_key
          and attempt.completed_at is not null
      )
      and not exists (
        select 1 from app_private.character_deletion_requests request where request.character_id = character.id
      )
    order by run.id
    for share of run
  )
  -- Completing the discovery step reserves the existing once-per-event receipt.
  -- The public journal still shows the revealed story as open.
  insert into app_private.event_personal_quest_attempts(
    character_id,user_id,event_key,run_id,accepted_at,arrived_at,completed_at
  )
  select distinct on (event_key) p_character_id,p_user_id,event_key,id,p_now,p_now,p_now
  from eligible order by event_key,started_at desc,id
  on conflict do nothing;
$$;

create function app_private.observe_personal_inventory_discovery_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  stack app_private.character_item_stacks%rowtype;
  owner_id uuid;
begin
  stack := case when tg_op = 'DELETE' then old else new end;
  select character.user_id into owner_id from public.characters character where character.id = stack.character_id;
  if owner_id is not null then
    perform app_private.record_personal_inventory_discoveries_v1(owner_id,stack.character_id,stack.item_id,clock_timestamp());
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

-- Adding the first stack of an Item may meet the threshold. Removal observes
-- the carried pair immediately before it leaves, including pre-existing stock.
create trigger observe_personal_inventory_discovery_added_v1
after insert on app_private.character_item_stacks
for each row execute function app_private.observe_personal_inventory_discovery_v1();
create trigger observe_personal_inventory_discovery_removed_v1
before delete on app_private.character_item_stacks
for each row execute function app_private.observe_personal_inventory_discovery_v1();

alter function app_private.read_world_personal_quests_v1(uuid,uuid,jsonb,timestamptz)
  rename to read_world_personal_quests_before_inventory_discovery_v1;
create function app_private.read_world_personal_quests_v1(
  p_user_id uuid,p_character_id uuid,p_position jsonb,p_now timestamptz
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  current_revision bigint;
begin
  select global_revision.revision into current_revision
  from app_private.event_inventory_discovery_revision global_revision
  join app_private.character_world_state world on world.character_id = p_character_id
  where global_revision.singleton and global_revision.revision > world.inventory_discovery_revision;
  if found then
    perform app_private.record_personal_inventory_discoveries_v1(p_user_id,p_character_id,null,p_now);
    update app_private.character_world_state world set inventory_discovery_revision = current_revision
      where world.character_id = p_character_id and world.inventory_discovery_revision < current_revision
        and exists (select 1 from public.characters character
          where character.id = p_character_id and character.user_id = p_user_id);
  end if;
  return (
    select coalesce(jsonb_agg(
      case when row->>'giverId' is null then jsonb_build_object(
        'runId',row->'runId','title',row->'title','body',row->'body','discovery',true
      ) else row end order by ordinal
    ),'[]'::jsonb)
    from jsonb_array_elements(app_private.read_world_personal_quests_before_inventory_discovery_v1(
      p_user_id,p_character_id,p_position,p_now
    )) with ordinality rows(row,ordinal)
  );
end; $$;

revoke all on function app_private.assert_event_inventory_discovery_v1(jsonb),
  app_private.assert_event_runtime_supported_v1(jsonb),app_private.capture_event_inventory_discovery_v1(),
  app_private.advance_inventory_discovery_revision_v1(),
  app_private.record_personal_inventory_discoveries_v1(uuid,uuid,text,timestamptz),
  app_private.observe_personal_inventory_discovery_v1(),
  app_private.read_world_personal_quests_v1(uuid,uuid,jsonb,timestamptz)
from public,anon,authenticated,service_role;

commit;
