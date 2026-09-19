begin;

create or replace function app_private.assert_event_definition_shape_v1(
  p_event_key text,
  p_definition jsonb
)
returns void
language plpgsql
immutable
set search_path = pg_catalog, app_private
as $
declare
  v_scope_type text;
  v_scope_key text;
  v_phase jsonb;
  v_objective jsonb;
  v_effect jsonb;
  v_transition jsonb;
  v_ref jsonb;
  v_phase_ids text[] := array[]::text[];
  v_objective_ids text[] := array[]::text[];
  v_phase_objective_ids text[];
  v_phase_id text;
  v_objective_id text;
  v_transition_type text;
begin
  if p_event_key is null
    or p_event_key !~ '^[a-z0-9][a-z0-9._:-]{1,159}revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;

    or p_definition is null
    or jsonb_typeof(p_definition) <> 'object'
    or coalesce(p_definition ->> 'eventKey','') <> p_event_key
    or coalesce(p_definition ->> 'schemaVersion','') <> '1'
    or coalesce(p_definition ->> 'templateKey','') !~ '^[a-z0-9][a-z0-9._:-]{1,159}revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;

    or coalesce(jsonb_typeof(p_definition -> 'contentVersion'),'') <> 'number'
    or coalesce(p_definition ->> 'contentVersion','') !~ '^[1-9][0-9]*revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;

    or (p_definition ->> 'contentVersion')::numeric > 9007199254740991::numeric
    or char_length(coalesce(p_definition ->> 'title','')) not between 1 and 120
    or btrim(coalesce(p_definition ->> 'title','')) <> coalesce(p_definition ->> 'title','')
    or char_length(coalesce(p_definition ->> 'summary','')) not between 1 and 600
    or btrim(coalesce(p_definition ->> 'summary','')) <> coalesce(p_definition ->> 'summary','')
    or char_length(coalesce(p_definition ->> 'internalNotes','')) > 4000
    or coalesce(p_definition ->> 'family','') not in (
      'world-crisis',
      'regional-event',
      'narrative-event',
      'community-objective',
      'legendary-hunt',
      'expedition-event',
      'pvp-event',
      'seasonal-event',
      'nation-event',
      'profession-event',
      'micro-event',
      'lore-revelation'
    )
    or coalesce(jsonb_typeof(p_definition -> 'phases'),'') <> 'array'
    or jsonb_array_length(p_definition -> 'phases') not between 1 and 24
    or coalesce(jsonb_typeof(p_definition -> 'rewardPackageRefs'),'') <> 'array'
    or coalesce(jsonb_typeof(p_definition -> 'aftermathRefs'),'') <> 'array'
    or app_private.event_definition_contains_forbidden_key_v1(p_definition)
  then
    raise exception using errcode = '22023', message = 'EVENT_DEFINITION_INVALID';
  end if;

  v_scope_type := p_definition #>> '{scope,type}';
  v_scope_key := p_definition #>> '{scope,key}';

  if v_scope_type not in ('global','region','node','cohort')
    or (v_scope_type = 'global' and v_scope_key is not null)
    or (
      v_scope_type <> 'global'
      and (
        v_scope_key is null
        or v_scope_key !~ '^[a-z0-9][a-z0-9._:-]{1,159}revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;

      )
    ) then
    raise exception using errcode = '22023', message = 'EVENT_DEFINITION_SCOPE_INVALID';
  end if;

  for v_phase in
    select phase.value
    from jsonb_array_elements(p_definition -> 'phases') as phase(value)
  loop
    if jsonb_typeof(v_phase) <> 'object'
      or coalesce(v_phase ->> 'id','') !~ '^[a-z0-9][a-z0-9._:-]{1,159}revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;

      or char_length(coalesce(v_phase ->> 'name','')) not between 1 and 100
      or btrim(coalesce(v_phase ->> 'name','')) <> coalesce(v_phase ->> 'name','')
      or coalesce(jsonb_typeof(v_phase -> 'objectives'),'') <> 'array'
      or jsonb_array_length(v_phase -> 'objectives') > 48
      or coalesce(jsonb_typeof(v_phase -> 'effects'),'') <> 'array'
      or coalesce(jsonb_typeof(v_phase -> 'cleanupEffects'),'') <> 'array'
      or coalesce(jsonb_typeof(v_phase -> 'transition'),'') <> 'object'
    then
      raise exception using errcode = '22023', message = 'EVENT_DEFINITION_PHASE_INVALID';
    end if;

    v_phase_id := v_phase ->> 'id';
    if v_phase_id = any(v_phase_ids) then
      raise exception using errcode = '22023', message = 'EVENT_DEFINITION_PHASE_DUPLICATE';
    end if;
    v_phase_ids := array_append(v_phase_ids, v_phase_id);
    v_phase_objective_ids := array[]::text[];

    for v_objective in
      select objective.value
      from jsonb_array_elements(v_phase -> 'objectives') as objective(value)
    loop
      if jsonb_typeof(v_objective) <> 'object'
        or coalesce(v_objective ->> 'id','') !~ '^[a-z0-9][a-z0-9._:-]{1,159}revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;

        or coalesce(v_objective ->> 'referenceKey','') !~ '^[a-z0-9][a-z0-9._:-]{1,159}revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;

        or coalesce(v_objective ->> 'type','') not in (
          'defeat','quest','expedition','pvp','gather','craft','discover',
          'interact','protect','community-threshold','narrative-choice','lore-discovery'
        )
        or coalesce(jsonb_typeof(v_objective -> 'target'),'') <> 'number'
        or coalesce(v_objective ->> 'target','') !~ '^[1-9][0-9]*revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;

        or (v_objective ->> 'target')::numeric > 9007199254740991::numeric
      then
        raise exception using errcode = '22023', message = 'EVENT_DEFINITION_OBJECTIVE_INVALID';
      end if;

      v_objective_id := v_objective ->> 'id';
      if v_objective_id = any(v_objective_ids) then
        raise exception using errcode = '22023', message = 'EVENT_DEFINITION_OBJECTIVE_DUPLICATE';
      end if;
      v_objective_ids := array_append(v_objective_ids, v_objective_id);
      v_phase_objective_ids := array_append(v_phase_objective_ids, v_objective_id);
    end loop;

    for v_effect in
      select effect.value
      from (
        select active.value
        from jsonb_array_elements(v_phase -> 'effects') as active(value)
        union all
        select cleanup.value
        from jsonb_array_elements(v_phase -> 'cleanupEffects') as cleanup(value)
      ) as effect
    loop
      if jsonb_typeof(v_effect) <> 'object'
        or coalesce(v_effect ->> 'type','') not in (
          'map-marker','event-node','encounter-pool','quest-package','npc-presentation',
          'temporary-vendor','world-pulse','ambience','reward-modifier','region-presentation'
        )
        or coalesce(v_effect ->> 'referenceKey','') !~ '^[a-z0-9][a-z0-9._:-]{1,159}revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;

        or coalesce(jsonb_typeof(v_effect -> 'enabled'),'') <> 'boolean'
      then
        raise exception using errcode = '22023', message = 'EVENT_DEFINITION_EFFECT_INVALID';
      end if;
    end loop;

    v_transition := v_phase -> 'transition';
    v_transition_type := v_transition ->> 'type';

    if v_transition_type = 'manual' then
      null;
    elsif v_transition_type = 'elapsed' then
      if coalesce(jsonb_typeof(v_transition -> 'afterSeconds'),'') <> 'number'
        or coalesce(v_transition ->> 'afterSeconds','') !~ '^[1-9][0-9]*revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;

        or (v_transition ->> 'afterSeconds')::numeric > 9007199254740991::numeric then
        raise exception using errcode = '22023', message = 'EVENT_DEFINITION_TRANSITION_INVALID';
      end if;
    elsif v_transition_type = 'scheduled' then
      begin
        perform (v_transition ->> 'at')::timestamptz;
      exception when others then
        raise exception using errcode = '22023', message = 'EVENT_DEFINITION_TRANSITION_INVALID';
      end;
    elsif v_transition_type = 'objective-threshold' then
      if coalesce(v_transition ->> 'objectiveId','') !~ '^[a-z0-9][a-z0-9._:-]{1,159}revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;

        or not ((v_transition ->> 'objectiveId') = any(v_phase_objective_ids)) then
        raise exception using errcode = '22023', message = 'EVENT_DEFINITION_TRANSITION_INVALID';
      end if;
    else
      raise exception using errcode = '22023', message = 'EVENT_DEFINITION_TRANSITION_INVALID';
    end if;
  end loop;

  for v_ref in
    select value from jsonb_array_elements(p_definition -> 'rewardPackageRefs')
    union all
    select value from jsonb_array_elements(p_definition -> 'aftermathRefs')
  loop
    if jsonb_typeof(v_ref) <> 'string'
      or trim(both '"' from v_ref::text) !~ '^[a-z0-9][a-z0-9._:-]{1,159}revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;
 then
      raise exception using errcode = '22023', message = 'EVENT_DEFINITION_REFERENCE_INVALID';
    end if;
  end loop;
end;
$;

revoke all on function app_private.assert_event_definition_shape_v1(text,jsonb)
  from public, anon, authenticated, service_role;

-- P4.13 closes the original kernel bootstrap grants. After the Event Builder
-- exists, service_role reads projections and invokes guarded RPCs; it does not
-- publish definitions or mutate run/phase/objective state directly.
revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;
