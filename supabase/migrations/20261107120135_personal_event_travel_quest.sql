begin;

-- These two reusable givers already exist at fixed, authoritative Watch placements.
create function app_private.event_personal_quest_giver_v1(p_giver_id text)
returns jsonb language sql immutable set search_path = '' as $$
  select case p_giver_id
    when 'eastern-watch-officer' then '{"sectorId":"verdant-expanse","x":2,"y":4}'::jsonb
    when 'crown-hinterland-watch-officer' then '{"sectorId":"aureth-crown","x":2,"y":4}'::jsonb
  end;
$$;

create function app_private.assert_event_personal_journey_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  journey jsonb := p_definition->'personalJourney';
  giver jsonb := app_private.event_personal_quest_giver_v1(journey->>'giverId');
  destination jsonb := journey->'destination';
  line text;
begin
  if jsonb_typeof(journey) is distinct from 'object'
    or journey->>'type' is distinct from 'travel-and-report'
    or not coalesce(p_definition->>'category' = 'story-campaigns' or (
      not (p_definition ? 'category') and p_definition->>'family' = 'narrative-event'
    ), false)
    or giver is null
    or jsonb_typeof(destination) is distinct from 'object'
    or jsonb_typeof(destination->'sectorId') is distinct from 'string'
    or not coalesce(destination->>'sectorId' ~ '^[a-z0-9][a-z0-9._:-]{1,159}$', false)
    or jsonb_typeof(destination->'x') is distinct from 'number'
    or coalesce(destination->>'x','') !~ '^([0-9]|1[0-2])$'
    or jsonb_typeof(destination->'y') is distinct from 'number'
    or coalesce(destination->>'y','') !~ '^[0-8]$'
    or giver = jsonb_build_object('sectorId', destination->'sectorId',
      'x', destination->'x', 'y', destination->'y')
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

  foreach line in array array['offer','active','ready','completed'] loop
    if jsonb_typeof(journey->line) is distinct from 'string'
      or char_length(journey->>line) not between 1 and 800
      or btrim(journey->>line) is distinct from journey->>line then
      raise exception using errcode = '22023', message = 'EVENT_PERSONAL_JOURNEY_DIALOGUE_INVALID';
    end if;
  end loop;
end; $$;

-- Index published occurrence givers separately from private progress so a moving
-- player never searches the staff catalogue, unrelated quests or another player's attempts.
create table app_private.event_run_personal_journeys (
  run_id uuid primary key references app_private.event_runs(id) on delete cascade,
  giver_position jsonb not null,
  destination jsonb not null,
  journey jsonb not null
);
create index event_personal_quest_giver_position_idx
  on app_private.event_run_personal_journeys (giver_position);

create table app_private.event_personal_quest_attempts (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null,
  user_id uuid not null,
  event_key text not null,
  run_id uuid not null references app_private.event_run_personal_journeys(run_id) on delete restrict,
  accepted_at timestamptz not null,
  arrived_at timestamptz check (arrived_at >= accepted_at),
  completed_at timestamptz check (completed_at is null or (arrived_at is not null and completed_at >= arrived_at)),
  awarded_xp bigint not null default 0 check (awarded_xp >= 0),
  unique (character_id, run_id)
);
create unique index event_personal_completed_quest_idx on app_private.event_personal_quest_attempts
  (character_id, event_key) where completed_at is not null;
create index event_personal_quest_history_idx on app_private.event_personal_quest_attempts
  (character_id, event_key, accepted_at desc);
create index event_personal_active_attempt_idx on app_private.event_personal_quest_attempts
  (character_id, run_id) where arrived_at is null;

alter table app_private.event_run_personal_journeys enable row level security;
alter table app_private.event_personal_quest_attempts enable row level security;
revoke all on app_private.event_run_personal_journeys, app_private.event_personal_quest_attempts
  from public, anon, authenticated, service_role;

create function app_private.capture_event_personal_journey_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  definition jsonb;
  journey jsonb;
begin
  select version.definition into definition
  from app_private.event_definition_versions version where version.id = new.definition_version_id;
  if new.run_mode <> 'production' or not (definition ? 'personalJourney') then return new; end if;
  perform app_private.assert_event_personal_journey_v1(definition);
  journey := definition->'personalJourney';
  insert into app_private.event_run_personal_journeys(run_id, giver_position, destination, journey)
  values (new.id, app_private.event_personal_quest_giver_v1(journey->>'giverId'),
    jsonb_build_object('sectorId', journey#>'{destination,sectorId}',
      'x', journey#>'{destination,x}', 'y', journey#>'{destination,y}'), journey);
  return new;
end; $$;
create trigger capture_event_personal_journey_v1
after insert on app_private.event_runs
for each row execute function app_private.capture_event_personal_journey_v1();

create function app_private.personal_quest_run_available_v1(
  p_run app_private.event_runs, p_at timestamptz
)
returns boolean language sql stable set search_path = '' as $$
  select p_run.run_mode = 'production' and p_run.lifecycle_status = 'live'
    and p_run.started_at is not null and p_run.started_at <= p_at
    and (p_run.scheduled_end_at is null or p_at < p_run.scheduled_end_at);
$$;

-- A pause keeps the same attempt; a terminal or expired occurrence frees a later
-- occurrence to offer a fresh attempt. Completed rewards remain once per event.
create function app_private.personal_quest_attempt_is_current_v1(
  p_run app_private.event_runs, p_at timestamptz
)
returns boolean language sql stable set search_path = '' as $$
  select p_run.lifecycle_status in ('live','paused')
    and (p_run.scheduled_end_at is null or p_at < p_run.scheduled_end_at);
$$;

create function app_private.read_world_personal_quests_v1(
  p_user_id uuid, p_character_id uuid, p_position jsonb, p_now timestamptz
)
returns jsonb language sql stable set search_path = '' as $$
  with known as (
    select attempt.run_id, attempt.accepted_at, attempt.arrived_at, attempt.completed_at, attempt.awarded_xp
    from app_private.event_personal_quest_attempts attempt
    join app_private.event_runs original on original.id = attempt.run_id
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id
      and (attempt.completed_at is not null or app_private.personal_quest_attempt_is_current_v1(original,p_now))
    union all
    select journey.run_id, null, null, null, 0
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
    order by (known.completed_at is not null), known.accepted_at desc nulls first, known.run_id
    limit 48
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'runId', public_rows.run_id,
    'title', title,
    'giverId', journey->>'giverId',
    'progress', case when completed_at is not null then 'completed'
      when arrived_at is not null then 'ready' when accepted_at is not null then 'active' else 'available' end,
    'body', case when completed_at is not null then journey->>'completed'
      when not available then 'This quest is currently paused.'
      when arrived_at is not null then journey->>'ready'
      when accepted_at is not null then journey->>'active' else journey->>'offer' end,
    'destination', case when not available or accepted_at is null or completed_at is not null then null
      when arrived_at is not null then giver_position else destination end,
    'local', giver_position = p_position,
    'action', case when not available or giver_position <> p_position or completed_at is not null then null
      when accepted_at is null then 'accept' when arrived_at is not null then 'report' else null end,
    'awardedXp', awarded_xp
  ) order by (completed_at is not null), accepted_at desc nulls first, run_id), '[]'::jsonb)
  from public_rows;
$$;

create function app_private.record_world_personal_arrivals_v1(
  p_user_id uuid, p_character_id uuid, p_route jsonb, p_prefix bigint, p_first_at bigint
)
returns void language plpgsql set search_path = '' as $$
declare
  candidate record;
  current_run app_private.event_runs%rowtype;
begin
  if not exists (
    select 1 from app_private.event_personal_quest_attempts attempt
    join app_private.event_runs run on run.id = attempt.run_id
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id
      and attempt.arrived_at is null and run.run_mode = 'production' and run.lifecycle_status = 'live'
      and (run.scheduled_end_at is null or to_timestamp(p_first_at / 1000.0) < run.scheduled_end_at)
  ) then return; end if;
  for candidate in
    with arrivals as (
      select step.value->'position' position,
        to_timestamp((p_first_at + sum(
          case when step.ordinality = 1 then 0 else (step.value->>'durationMs')::bigint end
        ) over (order by step.ordinality)) / 1000.0) arrived_at
      from jsonb_array_elements(p_route) with ordinality step(value, ordinality)
      where step.ordinality <= p_prefix
    )
    select attempt.id, attempt.run_id, min(arrivals.arrived_at) arrived_at
    from app_private.event_personal_quest_attempts attempt
    join app_private.event_run_personal_journeys journey on journey.run_id = attempt.run_id
    join arrivals on arrivals.position = journey.destination and arrivals.arrived_at >= attempt.accepted_at
    join app_private.event_runs run on run.id = attempt.run_id
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id
      and attempt.arrived_at is null and app_private.personal_quest_run_available_v1(run, arrivals.arrived_at)
    group by attempt.id, attempt.run_id
    order by attempt.run_id
  loop
    select * into current_run from app_private.event_runs where id = candidate.run_id for update;
    if found and app_private.personal_quest_run_available_v1(current_run, candidate.arrived_at)
      and coalesce((
        select transition.to_status from app_private.event_run_transitions transition
        where transition.run_id = candidate.run_id and transition.occurred_at <= candidate.arrived_at
        order by transition.occurred_at desc, transition.id desc limit 1
      ), 'live') = 'live' then
      update app_private.event_personal_quest_attempts set arrived_at = candidate.arrived_at
      where id = candidate.id and arrived_at is null;
    end if;
  end loop;
end; $$;

-- The same world version and ownership locks serialize movement, explicit replies and
-- retries. The report and every fixed, approved XP reward commit together.
create function public.commit_world_personal_quest_v1(
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
  if p_action is null or p_action not in ('accept', 'report') then
    raise exception 'WORLD_QUEST_ACTION_UNAVAILABLE' using errcode = '22023';
  end if;
  select * into current_run from app_private.event_runs where id = p_run_id for update;
  action_at := clock_timestamp();
  if not found or not app_private.personal_quest_run_available_v1(current_run, action_at) then
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
  elsif p_action = 'report' and found and attempt.run_id = p_run_id
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

revoke all on function app_private.event_personal_quest_giver_v1(text),
  app_private.assert_event_personal_journey_v1(jsonb),
  app_private.capture_event_personal_journey_v1(),
  app_private.personal_quest_run_available_v1(app_private.event_runs,timestamptz),
  app_private.personal_quest_attempt_is_current_v1(app_private.event_runs,timestamptz),
  app_private.read_world_personal_quests_v1(uuid,uuid,jsonb,timestamptz),
  app_private.record_world_personal_arrivals_v1(uuid,uuid,jsonb,bigint,bigint)
from public, anon, authenticated, service_role;
revoke all on function public.commit_world_personal_quest_v1(uuid,uuid,bigint,uuid,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.commit_world_personal_quest_v1(uuid,uuid,bigint,uuid,uuid,text,text)
  to service_role;

do $migration$
declare
  body text;
  runtime_anchor constant text := '  for phase in select value from jsonb_array_elements';
  reward_anchor constant text := '    raise exception using errcode=''22023'',message=''EVENT_REWARD_PRODUCER_UNAVAILABLE';
  movement_anchor constant text := '    perform app_private.record_world_event_arrivals_v1(';
  projection_anchor constant text := '''eventObjectives'',v_events,';
begin
  body := pg_get_functiondef('app_private.assert_event_runtime_supported_v1(jsonb)'::regprocedure);
  if strpos(body, runtime_anchor) = 0 or strpos(body, reward_anchor) = 0 then
    raise exception 'EVENT_PERSONAL_JOURNEY_GUARD_PREDECESSOR_MISSING';
  end if;
  body := replace(body, runtime_anchor,
    E'  if p_definition ? ''personalJourney'' then\n    perform app_private.assert_event_personal_journey_v1(p_definition);\n  end if;\n' || runtime_anchor);
  body := replace(body,
    E'  if jsonb_array_length(coalesce(p_definition->''rewardPackageRefs'',''[]''))>0 then\n' || reward_anchor,
    E'  if not (p_definition ? ''personalJourney'') and jsonb_array_length(coalesce(p_definition->''rewardPackageRefs'',''[]''))>0 then\n' || reward_anchor);
  execute body;

  body := pg_get_functiondef('public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)'::regprocedure);
  if strpos(body, movement_anchor) = 0 then raise exception 'EVENT_PERSONAL_JOURNEY_MOVEMENT_PREDECESSOR_MISSING'; end if;
  -- Reuse the already-authorized route prefix for both shared and personal travel.
  body := replace(body,
    $walk$    perform app_private.record_world_event_arrivals_v1(
      p_user_id, p_character_id, v_old_route, v_k, v_old_next
    );$walk$,
    $walk$    perform app_private.record_world_event_arrivals_v1(
      p_user_id, p_character_id, v_old_route, v_k, v_old_next
    );
    perform app_private.record_world_personal_arrivals_v1(
      p_user_id, p_character_id, v_old_route, v_k, v_old_next
    );$walk$);
  body := replace(body,
    $cross$    perform app_private.record_world_event_arrivals_v1(
      p_user_id, p_character_id,
      jsonb_build_array(jsonb_build_object('position', p_next_state->'position')), 1, v_now
    );$cross$,
    $cross$    perform app_private.record_world_event_arrivals_v1(
      p_user_id, p_character_id,
      jsonb_build_array(jsonb_build_object('position', p_next_state->'position')), 1, v_now
    );
    perform app_private.record_world_personal_arrivals_v1(
      p_user_id, p_character_id,
      jsonb_build_array(jsonb_build_object('position', p_next_state->'position')), 1, v_now
    );$cross$);
  if strpos(body, 'record_world_personal_arrivals_v1') = 0 then
    raise exception 'EVENT_PERSONAL_JOURNEY_MOVEMENT_PATCH_FAILED';
  end if;
  execute body;

  body := pg_get_functiondef('public.read_world_state_v1(uuid,uuid,jsonb)'::regprocedure);
  if strpos(body, projection_anchor) = 0 then raise exception 'EVENT_PERSONAL_JOURNEY_PROJECTION_PREDECESSOR_MISSING'; end if;
  body := replace(body, projection_anchor, projection_anchor ||
    '''personalQuests'',app_private.read_world_personal_quests_v1(p_user_id,p_character_id,v_state->''position'',clock_timestamp()),');
  execute body;
end; $migration$;

commit;
