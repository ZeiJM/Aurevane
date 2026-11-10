begin;

-- Scheduled occurrences index the arrival targets from their immutable definition.
-- Legacy map guidance has no contribution producer and retains its legacy shape.
alter table app_private.event_run_objectives add column arrival_position jsonb;
create index event_run_active_arrival_position_idx
  on app_private.event_run_objectives (arrival_position)
  where arrival_position is not null and objective_status = 'active';

create function app_private.capture_event_arrival_position_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  select jsonb_build_object(
    'sectorId', objective#>'{worldNavigation,sectorId}',
    'x', objective#>'{worldNavigation,x}',
    'y', objective#>'{worldNavigation,y}'
  ) into new.arrival_position
  from app_private.event_runs run
  join app_private.event_definition_versions version on version.id = run.definition_version_id
  cross join lateral jsonb_array_elements(version.definition->'phases') phase
  cross join lateral jsonb_array_elements(phase->'objectives') objective
  where run.id = new.run_id and phase->>'id' = new.phase_id
    and objective->>'id' = new.objective_id and objective->>'completion' = 'world-arrival';
  return new;
end; $$;
revoke all on function app_private.capture_event_arrival_position_v1()
  from public, anon, authenticated, service_role;
create trigger capture_event_arrival_position_v1
before insert on app_private.event_run_objectives
for each row execute function app_private.capture_event_arrival_position_v1();

-- Only committed movement may call this helper. The prefix and timestamps come from
-- the saved server route after the normal position and pacing checks have passed.
create function app_private.record_world_event_arrivals_v1(
  p_user_id uuid, p_character_id uuid, p_route jsonb, p_prefix bigint, p_first_at bigint
)
returns void language plpgsql set search_path = '' as $$
declare
  candidate record;
  current_run app_private.event_runs%rowtype;
  source_key text;
begin
  if not exists (
    select 1 from app_private.event_run_objectives
    where arrival_position is not null and objective_status = 'active'
  ) then return; end if;

  for candidate in
    with arrivals as (
      select step.value->'position' as position,
        to_timestamp((p_first_at + sum(
          case when step.ordinality = 1 then 0 else (step.value->>'durationMs')::bigint end
        ) over (order by step.ordinality)) / 1000.0) as arrived_at
      from jsonb_array_elements(p_route) with ordinality step(value, ordinality)
      where step.ordinality <= p_prefix
    )
    select objective.run_id, objective.phase_id, objective.objective_id,
      arrivals.position, arrivals.arrived_at
    from arrivals
    join app_private.event_run_objectives objective
      on objective.arrival_position = arrivals.position and objective.objective_status = 'active'
    join app_private.event_runs run
      on run.id = objective.run_id and run.current_phase_id = objective.phase_id
    where run.run_mode = 'production' and run.lifecycle_status = 'live'
    order by objective.run_id, objective.phase_id, objective.objective_id, arrivals.arrived_at
  loop
    -- Use the kernel's lock order. Recheck the live phase and cutoff after waiting
    -- for staff operations or a simultaneous player's threshold contribution.
    select * into current_run from app_private.event_runs where id = candidate.run_id for update;
    if not found or current_run.lifecycle_status <> 'live'
      or current_run.current_phase_id is distinct from candidate.phase_id
      or current_run.started_at is null or candidate.arrived_at < current_run.started_at
      or (current_run.scheduled_end_at is not null and candidate.arrived_at >= current_run.scheduled_end_at)
      or coalesce((
        select transition.to_status from app_private.event_run_transitions transition
        where transition.run_id = candidate.run_id and transition.occurred_at <= candidate.arrived_at
        order by transition.occurred_at desc, transition.id desc limit 1
      ), 'live') <> 'live'
      or not exists (
        select 1 from app_private.event_run_objectives objective
        where objective.run_id = candidate.run_id and objective.phase_id = candidate.phase_id
          and objective.objective_id = candidate.objective_id and objective.objective_status = 'active'
      ) then continue; end if;

    source_key := md5(jsonb_build_array(candidate.phase_id, candidate.objective_id, p_character_id)::text);
    if exists (
      select 1 from app_private.event_contributions contribution
      where contribution.run_id = candidate.run_id
        and contribution.source_system = 'world-arrival' and contribution.source_reference = source_key
    ) then continue; end if;

    perform public.record_event_contribution_v1(
      'system:world-arrival', gen_random_uuid(), source_key, candidate.run_id, p_user_id,
      p_character_id, candidate.phase_id, candidate.objective_id, 'world-arrival', source_key, 1,
      jsonb_build_object('position', candidate.position, 'arrivedAt', candidate.arrived_at)
    );
  end loop;
end; $$;
revoke all on function app_private.record_world_event_arrivals_v1(uuid, uuid, jsonb, bigint, bigint)
  from public, anon, authenticated, service_role;

-- Preserve the old guard for every unsupported block. This one block has a typed
-- target and a private producer, and is restricted to public World Events.
do $migration$
declare
  body text;
  hidden_anchor constant text := '      if app_private.event_definition_is_hidden_v1(p_definition)';
  threshold_anchor constant text := '      if phase#>>''{transition,type}''=''objective-threshold''';
begin
  body := pg_get_functiondef('app_private.assert_event_runtime_supported_v1(jsonb)'::regprocedure);
  if strpos(body, hidden_anchor) = 0 or strpos(body, threshold_anchor) = 0 then
    raise exception 'EVENT_ARRIVAL_GUARD_PREDECESSOR_MISSING';
  end if;
  body := replace(body, hidden_anchor, $guard$
      if objective ? 'completion' and (
        objective->>'completion' is distinct from 'world-arrival'
        or objective->>'type' is distinct from 'discover'
        or coalesce(p_definition->>'category', 'world-events') <> 'world-events'
        or p_definition->>'family' in ('narrative-event','lore-revelation')
          and not (p_definition ? 'category')
        or jsonb_typeof(objective->'worldNavigation') is distinct from 'object'
        or coalesce(objective#>>'{worldNavigation,sectorId}','') !~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
        or coalesce(objective#>>'{worldNavigation,x}','') !~ '^([0-9]|1[0-2])$'
        or coalesce(objective#>>'{worldNavigation,y}','') !~ '^[0-8]$'
        or not (
          p_definition#>>'{scope,type}' = 'global'
          or (p_definition#>>'{scope,type}' = 'region'
            and p_definition#>>'{scope,key}' in (
              objective#>>'{worldNavigation,sectorId}',
              'region.' || (objective#>>'{worldNavigation,sectorId}')
            ))
        )
      ) then
        raise exception using errcode = '22023', message = 'EVENT_WORLD_ARRIVAL_CONFIGURATION_INVALID';
      end if;
$guard$ || hidden_anchor);
  body := replace(body, threshold_anchor,
    '      if objective->>''completion'' is distinct from ''world-arrival'' and phase#>>''{transition,type}''=''objective-threshold''');
  execute body;
end; $migration$;

do $migration$
declare
  body text;
  movement_anchor constant text := E'  return p_next_state;\nend;';
  projection_anchor constant text := '''navigation'',objective->''worldNavigation'') payload';
  visibility_anchor constant text := '     and jsonb_typeof(objective->''worldNavigation'')=''object''';
begin
  body := pg_get_functiondef('public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)'::regprocedure);
  if strpos(body, movement_anchor) = 0 or strpos(body, 'v_old_next+v_span>v_now') = 0 then
    raise exception 'EVENT_ARRIVAL_MOVEMENT_PREDECESSOR_MISSING';
  end if;
  body := replace(body, movement_anchor, $movement$
  if v_moved then
    perform app_private.record_world_event_arrivals_v1(
      p_user_id, p_character_id, v_old_route, v_k, v_old_next
    );
  elsif p_kind = 'cross' and p_next_state->'position' is distinct from v_world.state->'position' then
    perform app_private.record_world_event_arrivals_v1(
      p_user_id, p_character_id,
      jsonb_build_array(jsonb_build_object('position', p_next_state->'position')), 1, v_now
    );
  end if;
$movement$ || movement_anchor);
  execute body;

  body := pg_get_functiondef('public.read_world_state_v1(uuid,uuid,jsonb)'::regprocedure);
  if strpos(body, projection_anchor) = 0 or strpos(body, visibility_anchor) = 0 then
    raise exception 'EVENT_ARRIVAL_PROJECTION_PREDECESSOR_MISSING';
  end if;
  body := replace(body, projection_anchor, $projection$
'navigation',objective->'worldNavigation',
     'completed',case when objective->>'completion' = 'world-arrival' then exists(
       select 1 from app_private.event_contributions contribution
       where contribution.run_id = r.id and contribution.character_id = p_character_id
         and contribution.phase_id = r.current_phase_id
         and contribution.objective_id = objective->>'id'
         and contribution.source_system = 'world-arrival'
     ) else false end) payload$projection$);
  body := replace(body, visibility_anchor,
    '     and not app_private.event_definition_is_hidden_v1(d.definition)' || E'\n' || visibility_anchor);
  execute body;
end; $migration$;

commit;
