begin;

alter table app_private.event_run_objectives add column battle_result jsonb;
create index world_npc_battles_event_admission_idx
  on app_private.world_npc_battles(npc_id, npc_revision, admitted_at);

create function app_private.pinned_world_event_battle_result_v1(p_definition jsonb, p_objective jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  rule jsonb := p_objective->'battleResult';
  sector text := p_objective#>>'{worldNavigation,sectorId}';
  publication jsonb;
begin
  if jsonb_typeof(rule) is distinct from 'object'
    or rule - array['npcId','outcome'] <> '{}'::jsonb
    or coalesce(rule->>'npcId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(rule->>'outcome','') not in ('victory','defeat')
    or p_objective->>'type' is distinct from 'defeat'
    or p_objective ? 'requiredWeather'
    or sector is null or sector like 'sealed-realm:%'
    or coalesce(p_definition->>'category',
       case when p_definition->>'family' in ('narrative-event','lore-revelation') then '' else 'world-events' end)
       is distinct from 'world-events'
    or not coalesce(
      p_definition#>>'{scope,type}'='global' or
      (p_definition#>>'{scope,type}'='region' and p_definition#>>'{scope,key}' in (sector,'region.'||sector)),
      false)
  then
    raise exception using errcode = '22023', message = 'EVENT_WORLD_BATTLE_RESULT_INVALID';
  end if;
  select world into publication from app_private.npc_designs
  where id = (rule->>'npcId')::uuid and world->>'sectorId' = sector
    and app_private.valid_npc_world_encounter_v1(world->'encounter');
  if not found then
    raise exception using errcode = '22023', message = 'EVENT_WORLD_BATTLE_NPC_UNAVAILABLE';
  end if;
  return rule || jsonb_build_object('revision',publication->'revision','sectorId',sector);
end; $$;

create function app_private.capture_event_battle_result_v1()
returns trigger language plpgsql set search_path = '' as $$
declare
  definition jsonb;
  objective jsonb;
begin
  select version.definition, candidate into definition, objective
  from app_private.event_runs run
  join app_private.event_definition_versions version on version.id = run.definition_version_id
  cross join lateral jsonb_array_elements(version.definition->'phases') phase
  cross join lateral jsonb_array_elements(phase->'objectives') candidate
  where run.id = new.run_id and phase->>'id' = new.phase_id
    and candidate->>'id' = new.objective_id and candidate->>'completion' = 'world-npc-result';
  if found then
    new.battle_result := app_private.pinned_world_event_battle_result_v1(definition, objective);
  end if;
  return new;
end; $$;
create trigger capture_event_battle_result_v1 before insert on app_private.event_run_objectives
for each row execute function app_private.capture_event_battle_result_v1();

-- Read final battle receipts from the existing Event recovery task. Battle
-- completion never takes an Event run lock, and no historical receipt is replayed.
create function app_private.record_event_battle_results_v1(
  p_run app_private.event_runs, p_phase app_private.event_run_phases, p_now timestamptz
)
returns void language plpgsql set search_path = '' as $$
declare
  candidate record;
begin
  for candidate in
    select objective.objective_id, battle.battle_session_id, receipt.outcome,
      receipt.occurred_at, character.user_id, battle.character_id,
      md5(jsonb_build_array(p_phase.phase_id,objective.objective_id,battle.battle_session_id)::text) source_key
    from app_private.event_run_objectives objective
    join app_private.world_npc_battles battle on battle.npc_id = (objective.battle_result->>'npcId')::uuid
      and battle.npc_revision = (objective.battle_result->>'revision')::bigint
      and battle.placement->>'sectorId' = objective.battle_result->>'sectorId'
    join app_private.world_npc_terminal_receipts receipt on receipt.battle_session_id = battle.battle_session_id
      and receipt.outcome = objective.battle_result->>'outcome'
    join public.characters character on character.id = battle.character_id
    where objective.run_id = p_run.id and objective.phase_id = p_phase.phase_id
      and objective.objective_status = 'active'
      and battle.admitted_at >= greatest(p_run.started_at,p_phase.started_at)
      and receipt.occurred_at >= battle.admitted_at and receipt.occurred_at <= p_now
      and (p_run.scheduled_end_at is null or receipt.occurred_at < p_run.scheduled_end_at)
      and not exists (select 1 from app_private.event_mentor_attempts practice
        where practice.battle_session_id = battle.battle_session_id and practice.training)
      and not exists (select 1 from app_private.character_deletion_requests pending
        where pending.character_id = character.id)
      and coalesce((select transition.to_status from app_private.event_run_transitions transition
        where transition.run_id = p_run.id and transition.occurred_at <= battle.admitted_at
        order by transition.occurred_at desc, transition.id desc limit 1), 'live') = 'live'
      and coalesce((select transition.to_status from app_private.event_run_transitions transition
        where transition.run_id = p_run.id and transition.occurred_at <= receipt.occurred_at
        order by transition.occurred_at desc, transition.id desc limit 1), 'live') = 'live'
      and not exists (
        select 1 from app_private.event_contributions contribution
        where contribution.run_id = p_run.id and contribution.source_system = 'world-npc-result'
          and contribution.source_reference = md5(jsonb_build_array(p_phase.phase_id,objective.objective_id,battle.battle_session_id)::text)
      )
    order by receipt.occurred_at, battle.battle_session_id, objective.objective_id
    limit 48
  loop
    if not exists (select 1 from app_private.event_run_objectives
      where run_id = p_run.id and phase_id = p_phase.phase_id and objective_id = candidate.objective_id
        and objective_status = 'active') then continue; end if;
    perform app_private.record_event_contribution_v1(
      'system:world-npc-result',gen_random_uuid(),candidate.source_key,
      p_run.id,candidate.user_id,candidate.character_id,p_phase.phase_id,candidate.objective_id,
      'world-npc-result',candidate.source_key,1,
      jsonb_build_object('battleSessionId',candidate.battle_session_id,'outcome',candidate.outcome,
        'occurredAt',candidate.occurred_at),false
    );
  end loop;
end; $$;

revoke all on function app_private.pinned_world_event_battle_result_v1(jsonb,jsonb),
  app_private.capture_event_battle_result_v1(),
  app_private.record_event_battle_results_v1(app_private.event_runs,app_private.event_run_phases,timestamptz)
  from public, anon, authenticated, service_role;

do $migration$
declare
  patch record;
  definition text;
begin
  for patch in select * from (values
    ('app_private.assert_event_runtime_before_inventory_discovery_v1(jsonb)',
      '      if objective ? ''completion'' and (',
      $runtime$
      if objective ? 'battleResult' and objective->>'completion' is distinct from 'world-npc-result' then
        raise exception using errcode = '22023', message = 'EVENT_WORLD_BATTLE_RESULT_INVALID';
      end if;
      if objective->>'completion' = 'world-npc-result' then
        perform app_private.pinned_world_event_battle_result_v1(p_definition, objective);
      end if;
      if objective ? 'completion' and objective->>'completion' is distinct from 'world-npc-result' and ($runtime$),
    ('app_private.assert_event_runtime_before_inventory_discovery_v1(jsonb)',
      'if objective->>''completion'' is distinct from ''world-arrival'' and (',
      'if coalesce(objective->>''completion'','''') not in (''world-arrival'',''world-npc-result'') and ('),
    ('public.record_event_contribution_v1(text,uuid,text,uuid,uuid,uuid,text,text,text,text,bigint,jsonb)',
      '  if p_source_system = ''world-arrival'' then',
      E'  if p_source_system = ''world-npc-result'' then\n    raise exception using errcode = ''22023'', message = ''EVENT_WORLD_BATTLE_SOURCE_RESERVED'';\n  end if;\n  if p_source_system = ''world-arrival'' then'),
    ('app_private.record_event_contribution_v1(text,uuid,text,uuid,uuid,uuid,text,text,text,text,bigint,jsonb,boolean)',
      '  if v_objective.arrival_position is not null and p_confirmed_world_arrival is not true then',
      E'  if v_objective.battle_result is not null and p_source_system is distinct from ''world-npc-result'' then\n    raise exception using errcode = ''22023'', message = ''EVENT_CONTRIBUTION_REQUIRES_CONFIRMED_WORLD_BATTLE'';\n  end if;\n  if v_objective.arrival_position is not null and p_confirmed_world_arrival is not true then'),
    ('app_private.recover_event_phase_transition_v1(uuid,bigint)',
      '  v_transition_type := v_transition ->> ''type'';',
      E'  perform app_private.record_event_battle_results_v1(v_run, v_current, v_now);\n  v_transition_type := v_transition ->> ''type'';'),
    ('public.read_world_state_before_ferry_v1(uuid,uuid,jsonb)',
      '''completed'',case when objective->>''completion'' = ''world-arrival'' then exists(',
      $projection$'requiredBattleOutcome',objective#>>'{battleResult,outcome}',
     'completed',case when objective->>'completion' in ('world-arrival','world-npc-result') then exists($projection$),
    ('public.read_world_state_before_ferry_v1(uuid,uuid,jsonb)',
      'and contribution.source_system = ''world-arrival''',
      'and contribution.source_system in (''world-arrival'',''world-npc-result'')')
  ) as edits(signature, predecessor, replacement)
  loop
    definition := pg_get_functiondef(patch.signature::regprocedure);
    if length(definition) - length(replace(definition, patch.predecessor, '')) <> length(patch.predecessor) then
      raise exception 'WORLD_EVENT_BATTLE_PREDECESSOR_MISSING: %', patch.signature;
    end if;
    execute replace(definition, patch.predecessor, patch.replacement);
  end loop;
end;
$migration$;

commit;
