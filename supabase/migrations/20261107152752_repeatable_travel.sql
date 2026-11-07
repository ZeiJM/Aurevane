begin;

-- These occurrences share the Event schedule but own independent attempt IDs.
create table app_private.event_run_repeatable_travel (
  run_id uuid primary key references app_private.event_runs(id) on delete cascade,
  journey jsonb not null,
  giver_position jsonb not null,
  destination jsonb not null,
  recurrence jsonb not null
);
create index event_repeatable_travel_giver_idx
  on app_private.event_run_repeatable_travel(giver_position);
create table app_private.event_repeatable_travel_attempts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references app_private.event_run_repeatable_travel(run_id) on delete restrict,
  event_key text not null,
  user_id uuid not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  accepted_at timestamptz not null,
  arrived_at timestamptz check (arrived_at >= accepted_at),
  completed_at timestamptz check (completed_at is null or (arrived_at is not null and completed_at >= arrived_at)),
  next_available_at timestamptz check (next_available_at > completed_at),
  expired_at timestamptz check (expired_at is null or (expired_at >= accepted_at and completed_at is null)),
  check ((completed_at is null) = (next_available_at is null))
);
create unique index event_repeatable_travel_open_idx
  on app_private.event_repeatable_travel_attempts(character_id, event_key)
  where completed_at is null and expired_at is null;
create index event_repeatable_travel_history_idx
  on app_private.event_repeatable_travel_attempts(character_id, event_key, accepted_at desc);
alter table app_private.event_run_repeatable_travel enable row level security;
alter table app_private.event_repeatable_travel_attempts enable row level security;
revoke all on app_private.event_run_repeatable_travel, app_private.event_repeatable_travel_attempts
  from public, anon, authenticated, service_role;

create function app_private.assert_repeatable_travel_v1(p_definition jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  travel jsonb := p_definition->'repeatableTravel';
  journey jsonb := travel->'journey';
  recurrence jsonb := travel->'recurrence';
begin
  if jsonb_typeof(travel) is distinct from 'object'
    or (travel - array['journey','recurrence']) <> '{}'::jsonb
    or p_definition->>'category' is distinct from 'repeatable-activities'
    or p_definition ? 'personalJourney'
    or jsonb_typeof(journey) is distinct from 'object'
    or journey->>'type' is distinct from 'travel-and-report'
    or (journey - array['type','giverId','destination','offer','active','ready','completed']) <> '{}'::jsonb
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
  -- Reuse the existing travel route, Watch giver, audience and dialogue rules.
  perform app_private.assert_event_personal_journey_v1(
    p_definition || jsonb_build_object('category','story-campaigns','personalJourney',journey)
  );
end;
$$;

alter function app_private.assert_event_runtime_supported_v1(jsonb)
  rename to assert_event_runtime_before_repeatable_travel_v1;
create function app_private.assert_event_runtime_supported_v1(p_definition jsonb)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_definition ? 'repeatableTravel' then
    perform app_private.assert_repeatable_travel_v1(p_definition);
  end if;
  perform app_private.assert_event_runtime_before_repeatable_travel_v1(p_definition);
end;
$$;

create function app_private.capture_repeatable_travel_v1()
returns trigger language plpgsql set search_path = '' as $$
declare definition jsonb; travel jsonb;
begin
  if new.run_mode <> 'production' then return new; end if;
  select version.definition into definition
  from app_private.event_definition_versions version where version.id = new.definition_version_id;
  if not (definition ? 'repeatableTravel') then return new; end if;
  perform app_private.assert_repeatable_travel_v1(definition);
  travel := definition->'repeatableTravel';
  insert into app_private.event_run_repeatable_travel(run_id, journey, giver_position, destination, recurrence)
  values(new.id, travel->'journey',
    app_private.event_personal_quest_giver_v1(travel#>>'{journey,giverId}'),
    jsonb_build_object('sectorId', travel#>'{journey,destination,sectorId}',
      'x', travel#>'{journey,destination,x}', 'y', travel#>'{journey,destination,y}'),
    travel->'recurrence');
  return new;
end;
$$;
create trigger capture_repeatable_travel_v1 after insert on app_private.event_runs
for each row execute function app_private.capture_repeatable_travel_v1();

create function app_private.repeatable_travel_now_v1()
returns timestamptz language sql volatile set search_path = '' as $$
  select clock_timestamp();
$$;

create function app_private.repeatable_travel_next_v1(p_completed_at timestamptz, p_recurrence jsonb)
returns timestamptz language sql stable strict set search_path = '' as $$
  select case p_recurrence->>'mode'
    when 'rolling-24h' then p_completed_at + interval '24 hours'
    else (select resets_at from app_private.calendar_reset_window_v1(p_completed_at,
      case p_recurrence->>'mode' when 'calendar-day' then 'day' when 'calendar-week' then 'week' end,
      p_recurrence->>'timeZone', (p_recurrence->>'resetMinute')::integer))
  end;
$$;

-- Use exactly the same admission rule for the offer and the commit.
create function app_private.repeatable_travel_can_accept_v1(
  p_character_id uuid, p_event_key text, p_at timestamptz
)
returns boolean language sql stable set search_path = '' as $$
  select not exists (
    select 1 from app_private.event_repeatable_travel_attempts attempt
    join app_private.event_runs run on run.id = attempt.run_id
    where attempt.character_id = p_character_id and attempt.event_key = p_event_key
      and (attempt.next_available_at > p_at or
        (attempt.completed_at is null and attempt.expired_at is null
          and app_private.personal_quest_attempt_is_current_v1(run,p_at)))
  );
$$;

create function app_private.read_world_repeatable_travel_v1(
  p_user_id uuid, p_character_id uuid, p_position jsonb, p_now timestamptz
)
returns jsonb language sql stable set search_path = '' as $$
  with offers as (
    select run.id reference_id, run.id run_id, null::timestamptz accepted_at, null::timestamptz arrived_at,
      null::timestamptz next_available_at
    from app_private.event_run_repeatable_travel travel
    join app_private.event_runs run on run.id = travel.run_id
    where travel.giver_position = p_position and app_private.personal_quest_run_available_v1(run,p_now)
      and app_private.repeatable_travel_can_accept_v1(p_character_id,run.event_key,p_now)
  ), known as (
    select attempt.id reference_id, attempt.run_id, attempt.accepted_at, attempt.arrived_at, attempt.next_available_at
    from app_private.event_repeatable_travel_attempts attempt
    join app_private.event_runs run on run.id = attempt.run_id
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id and attempt.expired_at is null
      and (attempt.next_available_at > p_now or (attempt.completed_at is null
        and app_private.personal_quest_attempt_is_current_v1(run,p_now)))
  ), visible as (
    select steps.*, travel.journey, travel.destination, travel.giver_position,
      version.definition->>'title' title, app_private.personal_quest_run_available_v1(run,p_now) available
    from (select * from known union all select * from offers) steps
    join app_private.event_run_repeatable_travel travel on travel.run_id = steps.run_id
    join app_private.event_runs run on run.id = steps.run_id
    join app_private.event_definition_versions version on version.id = run.definition_version_id
    order by (steps.next_available_at is not null), steps.accepted_at desc nulls first, steps.reference_id
    limit 48
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'runId', reference_id,
    'title', title,
    'giverId', journey->>'giverId',
    'progress', case when next_available_at is not null then 'completed'
      when arrived_at is not null then 'ready' when accepted_at is not null then 'active' else 'available' end,
    'body', case when next_available_at is not null then journey->>'completed'
      when not available then 'This activity is currently paused.'
      when arrived_at is not null then journey->>'ready'
      when accepted_at is not null then journey->>'active' else journey->>'offer' end,
    'nextAvailableAt', next_available_at,
    'destination', case when not available or accepted_at is null or next_available_at is not null then null
      when arrived_at is not null then giver_position else destination end,
    'local', giver_position = p_position,
    'action', case when not available or giver_position <> p_position or next_available_at is not null then null
      when accepted_at is null then 'accept' when arrived_at is not null then 'report' else null end
  ) order by (next_available_at is not null), accepted_at desc nulls first, reference_id), '[]'::jsonb)
  from visible;
$$;

create function app_private.record_world_repeatable_arrivals_v1(
  p_user_id uuid, p_character_id uuid, p_route jsonb, p_prefix bigint, p_first_at bigint
)
returns void language plpgsql set search_path = '' as $$
declare candidate record; current_run app_private.event_runs%rowtype;
begin
  if not exists (select 1 from app_private.event_repeatable_travel_attempts attempt
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id
      and attempt.completed_at is null and attempt.expired_at is null and attempt.arrived_at is null) then return; end if;

  for candidate in
    with arrivals as (
      select step.value->'position' position,
        to_timestamp((p_first_at + sum(
          case when step.ordinality = 1 then 0 else (step.value->>'durationMs')::bigint end
        ) over (order by step.ordinality)) / 1000.0) arrived_at
      from jsonb_array_elements(p_route) with ordinality step(value, ordinality)
      where step.ordinality <= p_prefix
    )
    select attempt.id, attempt.run_id, arrivals.arrived_at
    from app_private.event_repeatable_travel_attempts attempt
    join app_private.event_run_repeatable_travel travel on travel.run_id = attempt.run_id
    join app_private.event_runs run on run.id = attempt.run_id
    join arrivals on arrivals.position = travel.destination and arrivals.arrived_at >= attempt.accepted_at
    where attempt.character_id = p_character_id and attempt.user_id = p_user_id
      and attempt.completed_at is null and attempt.expired_at is null and attempt.arrived_at is null
      and app_private.personal_quest_run_available_v1(run,arrivals.arrived_at)
    order by attempt.run_id, attempt.id, arrivals.arrived_at
  loop
    select * into current_run from app_private.event_runs where id = candidate.run_id for update;
    if found and app_private.personal_quest_run_available_v1(current_run,candidate.arrived_at)
      and coalesce((select transition.to_status from app_private.event_run_transitions transition
        where transition.run_id = candidate.run_id and transition.occurred_at <= candidate.arrived_at
        order by transition.occurred_at desc, transition.id desc limit 1), 'live') = 'live' then
      update app_private.event_repeatable_travel_attempts set arrived_at = candidate.arrived_at
      where id = candidate.id and arrived_at is null and expired_at is null;
    end if;
  end loop;
end;
$$;

create function public.commit_world_repeatable_travel_v1(
  p_user_id uuid, p_character_id uuid, p_expected_version bigint, p_command_id uuid,
  p_reference_id uuid, p_action text, p_request_fingerprint text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  world app_private.character_world_state%rowtype;
  current_run app_private.event_runs%rowtype;
  travel app_private.event_run_repeatable_travel%rowtype;
  attempt app_private.event_repeatable_travel_attempts%rowtype;
  previous_fingerprint text;
  action_at timestamptz;
  selected_run uuid;
  command_name constant text := 'event.repeatable-travel.v1';
begin
  if p_action is null or p_action not in ('accept','report')
    or p_command_id is null or p_request_fingerprint is null then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
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

  if p_action = 'report' then
    select * into attempt from app_private.event_repeatable_travel_attempts
      where id = p_reference_id and character_id = p_character_id and user_id = p_user_id;
    selected_run := attempt.run_id;
  else
    selected_run := p_reference_id;
  end if;
  select * into current_run from app_private.event_runs where id = selected_run for update;
  action_at := app_private.repeatable_travel_now_v1();
  if not found or not app_private.personal_quest_run_available_v1(current_run,action_at) then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;
  select * into travel from app_private.event_run_repeatable_travel where run_id = selected_run;
  if not found then raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE'; end if;
  if world.state->'position' is distinct from travel.giver_position
    or jsonb_array_length(world.state->'route') <> 0 then
    raise exception using errcode = '22023', message = 'WORLD_QUEST_OUT_OF_RANGE';
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
  elsif p_action = 'report' and attempt.arrived_at is not null and attempt.arrived_at <= action_at
    and attempt.completed_at is null and attempt.expired_at is null then
    update app_private.event_repeatable_travel_attempts set completed_at = action_at,
      next_available_at = app_private.repeatable_travel_next_v1(action_at,travel.recurrence)
    where id = attempt.id;
  else
    raise exception using errcode = '22023', message = 'WORLD_QUEST_ACTION_UNAVAILABLE';
  end if;

  insert into app_private.idempotency_records(actor_key,command_name,idempotency_key,request_fingerprint,result)
  values(p_character_id::text,command_name,p_command_id,p_request_fingerprint,'{}'::jsonb);
  return world.state;
end;
$$;

revoke all on function app_private.assert_repeatable_travel_v1(jsonb),
  app_private.assert_event_runtime_supported_v1(jsonb), app_private.assert_event_runtime_before_repeatable_travel_v1(jsonb),
  app_private.capture_repeatable_travel_v1(), app_private.repeatable_travel_now_v1(),
  app_private.repeatable_travel_next_v1(timestamptz,jsonb), app_private.repeatable_travel_can_accept_v1(uuid,text,timestamptz),
  app_private.read_world_repeatable_travel_v1(uuid,uuid,jsonb,timestamptz),
  app_private.record_world_repeatable_arrivals_v1(uuid,uuid,jsonb,bigint,bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.commit_world_repeatable_travel_v1(uuid,uuid,bigint,uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.commit_world_repeatable_travel_v1(uuid,uuid,bigint,uuid,uuid,text,text) to service_role;

-- Existing route and position authority produces repeatable arrivals alongside
-- existing producers. The World read exposes a distinct interaction collection.
do $migration$
declare
  body text;
  walk constant text := $walk$    perform app_private.record_world_personal_arrivals_v1(
      p_user_id, p_character_id, v_old_route, v_k, v_old_next
    );$walk$;
  cross_sector constant text := $cross$    perform app_private.record_world_personal_arrivals_v1(
      p_user_id, p_character_id,
      jsonb_build_array(jsonb_build_object('position', p_next_state->'position')), 1, v_now
    );$cross$;
  projection constant text := '''eventObjectives'',v_events,';
begin
  body := pg_get_functiondef('public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)'::regprocedure);
  if strpos(body,walk) = 0 or strpos(body,cross_sector) = 0 then
    raise exception 'EVENT_REPEATABLE_TRAVEL_MOVEMENT_PREDECESSOR_MISSING';
  end if;
  body := replace(body, walk, walk || chr(10) || replace(walk,'record_world_personal_arrivals_v1','record_world_repeatable_arrivals_v1'));
  body := replace(body, cross_sector, cross_sector || chr(10) || replace(cross_sector,'record_world_personal_arrivals_v1','record_world_repeatable_arrivals_v1'));
  execute body;

  body := pg_get_functiondef('public.read_world_state_before_ferry_v1(uuid,uuid,jsonb)'::regprocedure);
  if strpos(body,projection) = 0 then raise exception 'EVENT_REPEATABLE_TRAVEL_READ_PREDECESSOR_MISSING'; end if;
  body := replace(body, projection, projection ||
    '''repeatableActivities'',app_private.read_world_repeatable_travel_v1(p_user_id,p_character_id,v_state->''position'',app_private.repeatable_travel_now_v1()),');
  execute body;
end;
$migration$;

commit;
