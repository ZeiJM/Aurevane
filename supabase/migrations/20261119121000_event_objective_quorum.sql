begin;

-- Keep phase ordering and the existing recovery transaction. Only the authored
-- condition expands from one objective to a count of confirmed objectives.
do $migration$
declare
  shape text := pg_get_functiondef('app_private.assert_event_definition_shape_v1(text,jsonb)'::regprocedure);
  recovery text := pg_get_functiondef('app_private.recover_event_phase_transition_v1(uuid,bigint)'::regprocedure);
  capability text := pg_get_functiondef('app_private.assert_event_runtime_before_inventory_discovery_v1(jsonb)'::regprocedure);
  transition_anchor constant text := 'elsif v_transition_type = ''objective-threshold'' then';
  capability_anchor constant text := 'if objective->>''completion'' is distinct from ''world-arrival'' and phase#>>''{transition,type}''=''objective-threshold'' and objective->>''id''=phase#>>''{transition,objectiveId}'' then';
begin
  if length(shape) - length(replace(shape, transition_anchor, '')) <> length(transition_anchor)
    or length(recovery) - length(replace(recovery, transition_anchor, '')) <> length(transition_anchor)
    or length(capability) - length(replace(capability, capability_anchor, '')) <> length(capability_anchor)
  then
    raise exception 'EVENT_QUORUM_PREDECESSOR_MISSING';
  end if;
  execute replace(shape, transition_anchor, $shape$
    elsif v_transition_type = 'objective-quorum' then
      if jsonb_typeof(v_transition->'objectiveIds') is distinct from 'array'
        or jsonb_typeof(v_transition->'required') is distinct from 'number'
        or coalesce(v_transition->>'required','') !~ '^[1-9][0-9]?$'
        or v_transition - array['type','objectiveIds','required'] <> '{}'::jsonb
      then
        raise exception using errcode = '22023', message = 'EVENT_DEFINITION_TRANSITION_INVALID';
      end if;
      if jsonb_array_length(v_transition->'objectiveIds') not between 2 and 48
        or (v_transition->>'required')::integer > jsonb_array_length(v_transition->'objectiveIds')
        or exists (
          select 1
          from jsonb_array_elements(v_transition->'objectiveIds') as member(value)
          group by member.value
          having count(*) > 1
            or jsonb_typeof(member.value) <> 'string'
            or not ((member.value #>> '{}') = any(v_phase_objective_ids))
        )
      then
        raise exception using errcode = '22023', message = 'EVENT_DEFINITION_TRANSITION_INVALID';
      end if;
    elsif v_transition_type = 'objective-threshold' then$shape$);
  execute replace(recovery, transition_anchor, $recovery$
  elsif v_transition_type = 'objective-quorum' then
    select count(*) >= (v_transition->>'required')::integer
    into v_due
    from app_private.event_run_objectives as objective
    where objective.run_id = p_run_id
      and objective.phase_id = v_current.phase_id
      and objective.objective_status = 'completed'
      and (v_transition->'objectiveIds') ? objective.objective_id;
  elsif v_transition_type = 'objective-threshold' then$recovery$);
  execute replace(capability, capability_anchor, $capability$
      if objective->>'completion' is distinct from 'world-arrival' and (
        (phase#>>'{transition,type}'='objective-threshold' and objective->>'id'=phase#>>'{transition,objectiveId}')
        or (phase#>>'{transition,type}'='objective-quorum' and (phase#>'{transition,objectiveIds}') ? (objective->>'id'))
      ) then$capability$);
end;
$migration$;

commit;
