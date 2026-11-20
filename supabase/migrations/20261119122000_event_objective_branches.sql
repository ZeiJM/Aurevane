begin;

-- Advancing, including a manual jump, leaves a durable skipped status for
-- untaken phases. Their inactive objectives never become eligible for credit.
create function app_private.skip_event_phases_v1(
  p_run_id uuid, p_from integer, p_to integer, p_now timestamptz
)
returns void language sql set search_path = '' as $$
  update app_private.event_run_phases
  set phase_status = 'skipped', completed_at = p_now, state_version = state_version + 1
  where run_id = p_run_id and ordinal > p_from and ordinal < p_to and phase_status = 'pending';
$$;
revoke all on function app_private.skip_event_phases_v1(uuid,integer,integer,timestamptz)
  from public, anon, authenticated, service_role;

do $migration$
declare
  shape text := pg_get_functiondef('app_private.assert_event_definition_shape_v1(text,jsonb)'::regprocedure);
  capability text := pg_get_functiondef('app_private.assert_event_runtime_before_inventory_discovery_v1(jsonb)'::regprocedure);
  shape_anchor constant text := '    v_transition_type := v_transition ->> ''type'';';
  quorum_anchor constant text := 'elsif v_transition_type = ''objective-quorum'' then';
  capability_anchor constant text := 'or (phase#>>''{transition,type}''=''objective-quorum'' and (phase#>''{transition,objectiveIds}'') ? (objective->>''id''))';
begin
  if length(shape) - length(replace(shape, shape_anchor, '')) <> length(shape_anchor)
    or length(shape) - length(replace(shape, quorum_anchor, '')) <> length(quorum_anchor)
    or length(capability) - length(replace(capability, capability_anchor, '')) <> length(capability_anchor)
  then
    raise exception 'EVENT_BRANCH_VALIDATION_PREDECESSOR_MISSING';
  end if;
  shape := replace(shape, shape_anchor, shape_anchor || $validate$

    if v_phase ? 'nextPhaseId' and (
      jsonb_typeof(v_phase->'nextPhaseId') is distinct from 'string'
      or v_transition_type = 'objective-branch'
      or (v_phase->>'nextPhaseId') = any(v_phase_ids)
      or not exists (
        select 1 from jsonb_array_elements(p_definition->'phases') destination
        where destination->>'id' = v_phase->>'nextPhaseId'
      )
    ) then
      raise exception using errcode = '22023', message = 'EVENT_DEFINITION_PHASE_DESTINATION_INVALID';
    end if;$validate$);
  execute replace(shape, quorum_anchor, $branch$
    elsif v_transition_type = 'objective-branch' then
      if jsonb_typeof(v_transition->'routes') is distinct from 'array'
        or v_transition - array['type','routes'] <> '{}'::jsonb
      then
        raise exception using errcode = '22023', message = 'EVENT_DEFINITION_TRANSITION_INVALID';
      end if;
      if jsonb_array_length(v_transition->'routes') not between 2 and 48
        or exists (
          select 1 from jsonb_array_elements(v_transition->'routes') route
          where jsonb_typeof(route) is distinct from 'object'
            or route - array['objectiveId','nextPhaseId'] <> '{}'::jsonb
            or jsonb_typeof(route->'objectiveId') is distinct from 'string'
            or not ((route->>'objectiveId') = any(v_phase_objective_ids))
            or jsonb_typeof(route->'nextPhaseId') is distinct from 'string'
            or (route->>'nextPhaseId') = any(v_phase_ids)
            or not exists (
              select 1 from jsonb_array_elements(p_definition->'phases') destination
              where destination->>'id' = route->>'nextPhaseId'
            )
        )
        or exists (
          select 1 from jsonb_array_elements(v_transition->'routes') route
          group by route->>'objectiveId' having count(*) > 1
        )
      then
        raise exception using errcode = '22023', message = 'EVENT_DEFINITION_TRANSITION_INVALID';
      end if;
    elsif v_transition_type = 'objective-quorum' then$branch$);
  execute replace(capability, capability_anchor, capability_anchor || $capability$
        or (phase#>>'{transition,type}'='objective-branch' and exists (
          select 1 from jsonb_array_elements(phase#>'{transition,routes}') route
          where route->>'objectiveId'=objective->>'id'
        ))$capability$);
end;
$migration$;

do $migration$
declare
  procedure_name text;
  definition text;
  predecessor text;
  replacement text;
  automated boolean;
  destination_anchor constant text := '    and phase.ordinal > v_current.ordinal';
  objective_anchor constant text := E'\n  update app_private.event_run_objectives as objective\n  set\n    objective_status = case';
begin
  foreach procedure_name in array array[
    'app_private.recover_event_phase_transition_v1(uuid,bigint)',
    'public.advance_event_run_phase_v1(uuid,uuid,bigint,uuid,text)',
    'public.advance_event_run_phase_v1(uuid,uuid,uuid,bigint,uuid,text)'
  ] loop
    automated := procedure_name like 'app_private.%';
    definition := pg_get_functiondef(procedure_name::regprocedure);
    if length(definition) - length(replace(definition, '  v_transition_type text;', '')) <> length('  v_transition_type text;')
      or length(definition) - length(replace(definition, destination_anchor, '')) <> length(destination_anchor)
      or length(definition) - length(replace(definition, objective_anchor, '')) <> length(objective_anchor)
    then
      raise exception 'EVENT_BRANCH_ADVANCE_PREDECESSOR_MISSING: %', procedure_name;
    end if;
    definition := replace(definition, '  v_transition_type text;',
      E'  v_transition_type text;\n  v_next_phase_id text;');
    if automated then
      predecessor := E'  select phase.value -> ''transition''\n  into v_transition';
      replacement := E'  select phase.value -> ''transition'', phase.value ->> ''nextPhaseId''\n  into v_transition, v_next_phase_id';
    else
      predecessor := E'  select phase.value #>> ''{transition,type}''\n  into v_transition_type';
      replacement := E'  select phase.value #>> ''{transition,type}'', phase.value ->> ''nextPhaseId''\n  into v_transition_type, v_next_phase_id';
    end if;
    if length(definition) - length(replace(definition, predecessor, '')) <> length(predecessor) then
      raise exception 'EVENT_BRANCH_PINNED_PHASE_PREDECESSOR_MISSING: %', procedure_name;
    end if;
    definition := replace(definition, predecessor, replacement);
    if automated then
      predecessor := 'elsif v_transition_type = ''objective-quorum'' then';
      if length(definition) - length(replace(definition, predecessor, '')) <> length(predecessor) then
        raise exception 'EVENT_BRANCH_RECOVERY_PREDECESSOR_MISSING';
      end if;
      definition := replace(definition, predecessor, $recovery$
  elsif v_transition_type = 'objective-branch' then
    select route.value->>'nextPhaseId'
    into v_next_phase_id
    from jsonb_array_elements(v_transition->'routes') with ordinality as route(value, ordinal)
    join app_private.event_run_objectives objective
      on objective.run_id = p_run_id and objective.phase_id = v_current.phase_id
      and objective.objective_id = route.value->>'objectiveId'
    where objective.objective_status = 'completed'
    order by objective.updated_at, route.ordinal
    limit 1;
    v_due := found;
  elsif v_transition_type = 'objective-quorum' then$recovery$);
    end if;
    definition := replace(definition, destination_anchor,
      destination_anchor || E'\n    and (v_next_phase_id is null or phase.phase_id = v_next_phase_id)');
    definition := replace(definition, objective_anchor, $advance$
  if v_next_phase_id is not null then
    if v_next.run_id is null or v_next.phase_status <> 'pending' then
      raise exception using errcode = '55000', message = 'EVENT_PINNED_PHASE_DESTINATION_UNAVAILABLE';
    end if;
    perform app_private.skip_event_phases_v1(p_run_id, v_current.ordinal, v_next.ordinal, v_now);
  end if;
$advance$ || objective_anchor);
    execute definition;
  end loop;
end;
$migration$;

commit;
