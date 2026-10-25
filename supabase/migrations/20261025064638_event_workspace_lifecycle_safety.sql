begin;

-- Keep historic explanations immutable. New operations use automatic actor/action/time
-- attribution and their existing CAS/idempotency receipts, without entered/generated reasons.
alter table app_private.event_run_transitions alter column reason drop not null;
alter table app_private.event_run_phase_advances alter column reason drop not null;
alter table app_private.event_cleanup_completion_receipts alter column note drop not null;
alter table app_private.event_operations_audit alter column reason drop not null;
alter table app_private.event_authoring_audit alter column reason drop not null;

-- Patch the actual bodies, including the selected-character overloads installed by T8.
-- Legacy signatures remain transport-compatible; explanation text is no longer intent.
do $migration$
declare r record; body text;
begin
  for r in select p.oid, p.proname, p.proargnames from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','app_private') and p.proname=any(array[
      'transition_event_run_v1','operate_event_run_v1','operate_event_run_v2',
      'advance_event_run_phase_v1','advance_event_run_phase_v2',
      'complete_event_cleanup_requirement_v1','complete_event_cleanup_requirement_v2',
      'publish_event_definition_v2','schedule_event_run_v2',
      'cancel_scheduled_event_run_v1','cancel_scheduled_event_run_v2',
      'assert_sensitive_event_action_v1','assert_confirmed_event_operation_v1'])
  loop
    body := pg_get_functiondef(r.oid);
    body := regexp_replace(body, '  if p_(reason|note) is null[^;]+;[[:space:]]*end if;', '', 's');
    body := regexp_replace(body, ' or v_[a-z_]+\.(reason|note) <> p_(reason|note)', '', 'g');
    body := regexp_replace(body, 'or v_[a-z_]+\.(reason|note) <> p_(reason|note)\s*', '', 'g');
    -- Phase/cleanup replay predicates begin with the former explanation comparison.
    body := regexp_replace(body, 'if v_[a-z_]+\.(reason|note) <> p_(reason|note)\s+or ', 'if ', 'g');
    if 'p_reason'=any(r.proargnames) then
      body := replace(body, E'\nbegin\n', E'\nbegin\n  p_reason := null;\n');
    elsif 'p_note'=any(r.proargnames) then
      body := replace(body, E'\nbegin\n', E'\nbegin\n  p_note := null;\n');
    end if;
    if r.proname='transition_event_run_v1' then
      body := replace(body, 'when ''ended'' then p_to_status = ''archived''', 'when ''ended'' then p_to_status in (''archived'',''emergency-stopped'')');
    end if;
    if r.proname='operate_event_run_v1' then
      if strpos(body, 'and run.run_mode = ''production'';')=0 then raise exception 'EVENT_OPERATION_LOCK_PREDECESSOR_MISSING'; end if;
      body := replace(body, 'and run.run_mode = ''production'';', 'and run.run_mode = ''production'' for update;');
    end if;
    execute body;
  end loop;
end; $migration$;

-- Runtime capability validation is deliberately separate from draft shape validation.
-- The kernel owns phases, service contributions, navigation and XP claims. It does not
-- execute arbitrary content effects or aftermath merely because a reference is well formed.
create function app_private.assert_event_runtime_supported_v1(p_definition jsonb)
returns void language plpgsql stable security definer set search_path = '' as $$
declare phase jsonb; effect jsonb; objective jsonb; reward text;
begin
  for phase in select value from jsonb_array_elements(coalesce(p_definition->'phases','[]')) loop
    for effect in select value from jsonb_array_elements(coalesce(phase->'effects','[]') || coalesce(phase->'cleanupEffects','[]')) loop
      raise exception using errcode='22023', message='EVENT_EFFECT_EXECUTOR_UNAVAILABLE: ' || coalesce(effect->>'type','unknown') || ' / ' || coalesce(effect->>'referenceKey','unknown');
    end loop;
    for objective in select value from jsonb_array_elements(coalesce(phase->'objectives','[]')) loop
      if objective->'worldNavigation' is null or objective->'worldNavigation'='null'::jsonb then
        raise exception using errcode='22023', message='EVENT_OBJECTIVE_EXECUTOR_UNAVAILABLE: ' || coalesce(objective->>'type','unknown');
      end if;
      if phase#>>'{transition,type}'='objective-threshold' and objective->>'id'=phase#>>'{transition,objectiveId}' then
        raise exception using errcode='22023', message='EVENT_NAVIGATION_IS_NOT_OBJECTIVE_EXECUTION';
      end if;
    end loop;
  end loop;
  if jsonb_array_length(coalesce(p_definition->'aftermathRefs','[]'))>0 then
    raise exception using errcode='22023', message='EVENT_AFTERMATH_EXECUTOR_UNAVAILABLE';
  end if;
  for reward in select jsonb_array_elements_text(coalesce(p_definition->'rewardPackageRefs','[]')) loop
    if not exists(select 1 from app_private.event_reward_packages p join app_private.event_reward_budget_policies b on b.budget_ref=p.budget_ref
      where p.reward_package_ref=reward and p.reward_kind='character-xp' and p.amount<=b.max_per_claim) then
      raise exception using errcode='22023', message='EVENT_REWARD_PACKAGE_UNAVAILABLE: '||reward;
    end if;
  end loop;
  if jsonb_array_length(coalesce(p_definition->'rewardPackageRefs','[]'))>0 then
    raise exception using errcode='22023',message='EVENT_REWARD_PRODUCER_UNAVAILABLE: reward packages can be drafted, but no live contribution-to-claim producer is installed';
  end if;
end; $$;
revoke all on function app_private.assert_event_runtime_supported_v1(jsonb) from public,anon,authenticated,service_role;

-- Protect real publication/schedule entrypoints (including selected-character overloads).
-- Direct postgres fixture/history restoration is distinct from the revoked service table writes.
do $migration$
declare r record; body text;
begin
  for r in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('publish_event_definition_v1','schedule_event_run_v1') loop
    body:=pg_get_functiondef(r.oid);
    if r.proname='publish_event_definition_v1' then
      if strpos(body,'v_definition := jsonb_set(')=0 then raise exception 'EVENT_PUBLICATION_PREDECESSOR_MISSING'; end if;
      body:=replace(body,'v_definition := jsonb_set(',E'perform app_private.assert_event_runtime_supported_v1(p_definition);\n  v_definition := jsonb_set(');
    else
      if strpos(body,'v_definition := v_version.definition;')=0 then raise exception 'EVENT_SCHEDULE_PREDECESSOR_MISSING'; end if;
      body:=replace(body,'v_definition := v_version.definition;',E'v_definition := v_version.definition;\n  perform app_private.assert_event_runtime_supported_v1(v_definition);');
    end if;
    execute body;
  end loop;
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app_private' and p.proname in ('recover_due_event_runs_v1','recover_event_phase_transition_v1') loop
    body:=pg_get_functiondef(r.oid);
    body:=regexp_replace(body, '''Automatic[^'']*''', 'null', 'g');
    execute body;
  end loop;
end; $migration$;

-- Cancellation is durable on the run, not a deletion of reservations or successful claims.
-- Acquire run before reservation everywhere: stop/end/late settlement have one lock order.
do $migration$
declare body text;
begin
  body:=pg_get_functiondef('public.execute_event_reward_claim_v1(uuid,uuid,text,text)'::regprocedure);
  if strpos(body, '  select * into v_reservation')=0 then raise exception 'EVENT_REWARD_LOCK_PREDECESSOR_MISSING'; end if;
  body:=replace(body, '  select * into v_reservation', E'  perform 1 from app_private.event_runs r\n  where r.id=(select c.run_id from app_private.event_reward_claim_reservations c where c.id=p_reservation_id)\n  for update;\n\n  select * into v_reservation');
  body:=replace(body, 'or v_run.lifecycle_status not in (''ended'', ''archived'')', 'or v_run.lifecycle_status not in (''ended'', ''archived'') or v_run.ended_at is null or v_run.cancelled_at is not null or v_run.emergency_stopped_at is not null');
  execute body;
end; $migration$;

do $migration$
declare r record; body text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='read_event_operation_dashboard_v1' loop
    body:=pg_get_functiondef(r.oid);
    body:=replace(body, '''eventKey'', v_run.event_key,', '''eventKey'', v_run.event_key, ''title'', v_definition->>''title'',');
    execute body;
  end loop;
end; $migration$;

-- Readable catalogue from actual persisted event/reward definitions; no synthetic references.
create function public.read_event_workspace_catalogue_v1(p_actor_user_id uuid,p_actor_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id,p_actor_character_id);
  return jsonb_build_object(
    'events',coalesce((select jsonb_agg(x.row order by x.row->>'title') from (
      select jsonb_build_object('eventKey',coalesce(d.event_key,p.event_key),'title',coalesce(d.definition->>'title',v.definition->>'title'),'scope',coalesce(d.definition->'scope',v.definition->'scope'),'draftVersion',d.draft_version,'publishedVersion',v.definition_version) row
      from app_private.event_definition_drafts d full join app_private.event_publications p on p.event_key=d.event_key
      left join app_private.event_definition_versions v on v.id=p.version_id
      order by coalesce(d.updated_at,p.updated_at) desc limit 200
    ) x),'[]'::jsonb),
    'rewards',coalesce((select jsonb_agg(jsonb_build_object('key',p.reward_package_ref,'label',p.amount::text||' Character XP · v'||p.package_version::text,'budget',p.budget_ref) order by p.reward_package_ref) from app_private.event_reward_packages p),'[]'::jsonb));
end; $$;
revoke all on function public.read_event_workspace_catalogue_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_event_workspace_catalogue_v1(uuid,uuid) to service_role;

commit;
