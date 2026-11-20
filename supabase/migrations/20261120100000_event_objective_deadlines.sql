begin;

create function app_private.event_quorum_deadline_v1(p_transition jsonb, p_started_at timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select p_started_at + make_interval(secs => (p_transition#>>'{deadline,afterSeconds}')::integer)
  where p_transition->>'type' = 'objective-quorum' and p_transition ? 'deadline';
$$;
revoke all on function app_private.event_quorum_deadline_v1(jsonb,timestamptz)
  from public, anon, authenticated, service_role;

do $migration$
declare
  patch record;
  definition text;
begin
  for patch in select * from (values
    ('app_private.assert_event_definition_shape_v1(text,jsonb)',
      'v_transition - array[''type'',''objectiveIds'',''required'']',
      'v_transition - array[''type'',''objectiveIds'',''required'',''deadline'']'),
    ('app_private.assert_event_definition_shape_v1(text,jsonb)',
      '      if jsonb_array_length(v_transition->''objectiveIds'') not between 2 and 48',
      $shape$
      if v_transition ? 'deadline' then
        if jsonb_typeof(v_transition->'deadline') is distinct from 'object'
          or (v_transition->'deadline') - array['afterSeconds','nextPhaseId'] <> '{}'::jsonb
          or jsonb_typeof(v_transition#>'{deadline,afterSeconds}') is distinct from 'number'
          or coalesce(v_transition#>>'{deadline,afterSeconds}','') !~ '^[1-9][0-9]{0,9}$'
          or jsonb_typeof(v_transition#>'{deadline,nextPhaseId}') is distinct from 'string'
        then
          raise exception using errcode = '22023', message = 'EVENT_DEFINITION_DEADLINE_INVALID';
        end if;
        if (v_transition#>>'{deadline,afterSeconds}')::bigint > 2147483647
          or v_transition#>>'{deadline,nextPhaseId}' = any(v_phase_ids)
          or v_transition#>>'{deadline,nextPhaseId}' = coalesce(
            v_phase->>'nextPhaseId', (p_definition->'phases'->cardinality(v_phase_ids))->>'id')
          or not exists (
            select 1 from jsonb_array_elements(p_definition->'phases') destination
            where destination->>'id' = v_transition#>>'{deadline,nextPhaseId}'
          )
          or exists (
            select 1 from jsonb_array_elements(v_phase->'objectives') objective
            where objective->>'completion' is distinct from 'world-arrival'
          )
        then
          raise exception using errcode = '22023', message = 'EVENT_DEFINITION_DEADLINE_INVALID';
        end if;
      end if;
      if jsonb_array_length(v_transition->'objectiveIds') not between 2 and 48$shape$),
    ('app_private.recover_event_phase_transition_v1(uuid,bigint)',
      '  v_next_phase_id text;',
      E'  v_next_phase_id text;\n  v_deadline timestamptz;'),
    ('app_private.recover_event_phase_transition_v1(uuid,bigint)',
      '  elsif v_transition_type = ''objective-quorum'' then',
      $clock$  elsif v_transition_type = 'objective-quorum' then
    v_deadline := app_private.event_quorum_deadline_v1(v_transition, v_current.started_at);$clock$),
    ('app_private.recover_event_phase_transition_v1(uuid,bigint)',
      '      and (v_transition->''objectiveIds'') ? objective.objective_id;',
      $branch$      and (v_transition->'objectiveIds') ? objective.objective_id
      and (v_deadline is null or objective.updated_at < v_deadline);
    if not v_due and v_deadline <= v_now then
      v_due := true;
      v_next_phase_id := v_transition#>>'{deadline,nextPhaseId}';
    end if;$branch$),
    ('app_private.record_event_contribution_v1(text,uuid,text,uuid,uuid,uuid,text,text,text,text,bigint,jsonb,boolean)',
      '  insert into app_private.event_participants (',
      $credit$
  -- The movement transaction already holds the run lock. An expired arrival
  -- has no contribution, but still completes the normal World movement.
  if p_confirmed_world_arrival and exists (
    select 1
    from app_private.event_definition_versions version
    join app_private.event_run_phases phase
      on phase.run_id = p_run_id and phase.phase_id = p_phase_id
    cross join lateral jsonb_array_elements(version.definition->'phases') authored
    where version.id = v_run.definition_version_id and authored->>'id' = p_phase_id
      and app_private.event_quorum_deadline_v1(authored->'transition', phase.started_at) <= v_recorded_at
  ) then
    return;
  end if;

  insert into app_private.event_participants ($credit$)
  ) as edits(signature, predecessor, replacement)
  loop
    definition := pg_get_functiondef(patch.signature::regprocedure);
    if length(definition) - length(replace(definition, patch.predecessor, '')) <> length(patch.predecessor) then
      raise exception 'EVENT_DEADLINE_PREDECESSOR_MISSING: %', patch.signature;
    end if;
    execute replace(definition, patch.predecessor, patch.replacement);
  end loop;
end;
$migration$;

commit;
