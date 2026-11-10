begin;

-- Existing completed_at is the irrevocable exchange receipt. This separate
-- timestamp records the later battle objective and never reopens the exchange.
alter table app_private.event_personal_quest_attempts
  add column realm_completed_at timestamptz check (
    realm_completed_at is null or (completed_at is not null and realm_completed_at >= completed_at)
  ),
  add column realm_return_safe boolean,
  add column realm_hand_over_command_id uuid check (
    realm_hand_over_command_id is null or completed_at is not null
  );

create unique index event_personal_realm_hand_over_command_idx
  on app_private.event_personal_quest_attempts (character_id, realm_hand_over_command_id)
  where realm_hand_over_command_id is not null;

create table app_private.event_personal_realm_battles (
  battle_session_id uuid primary key references app_private.battle_sessions(id) on delete cascade,
  attempt_id uuid not null references app_private.event_personal_quest_attempts(id) on delete cascade,
  admitted_at timestamptz not null default clock_timestamp()
);
create index event_personal_realm_attempt_battles_idx
  on app_private.event_personal_realm_battles (attempt_id, admitted_at desc);
alter table app_private.event_personal_realm_battles enable row level security;
revoke all on app_private.event_personal_realm_battles from public, anon, authenticated, service_role;

create function app_private.personal_realm_npc_id_pattern_v1()
returns text language sql immutable set search_path = '' as $$
  select '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text;
$$;

create function app_private.personal_realm_story_npc_v1(p_npc_id text)
returns jsonb language sql stable set search_path = '' as $$
  select story from app_private.npc_designs where id =
    case when p_npc_id ~ app_private.personal_realm_npc_id_pattern_v1() then p_npc_id::uuid end;
$$;

create or replace function app_private.event_personal_quest_giver_v1(p_giver_id text)
returns jsonb language sql stable set search_path = '' as $$
  select case p_giver_id
    when 'eastern-watch-officer' then '{"sectorId":"verdant-expanse","x":2,"y":4}'::jsonb
    when 'crown-hinterland-watch-officer' then '{"sectorId":"aureth-crown","x":2,"y":4}'::jsonb
    else (
      select jsonb_build_object('sectorId', world->'sectorId', 'x', world->'x', 'y', world->'y')
      from app_private.npc_designs where story is not null and world is not null
        and world->>'sectorId' not like 'sealed-realm:%'
        and id = case when p_giver_id ~ app_private.personal_realm_npc_id_pattern_v1() then p_giver_id::uuid end
    )
  end;
$$;

create function app_private.personal_realm_position_v1(p_attempt_id uuid)
returns jsonb language sql immutable strict set search_path = '' as $$
  select jsonb_build_object('sectorId', 'sealed-realm:' || p_attempt_id::text, 'x', 6, 'y', 4);
$$;

create or replace function app_private.assert_event_personal_journey_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  journey jsonb := p_definition->'personalJourney';
  giver jsonb := app_private.event_personal_quest_giver_v1(journey->>'giverId');
  destination jsonb := journey->'destination';
  item_exchange boolean := journey->>'type' = 'item-exchange';
  realm jsonb := journey->'realm';
  line text;
begin
  if realm is not null and (
    giver is null or not coalesce(journey->>'giverId' ~ app_private.personal_realm_npc_id_pattern_v1(), false)
    or realm->>'guardianNpcId' is not distinct from journey->>'giverId'
    or app_private.personal_realm_story_npc_v1(realm->>'guardianNpcId') is null
    or (p_definition#>>'{scope,type}' = 'region' and not coalesce(
      p_definition#>>'{scope,key}' in (giver->>'sectorId','region.'||(giver->>'sectorId')), false
    ))
  ) then
    raise exception using errcode = '22023', message = 'EVENT_PERSONAL_REALM_NPCS_UNAVAILABLE';
  end if;
  if jsonb_typeof(journey) is distinct from 'object'
    or not coalesce(journey->>'type' in ('travel-and-report','item-exchange'), false)
    or not coalesce(p_definition->>'category' = 'story-campaigns' or (
      not (p_definition ? 'category') and p_definition->>'family' = 'narrative-event'
    ), false)
    or giver is null
    or (realm is null and not coalesce(journey->>'giverId' in (
      'eastern-watch-officer','crown-hinterland-watch-officer'
    ), false))
    or (realm is not null and (not item_exchange
      or jsonb_typeof(realm) is distinct from 'object'
      or (realm - array['guardianNpcId','lore','access','challenge','retry']) <> '{}'::jsonb
      or jsonb_array_length(coalesce(p_definition->'rewardPackageRefs', '[]')) = 0
    ))
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
      (journey - array['type','giverId','inputItemId','inputQuantity','outputItemId','offer','active','ready','completed','realm']) <> '{}'::jsonb
      or jsonb_typeof(journey->'inputQuantity') is distinct from 'number'
      or not coalesce(journey->>'inputQuantity' ~ '^[1-9][0-9]{0,2}$', false)
      or (realm is null and jsonb_array_length(coalesce(p_definition->'rewardPackageRefs', '[]')) <> 0)
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

  if realm is not null then
    foreach line in array array['lore','access','challenge','retry'] loop
      if jsonb_typeof(realm->line) is distinct from 'string'
        or char_length(realm->>line) not between 1 and 800
        or btrim(realm->>line) is distinct from realm->>line then
        raise exception using errcode = '22023', message = 'EVENT_PERSONAL_JOURNEY_DIALOGUE_INVALID';
      end if;
    end loop;
  end if;

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
  journey := definition->'personalJourney';
  if journey ? 'realm' then
    -- Keep both published identities/placement consistent across validation and capture.
    perform 1 from app_private.npc_designs
    where id in (
      case when journey->>'giverId' ~ app_private.personal_realm_npc_id_pattern_v1()
        then (journey->>'giverId')::uuid end,
      case when journey#>>'{realm,guardianNpcId}' ~ app_private.personal_realm_npc_id_pattern_v1()
        then (journey#>>'{realm,guardianNpcId}')::uuid end
    ) order by id for share;
  end if;
  perform app_private.assert_event_personal_journey_v1(definition);
  if journey->>'type' = 'item-exchange' then
    journey := journey || app_private.personal_exchange_items_v1(journey);
    if journey ? 'realm' then
      journey := journey || jsonb_build_object(
        'giver', app_private.personal_realm_story_npc_v1(journey->>'giverId'),
        'guardian', app_private.personal_realm_story_npc_v1(journey#>>'{realm,guardianNpcId}')
          || '{"arenaId":"duel-yard","aiDifficulty":"high","lore":""}'::jsonb
      );
    end if;
  else
    destination := jsonb_build_object('sectorId', journey#>'{destination,sectorId}',
      'x', journey#>'{destination,x}', 'y', journey#>'{destination,y}');
  end if;
  insert into app_private.event_run_personal_journeys(run_id, giver_position, destination, journey)
  values (new.id, app_private.event_personal_quest_giver_v1(journey->>'giverId'), destination, journey);
  return new;
end; $$;

-- Ordinary expiry keeps the earned campaign playable; staff stop actions
-- block new admissions without ejecting players or invalidating existing battles.
create function app_private.personal_realm_challenge_available_v1(p_run app_private.event_runs)
returns boolean language sql immutable set search_path = '' as $$
  select p_run.lifecycle_status not in ('paused','cancelled','emergency-stopped')
    and p_run.cancelled_at is null and p_run.emergency_stopped_at is null;
$$;

-- The journal keeps its existing offer/attempt visibility and limit, but always
-- includes the current realm and maps the settled exchange to an active chapter.
create or replace function app_private.read_world_personal_quests_v1(
  p_user_id uuid, p_character_id uuid, p_position jsonb, p_now timestamptz
)
returns jsonb language sql stable set search_path = '' as $$
  with known as (
    select attempt.id attempt_id, attempt.realm_completed_at, attempt.run_id, attempt.accepted_at, attempt.arrived_at, attempt.completed_at, attempt.awarded_xp, attempt.item_claim_pending
    from app_private.event_personal_quest_attempts attempt
    join app_private.event_runs original on original.id = attempt.run_id
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id
      and (attempt.completed_at is not null or app_private.personal_quest_attempt_is_current_v1(original,p_now))
    union all
    select null, null, journey.run_id, null, null, null, 0, false
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
      version.definition->>'title' title,
      app_private.personal_realm_challenge_available_v1(run) challenge_available,
      app_private.personal_realm_position_v1(known.attempt_id) realm_position,
      case when journey.journey ? 'realm' then
        app_private.event_personal_quest_giver_v1(journey.journey->>'giverId') = journey.giver_position
      end giver_available, app_private.personal_quest_run_available_v1(run, p_now) available
    from known
    join app_private.event_run_personal_journeys journey on journey.run_id = known.run_id
    join app_private.event_runs run on run.id = known.run_id
    join app_private.event_definition_versions version on version.id = run.definition_version_id
    where not (journey.journey ? 'realm') or known.attempt_id is not null
      or app_private.event_personal_quest_giver_v1(journey.journey->>'giverId') = journey.giver_position
    order by coalesce(p_position->>'sectorId' = app_private.personal_realm_position_v1(known.attempt_id)->>'sectorId',false) desc,
      known.item_claim_pending desc, (known.completed_at is not null), known.accepted_at desc nulls first, known.run_id
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
  , base as (
    select progress_rows.*,
      p_position->>'sectorId' = realm_position->>'sectorId' inside,
      p_position = giver_position at_gate,
      jsonb_build_object(
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
  ) else '{}'::jsonb end row
    from progress_rows
  )
  select coalesce(jsonb_agg(
    case when not (journey ? 'realm') then row
    else row || jsonb_build_object(
      'speaker', case when inside or (completed_at is not null and giver_available is not true)
        then 'Sealed realm gate' else journey#>>'{giver,name}' end,
      'portraitUrl', case when not coalesce(inside,false) and giver_available then journey#>>'{giver,imageUrl}' end,
      'portraitRef', case when not coalesce(inside,false) and giver_available then journey#>>'{giver,portraitRef}' end,
      'lore', case when at_gate and giver_available then journey#>>'{realm,lore}' end,
      'progress', case when completed_at is not null and realm_completed_at is null then 'active' else row->>'progress' end,
      'body', case when realm_completed_at is not null then journey->>'completed'
        when inside and not challenge_available then 'The guardian challenge is currently unavailable.'
        when inside and exists (
          select 1 from app_private.event_personal_realm_battles fight where fight.attempt_id = base.attempt_id
        ) then journey#>>'{realm,retry}'
        when inside then journey#>>'{realm,challenge}'
        when completed_at is not null then journey#>>'{realm,access}'
        when giver_available is not true then 'The quest giver is currently unavailable.' else row->>'body' end,
      'destination', case when inside and challenge_available and realm_completed_at is null then realm_position
        when completed_at is not null and not coalesce(inside,false)
          and (realm_completed_at is null or row->'itemClaimPending' = 'true'::jsonb) then giver_position
        when giver_available then row->'destination' end,
      'local', coalesce(inside,false) or (at_gate and (completed_at is not null or giver_available is true)),
      'action', case when inside and (not challenge_available or realm_completed_at is not null or p_position <> realm_position) then 'leave-realm'
        when inside then 'challenge-realm'
        when not at_gate then null
        when row->>'action' = 'claim-exchange' then 'claim-exchange'
        when completed_at is not null then 'travel-realm'
        when giver_available then row->>'action' end,
      'alternativeAction', case when inside and challenge_available and realm_completed_at is null and p_position = realm_position then 'leave-realm'
        when at_gate and row->>'action' = 'claim-exchange' then 'travel-realm' end
    ) end order by coalesce(inside,false) desc, item_claim_pending desc,
      (completed_at is not null), accepted_at desc nulls first, run_id
  ), '[]'::jsonb)
  from base;
$$;

alter function public.commit_world_personal_quest_v1(uuid,uuid,bigint,uuid,uuid,text,text)
  rename to commit_world_personal_quest_before_realm_v1;
revoke all on function public.commit_world_personal_quest_before_realm_v1(uuid,uuid,bigint,uuid,uuid,text,text)
  from public,anon,authenticated,service_role;

create function public.commit_world_personal_quest_v1(
  p_user_id uuid, p_character_id uuid, p_expected_version bigint, p_command_id uuid,
  p_run_id uuid, p_action text, p_request_fingerprint text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  world app_private.character_world_state%rowtype;
  attempt app_private.event_personal_quest_attempts%rowtype;
  quest app_private.event_run_personal_journeys%rowtype;
  realm_position jsonb;
  destination jsonb;
  v_state jsonb;
  block text;
  bound_run_id uuid;
  realm_hand_over boolean;
begin
  select * into quest from app_private.event_run_personal_journeys where run_id = p_run_id;
  realm_hand_over := coalesce(quest.journey ? 'realm' and p_action = 'hand-over', false);
  select a.run_id into bound_run_id from app_private.event_personal_quest_attempts a
    where a.character_id = p_character_id and a.user_id = p_user_id
      and a.realm_hand_over_command_id = p_command_id;
  if bound_run_id is not null and (not realm_hand_over or bound_run_id <> p_run_id) then
    raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT';
  end if;

  if p_action is null or p_action not in ('travel-realm','leave-realm') then
    if realm_hand_over then
      -- Enter in the same order as inventory and World writes. This lets an
      -- exact receipt replay precede the current giver check without admitting
      -- a new hand-in after retirement.
      perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,false);
      select * into world from app_private.character_world_state where character_id = p_character_id for update;
      if world.last_command_id = p_command_id then
        if world.last_command_fingerprint is distinct from p_request_fingerprint
          or (world.state->>'version')::bigint - 1 is distinct from p_expected_version
          or not exists (
            select 1 from app_private.event_personal_quest_attempts a
            where a.character_id = p_character_id and a.user_id = p_user_id and a.run_id = p_run_id
              and a.realm_hand_over_command_id = p_command_id
          ) then
          raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT';
        end if;
        return world.state;
      end if;
    end if;

    if quest.journey ? 'realm' and p_action in ('accept','hand-over') then
      -- Serialize publication changes to this placement with consequential replies.
      perform 1 from app_private.npc_designs where id = (quest.journey->>'giverId')::uuid for share;
      if app_private.event_personal_quest_giver_v1(quest.journey->>'giverId') is distinct from quest.giver_position then
        raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
      end if;
    end if;
    v_state := public.commit_world_personal_quest_before_realm_v1(
      p_user_id,p_character_id,p_expected_version,p_command_id,p_run_id,p_action,p_request_fingerprint
    );
    if realm_hand_over then
      update app_private.event_personal_quest_attempts
        set realm_hand_over_command_id = p_command_id
        where character_id = p_character_id and user_id = p_user_id and run_id = p_run_id
          and completed_at is not null;
    end if;
    return v_state;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
  perform 1 from public.characters c where c.id = p_character_id and c.user_id = p_user_id
    and not exists(select 1 from app_private.character_deletion_requests d where d.character_id = c.id)
    for update;
  if not found then raise exception using errcode = '42501', message = 'WORLD_NOT_OWNED'; end if;
  select * into world from app_private.character_world_state where character_id = p_character_id for update;
  if not found then raise exception 'WORLD_STATE_UNAVAILABLE'; end if;
  if p_command_id is null or p_request_fingerprint is null then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  if world.last_command_id = p_command_id then
    if world.last_command_fingerprint is distinct from p_request_fingerprint then
      raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT';
    end if;
    return world.state;
  end if;
  if (world.state->>'version')::bigint is distinct from p_expected_version then
    raise exception using errcode = 'PT409', message = 'WORLD_STALE_VERSION';
  end if;
  select * into attempt from app_private.event_personal_quest_attempts
    where character_id = p_character_id and user_id = p_user_id and run_id = p_run_id;
  if not coalesce(quest.journey ? 'realm',false) or attempt.completed_at is null then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  realm_position := app_private.personal_realm_position_v1(attempt.id);
  if jsonb_array_length(world.state->'route') <> 0
    or (p_action = 'travel-realm' and world.state->'position' is distinct from quest.giver_position)
    or (p_action = 'leave-realm' and
      world.state#>>'{position,sectorId}' is distinct from realm_position->>'sectorId') then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_OUT_OF_RANGE';
  end if;
  block := app_private.world_block_reason_v1(p_user_id,p_character_id);
  if block is not null then raise exception using errcode = '22023', message = block; end if;
  if p_action = 'travel-realm' then
    update app_private.event_personal_quest_attempts set realm_return_safe = coalesce((world.state->>'safe')::boolean,false)
      where id = attempt.id;
    destination := realm_position;
  else
    destination := quest.giver_position;
  end if;
  -- Relocate and advance the receipt together so World presence invalidates
  -- both sectors from the same versioned update.
  v_state := world.state || jsonb_build_object(
    'position', destination, 'safe', p_action = 'travel-realm' or coalesce(attempt.realm_return_safe,false),
    'version', p_expected_version + 1, 'nextStepAt', null, 'routeDestination', null, 'routeObjectiveId', null
  );
  update app_private.character_world_state set
    state = v_state, last_command_id = p_command_id,
    last_command_fingerprint = p_request_fingerprint, last_seen_at = clock_timestamp()
    where character_id = p_character_id;
  return v_state;
end; $$;

-- The initial preparation read never exposes the guardian outside its own realm.
create function app_private.personal_realm_guardian_v1(
  p_user_id uuid, p_character_id uuid, p_run_id uuid, p_world jsonb
)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  attempt app_private.event_personal_quest_attempts%rowtype;
  guardian jsonb;
begin
  select * into attempt from app_private.event_personal_quest_attempts
    where character_id = p_character_id and user_id = p_user_id and run_id = p_run_id;
  select quest.journey->'guardian' into guardian
    from app_private.event_run_personal_journeys quest
    join app_private.event_runs run on run.id = quest.run_id
    where quest.run_id = p_run_id and app_private.personal_realm_challenge_available_v1(run);
  if guardian is null or attempt.completed_at is null or attempt.realm_completed_at is not null then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  if p_world->'position' is distinct from app_private.personal_realm_position_v1(attempt.id)
    or jsonb_array_length(p_world->'route') <> 0 then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_OUT_OF_RANGE';
  end if;
  return guardian;
end; $$;

create function public.read_world_personal_realm_battle_v1(
  p_user_id uuid,p_character_id uuid,p_run_id uuid,p_expected_version bigint
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare state jsonb;
begin
  select w.state into state from app_private.character_world_state w join public.characters c
    on c.id = w.character_id and c.user_id = p_user_id where w.character_id = p_character_id;
  if state is null then raise exception using errcode = '42501', message = 'WORLD_NOT_OWNED'; end if;
  if (state->>'version')::bigint is distinct from p_expected_version then
    raise exception using errcode = 'PT409', message = 'WORLD_STALE_VERSION';
  end if;
  return app_private.personal_realm_guardian_v1(p_user_id,p_character_id,p_run_id,state);
end; $$;

create function public.start_world_personal_realm_battle_v1(
  p_user_id uuid,p_character_id uuid,p_expected_version bigint,p_command_id uuid,p_run_id uuid,
  p_world_fingerprint text,p_request_fingerprint text,p_battle_id text,p_rules_version integer,
  p_content_version integer,p_initial_snapshot jsonb,p_participants jsonb,p_start_snapshot jsonb,
  p_initial_events jsonb,p_privacy_journal jsonb
)
returns table(battle_session_id uuid,battle_version bigint,snapshot jsonb,created_at timestamptz,replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare
  world app_private.character_world_state%rowtype;
  guardian jsonb;
  created record;
  block text;
  attempt_id uuid;
begin
  -- Match the shared Item/combat admission order before taking World locks.
  if not pg_try_advisory_xact_lock_shared(hashtextextended('combat-catalogue-publication',0))
    or not pg_try_advisory_xact_lock(hashtextextended(p_user_id::text,0)) then
    raise exception using errcode = 'PT409', message = 'WORLD_STALE_BATTLE_ADMISSION';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
  perform 1 from public.characters c where c.id = p_character_id and c.user_id = p_user_id
    and not exists(select 1 from app_private.character_deletion_requests d where d.character_id = c.id)
    for update;
  if not found then raise exception using errcode = '42501', message = 'WORLD_NOT_OWNED'; end if;
  select * into world from app_private.character_world_state where character_id = p_character_id for update;
  if world.last_command_id = p_command_id then
    if world.last_command_fingerprint is distinct from p_world_fingerprint then
      raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT';
    end if;
    return query select replay.* from public.get_battle_creation_replay_v1(
      p_user_id,p_command_id,p_request_fingerprint
    ) replay join app_private.event_personal_realm_battles fight on fight.battle_session_id = replay.battle_session_id
    join app_private.event_personal_quest_attempts attempt on attempt.id = fight.attempt_id
      and attempt.character_id = p_character_id and attempt.run_id = p_run_id;
    if not found then raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT'; end if;
    return;
  end if;
  if (world.state->>'version')::bigint is distinct from p_expected_version then
    raise exception using errcode = 'PT409', message = 'WORLD_STALE_VERSION';
  end if;
  perform 1 from app_private.event_runs where id = p_run_id for share;
  guardian := app_private.personal_realm_guardian_v1(p_user_id,p_character_id,p_run_id,world.state);
  block := app_private.world_block_reason_v1(p_user_id,p_character_id);
  if block is not null then raise exception using errcode = '22023', message = block; end if;
  if (p_initial_snapshot->'arenaNpc') is distinct from (guardian - array['arenaId','aiDifficulty','lore'])
    or (p_start_snapshot is null and p_initial_snapshot#>>'{tactical,battle,lifecycle}' is distinct from 'active')
    or (p_start_snapshot is not null and p_start_snapshot->'arenaNpc' is distinct from p_initial_snapshot->'arenaNpc')
    or coalesce(jsonb_array_length(p_participants),0) <> 2
    or not p_participants @> jsonb_build_array(jsonb_build_object(
      'character_id',p_character_id,'combatant_id','character:'||p_character_id::text,'participant_role','player'
    ))
    or not p_participants @> '[{"character_id":null,"participant_role":"opponent"}]'::jsonb then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  select attempt.id into strict attempt_id from app_private.event_personal_quest_attempts attempt
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id and attempt.run_id = p_run_id;
  -- Same constructor and startup appender as ordinary v2 creation. Link before
  -- appending so an Automatic effect that ends combat at startup can settle.
  select * into strict created from public.create_battle_session_v1(
    p_user_id::text,p_command_id,p_request_fingerprint,p_user_id,p_battle_id,
    p_rules_version,p_content_version,coalesce(p_start_snapshot,p_initial_snapshot),p_participants
  );
  if created.replayed then raise exception using errcode = '22023', message = 'WORLD_COMMAND_CONFLICT'; end if;
  insert into app_private.event_personal_realm_battles(battle_session_id,attempt_id)
    values(created.battle_session_id,attempt_id);
  if p_start_snapshot is not null then
    perform app_private.append_battle_startup_events_v1(
      created.battle_session_id,p_start_snapshot,p_initial_snapshot,p_initial_events,p_privacy_journal,created.created_at
    );
  end if;
  update app_private.character_world_state set
    last_command_id = p_command_id, last_command_fingerprint = p_world_fingerprint
    where character_id = p_character_id;
  return query select created.battle_session_id,created.battle_version,p_initial_snapshot,created.created_at,false;
end; $$;

-- This consumes only the linked engine event stored by canonical combat commit.
-- An abandoned battle has no completed victory; a surrender, draw or loss has
-- no player-winning team backed by a defeated opponent in the final snapshot.
create function app_private.settle_personal_realm_victory_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  attempt app_private.event_personal_quest_attempts%rowtype;
  reward record;
  xp record;
  xp_key text;
  xp_total bigint := 0;
begin
  select a.* into attempt from app_private.event_personal_realm_battles fight
    join app_private.event_personal_quest_attempts a on a.id = fight.attempt_id
    join app_private.battle_sessions battle on battle.id = fight.battle_session_id
      and battle.lifecycle = 'completed' and battle.current_version = new.battle_version
    where fight.battle_session_id = new.battle_session_id and a.realm_completed_at is null
      and new.event->>'winningTeamId' is not null
      and exists (
        select 1 from jsonb_array_elements(battle.current_snapshot#>'{tactical,battle,combatants}') c
        where c->>'id' = 'character:'||a.character_id::text
          and c->>'teamId' = new.event->>'winningTeamId'
      )
      and exists (
        select 1 from app_private.battle_participants p
        join lateral jsonb_array_elements(battle.current_snapshot#>'{tactical,battle,combatants}') c
          on c->>'id' = p.combatant_id and c->>'teamId' <> new.event->>'winningTeamId'
        where p.battle_session_id = new.battle_session_id and p.participant_role = 'opponent'
          and (c->>'hp')::numeric = 0
      )
    for update of a;
  if not found then return new; end if;

  for reward in
    select package.* from app_private.event_runs run
    join app_private.event_definition_versions version on version.id = run.definition_version_id
    cross join lateral jsonb_array_elements_text(version.definition->'rewardPackageRefs') reference
    join app_private.event_reward_packages package on package.reward_package_ref = reference.value
    where run.id = attempt.run_id order by package.reward_package_ref
  loop
    xp_key := md5(jsonb_build_array(attempt.id,reward.reward_package_ref)::text);
    select * into xp from public.grant_character_xp_v1(
      attempt.character_id, xp_key::uuid, xp_key, 'system:event-quest', 'gameplay',
      'event.quest:' || xp_key, 'event.quest.reward', reward.amount
    );
    if not found or xp.grant_id is null then raise exception 'WORLD_QUEST_REWARD_UNAVAILABLE'; end if;
    xp_total := xp_total + xp.applied_amount;
  end loop;
  update app_private.event_personal_quest_attempts
    set realm_completed_at = clock_timestamp(), awarded_xp = xp_total where id = attempt.id;
  return new;
end; $$;

create trigger settle_personal_realm_victory_v1
after insert on app_private.battle_events
for each row when (new.event->>'event' = 'battle_completed')
execute function app_private.settle_personal_realm_victory_v1();

revoke all on function app_private.personal_realm_npc_id_pattern_v1(),
  app_private.personal_realm_story_npc_v1(text), app_private.personal_realm_position_v1(uuid),
  app_private.personal_realm_challenge_available_v1(app_private.event_runs),
  app_private.personal_realm_guardian_v1(uuid,uuid,uuid,jsonb),
  app_private.read_world_personal_quests_v1(uuid,uuid,jsonb,timestamptz),
  app_private.settle_personal_realm_victory_v1()
from public,anon,authenticated,service_role;

revoke all on function public.commit_world_personal_quest_v1(uuid,uuid,bigint,uuid,uuid,text,text),
  public.read_world_personal_realm_battle_v1(uuid,uuid,uuid,bigint),
  public.start_world_personal_realm_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)
from public,anon,authenticated;
grant execute on function public.commit_world_personal_quest_v1(uuid,uuid,bigint,uuid,uuid,text,text),
  public.read_world_personal_realm_battle_v1(uuid,uuid,uuid,bigint),
  public.start_world_personal_realm_battle_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)
to service_role;

commit;
