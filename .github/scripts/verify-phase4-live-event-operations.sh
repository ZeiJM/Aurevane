#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

owner_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select user_id::text
  from app_private.master_panel_role_assignments
  where role = 'game-owner' and enabled = true
  limit 1;")"
staff_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select user_id::text
  from app_private.master_panel_role_assignments
  where role = 'event-staff' and enabled = true
  limit 1;")"
test -n "$owner_id"
test -n "$staff_id"

version_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_templates (event_key, event_family, created_by)
  values ('event.p414-ops','regional-event','$owner_id'::uuid);

  insert into app_private.event_definition_versions (
    event_key, definition_version, definition, published_by
  ) values (
    'event.p414-ops',
    1,
    jsonb_build_object(
      'schemaVersion',1,
      'eventKey','event.p414-ops',
      'templateKey','template.p414-ops',
      'contentVersion',1,
      'title','P4.14 Operations Verification',
      'summary','CI live operations proof.',
      'internalNotes','CI only.',
      'family','regional-event',
      'scope',jsonb_build_object('type','region','key','region.frostmere'),
      'phases',jsonb_build_array(
        jsonb_build_object(
          'id','mobilization',
          'name','Mobilization',
          'objectives',jsonb_build_array(
            jsonb_build_object(
              'id','community',
              'type','community-threshold',
              'referenceKey','objective.p414-community',
              'target',10
            )
          ),
          'effects',jsonb_build_array(
            jsonb_build_object(
              'type','world-pulse',
              'referenceKey','announcement.p414-live',
              'enabled',true
            )
          ),
          'cleanupEffects',jsonb_build_array(
            jsonb_build_object(
              'type','event-node',
              'referenceKey','node.p414-cleanup',
              'enabled',false
            )
          ),
          'transition',jsonb_build_object('type','manual')
        ),
        jsonb_build_object(
          'id','aftermath',
          'name','Aftermath',
          'objectives',jsonb_build_array(
            jsonb_build_object(
              'id','epilogue',
              'type','discover',
              'referenceKey','objective.p414-epilogue',
              'target',1
            )
          ),
          'effects',jsonb_build_array(
            jsonb_build_object(
              'type','world-pulse',
              'referenceKey','announcement.p414-aftermath',
              'enabled',true
            )
          ),
          'cleanupEffects',jsonb_build_array(),
          'transition',jsonb_build_object('type','manual')
        )
      ),
      'rewardPackageRefs',jsonb_build_array(),
      'aftermathRefs',jsonb_build_array('aftermath.p414-ci')
    ),
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$version_id"

run_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key,
    definition_version_id,
    run_mode,
    lifecycle_status,
    scope_type,
    scope_key,
    scheduled_start_at,
    scheduled_end_at,
    current_phase_id,
    created_by
  ) values (
    'event.p414-ops',
    '$version_id'::uuid,
    'production',
    'scheduled',
    'region',
    'region.frostmere',
    clock_timestamp() - interval '1 minute',
    clock_timestamp() + interval '4 hours',
    'mobilization',
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$run_id"

p414_operation_privileges="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    has_function_privilege('service_role','public.operate_event_run_v1(uuid,uuid,bigint,uuid,text,text)','EXECUTE')::text || '|' ||
    has_function_privilege('service_role','public.operate_event_run_v2(uuid,uuid,bigint,uuid,text,text,boolean)','EXECUTE')::text || '|' ||
    has_function_privilege('service_role','public.advance_event_run_phase_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')::text || '|' ||
    has_function_privilege('service_role','public.advance_event_run_phase_v2(uuid,uuid,bigint,uuid,text,boolean)','EXECUTE')::text || '|' ||
    has_function_privilege('service_role','public.complete_event_cleanup_requirement_v1(uuid,uuid,text,integer,uuid,text)','EXECUTE')::text || '|' ||
    has_function_privilege('service_role','public.complete_event_cleanup_requirement_v2(uuid,uuid,text,integer,uuid,text,boolean)','EXECUTE')::text;")"
test "$p414_operation_privileges" = 'false|true|false|true|false|true'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_run_phases (
    run_id, phase_id, ordinal, phase_status
  ) values
    ('$run_id'::uuid,'mobilization',0,'pending'),
    ('$run_id'::uuid,'aftermath',1,'pending');

  insert into app_private.event_run_objectives (
    run_id, phase_id, objective_id, objective_status, progress, target
  ) values
    ('$run_id'::uuid,'mobilization','community','inactive',0,10),
    ('$run_id'::uuid,'aftermath','epilogue','inactive',0,1);
" >/dev/null

operate() {
  local version="$1"
  local key="$2"
  local command="$3"
  local reason="$4"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select lifecycle_status || '|' || state_version::text || '|' || replayed::text
    from public.operate_event_run_v2(
      '$staff_id'::uuid,
      '$run_id'::uuid,
      '$version'::bigint,
      '$key'::uuid,
      '$command',
      '$reason'
    ,
    true);"
}

test "$(operate 1 '00000000-0000-4000-8000-000000004401' 'start' 'P4.14 start run')" = 'live|2|false'
test "$(operate 1 '00000000-0000-4000-8000-000000004401' 'start' 'P4.14 start run')" = 'live|2|true'

if operate 2 '00000000-0000-4000-8000-000000004401' 'start' 'P4.14 start run' >/tmp/p414-start-key-conflict.out 2>/tmp/p414-start-key-conflict.err; then
  echo 'Expected lifecycle key reuse with a different expected state version to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_OPERATION_IDEMPOTENCY_CONFLICT' /tmp/p414-start-key-conflict.err

started_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    run.lifecycle_status || '|' ||
    phase.phase_status || '|' ||
    objective.objective_status || '|' ||
    (run.started_at is not null)::text
  from app_private.event_runs as run
  join app_private.event_run_phases as phase
    on phase.run_id = run.id and phase.phase_id = 'mobilization'
  join app_private.event_run_objectives as objective
    on objective.run_id = run.id
   and objective.phase_id = 'mobilization'
   and objective.objective_id = 'community'
  where run.id = '$run_id'::uuid;")"
test "$started_state" = 'live|live|active|true'

test "$(operate 2 '00000000-0000-4000-8000-000000004402' 'pause' 'P4.14 pause run')" = 'paused|3|false'
test "$(operate 3 '00000000-0000-4000-8000-000000004403' 'resume' 'P4.14 resume run')" = 'live|4|false'

character_id='00000000-0000-4000-8000-000000004411'
user_id='00000000-0000-4000-8000-000000004412'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_participants (
    run_id, character_id, user_id, contribution_count, contribution_total,
    first_participated_at, last_contributed_at
  ) values (
    '$run_id'::uuid,
    '$character_id'::uuid,
    '$user_id'::uuid,
    1,
    4,
    clock_timestamp(),
    clock_timestamp()
  );

  insert into app_private.event_contributions (
    run_id, character_id, user_id, phase_id, objective_id,
    source_system, source_reference, amount, provenance
  ) values (
    '$run_id'::uuid,
    '$character_id'::uuid,
    '$user_id'::uuid,
    'mobilization',
    'community',
    'ci',
    'p414.ops.contribution',
    4,
    jsonb_build_object('source','ci','purpose','dashboard')
  );

  update app_private.event_run_objectives
  set progress = 4,
      state_version = state_version + 1,
      updated_at = clock_timestamp()
  where run_id = '$run_id'::uuid
    and phase_id = 'mobilization'
    and objective_id = 'community';
" >/dev/null

dashboard_live="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    dashboard #>> '{run,lifecycleStatus}' || '|' ||
    (jsonb_array_length(dashboard -> 'participants'))::text || '|' ||
    (dashboard #>> '{participants,0,contributionTotal}') || '|' ||
    (dashboard #>> '{phases,0,objectives,0,progress}') || '|' ||
    (dashboard #>> '{activeEffects,0,referenceKey}')
  from (
    select public.read_event_operation_dashboard_v1(
      '$staff_id'::uuid,
      '$run_id'::uuid
    ) as dashboard
  ) as state;")"
test "$dashboard_live" = 'live|1|4|4|announcement.p414-live'

advance="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select current_phase_id || '|' || state_version::text || '|' || replayed::text
  from public.advance_event_run_phase_v2(
    '$staff_id'::uuid,
    '$run_id'::uuid,
    4,
    '00000000-0000-4000-8000-000000004404'::uuid,
    'P4.14 advance to aftermath'
  ,
  true);")"
test "$advance" = 'aftermath|5|false'

advance_replay="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select current_phase_id || '|' || state_version::text || '|' || replayed::text
  from public.advance_event_run_phase_v2(
    '$staff_id'::uuid,
    '$run_id'::uuid,
    4,
    '00000000-0000-4000-8000-000000004404'::uuid,
    'P4.14 advance to aftermath'
  ,
  true);")"
test "$advance_replay" = 'aftermath|5|true'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.advance_event_run_phase_v2(
    '$staff_id'::uuid,
    '$run_id'::uuid,
    5,
    '00000000-0000-4000-8000-000000004404'::uuid,
    'P4.14 advance to aftermath'
  ,
  true);" >/tmp/p414-advance-key-conflict.out 2>/tmp/p414-advance-key-conflict.err; then
  echo 'Expected phase-advance key reuse with a different expected state version to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_PHASE_ADVANCE_IDEMPOTENCY_CONFLICT' /tmp/p414-advance-key-conflict.err

phase_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select string_agg(
    phase.phase_id || ':' || phase.phase_status,
    ',' order by phase.ordinal
  )
  from app_private.event_run_phases as phase
  where phase.run_id = '$run_id'::uuid;")"
test "$phase_state" = 'mobilization:completed,aftermath:live'

objective_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select string_agg(
    objective.phase_id || ':' || objective.objective_id || ':' || objective.objective_status,
    ',' order by objective.phase_id, objective.objective_id
  )
  from app_private.event_run_objectives as objective
  where objective.run_id = '$run_id'::uuid;")"
test "$objective_state" = 'aftermath:epilogue:active,mobilization:community:failed'

test "$(operate 5 '00000000-0000-4000-8000-000000004405' 'stop' 'P4.14 graceful stop')" = 'resolving|6|false'
test "$(operate 6 '00000000-0000-4000-8000-000000004406' 'end' 'P4.14 end run')" = 'ended|7|false'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_reward_claim_reservations (
    run_id, character_id, user_id, reward_package_ref, eligibility_provenance
  ) values (
    '$run_id'::uuid,
    '$character_id'::uuid,
    '$user_id'::uuid,
    'reward.p414-unexecuted',
    jsonb_build_object('basis','p414-ci')
  );
" >/dev/null

dashboard_ended="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    dashboard #>> '{run,cleanupStatus}' || '|' ||
    (jsonb_array_length(dashboard -> 'cleanupRequirements'))::text || '|' ||
    (dashboard #>> '{cleanupRequirements,0,referenceKey}') || '|' ||
    (jsonb_array_length(dashboard -> 'claims'))::text
  from (
    select public.read_event_operation_dashboard_v1(
      '$staff_id'::uuid,
      '$run_id'::uuid
    ) as dashboard
  ) as state;")"
test "$dashboard_ended" = 'pending|1|node.p414-cleanup|1'

if operate 7 '00000000-0000-4000-8000-000000004407' 'archive' 'P4.14 premature archive' >/tmp/p414-archive-pending.out 2>/tmp/p414-archive-pending.err; then
  echo 'Expected archive to remain blocked while cleanup is pending.' >&2
  exit 1
fi
grep -Fq 'EVENT_RUN_CLEANUP_PENDING' /tmp/p414-archive-pending.err

cleanup="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select cleanup_status || '|' || state_version::text || '|' || replayed::text
  from public.complete_event_cleanup_requirement_v2(
    '$staff_id'::uuid,
    '$run_id'::uuid,
    'mobilization',
    0,
    '00000000-0000-4000-8000-000000004408'::uuid,
    'P4.14 typed cleanup verified'
  ,
  true);")"
test "$cleanup" = 'completed|8|false'

cleanup_replay="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select cleanup_status || '|' || state_version::text || '|' || replayed::text
  from public.complete_event_cleanup_requirement_v2(
    '$staff_id'::uuid,
    '$run_id'::uuid,
    'mobilization',
    0,
    '00000000-0000-4000-8000-000000004408'::uuid,
    'P4.14 typed cleanup verified'
  ,
  true);")"
test "$cleanup_replay" = 'completed|8|true'

test "$(operate 8 '00000000-0000-4000-8000-000000004409' 'archive' 'P4.14 archive run')" = 'archived|9|false'

chronicle="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    terminal_status || '|' ||
    participant_count::text || '|' ||
    contribution_count::text || '|' ||
    contribution_total::text || '|' ||
    claim_reservation_count::text || '|' ||
    reward_execution_count::text || '|' ||
    cleanup_status
  from app_private.event_run_chronicle_entries
  where run_id = '$run_id'::uuid;")"
test "$chronicle" = 'ended|1|1|4|1|0|completed'

dashboard_archived="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    dashboard #>> '{run,lifecycleStatus}' || '|' ||
    (dashboard -> 'chronicle' ->> 'terminalStatus')
  from (
    select public.read_event_operation_dashboard_v1(
      '$staff_id'::uuid,
      '$run_id'::uuid
    ) as dashboard
  ) as state;")"
test "$dashboard_archived" = 'archived|ended'

emergency_run="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key,
    definition_version_id,
    run_mode,
    lifecycle_status,
    scope_type,
    scope_key,
    scheduled_start_at,
    current_phase_id,
    created_by
  ) values (
    'event.p414-ops',
    '$version_id'::uuid,
    'production',
    'scheduled',
    'region',
    'region.frostmere',
    clock_timestamp() - interval '1 minute',
    'mobilization',
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$emergency_run"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_run_phases (
    run_id, phase_id, ordinal, phase_status
  ) values
    ('$emergency_run'::uuid,'mobilization',0,'pending'),
    ('$emergency_run'::uuid,'aftermath',1,'pending');

  insert into app_private.event_run_objectives (
    run_id, phase_id, objective_id, objective_status, progress, target
  ) values (
    '$emergency_run'::uuid,'mobilization','community','inactive',0,10
  );
" >/dev/null

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.operate_event_run_v2(
    '$staff_id'::uuid,
    '$emergency_run'::uuid,
    1,
    '00000000-0000-4000-8000-000000004420'::uuid,
    'emergency-stop',
    'P4.14 emergency denial'
  ,
  true);" >/tmp/p414-emergency-denied.out 2>/tmp/p414-emergency-denied.err; then
  echo 'Expected emergency stop without explicit capability to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_EMERGENCY_STOP_CAPABILITY_REQUIRED' /tmp/p414-emergency-denied.err

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.grant_master_panel_capability_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'events.emergency_stop',
    'P4.14 emergency stop verification'
  );
" >/dev/null

emergency="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.operate_event_run_v2(
    '$staff_id'::uuid,
    '$emergency_run'::uuid,
    1,
    '00000000-0000-4000-8000-000000004421'::uuid,
    'emergency-stop',
    'P4.14 emergency stop'
  ,
  true);")"
test "$emergency" = 'emergency-stopped|2'

emergency_cleanup="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select cleanup_status || '|' ||
    (select count(*)::text
       from app_private.event_run_cleanup_requirements
       where run_id = '$emergency_run'::uuid)
  from app_private.event_runs
  where id = '$emergency_run'::uuid;")"
test "$emergency_cleanup" = 'not-required|0'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.list_event_operation_runs_v1('$staff_id'::uuid);" >/tmp/p414-browser-read.out 2>/tmp/p414-browser-read.err; then
  echo 'Authenticated browser role unexpectedly called Event operations DB authority.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  insert into app_private.event_run_phase_advances (
    run_id, idempotency_key, from_phase_id, to_phase_id, resulting_state_version, reason
  ) values (
    '$run_id'::uuid,
    '00000000-0000-4000-8000-000000004499'::uuid,
    'mobilization',
    'aftermath',
    999,
    'forged receipt'
  );" >/tmp/p414-direct-history.out 2>/tmp/p414-direct-history.err; then
  echo 'Service role unexpectedly forged Event operations history directly.' >&2
  exit 1
fi
grep -Fq 'permission denied for table event_run_phase_advances' /tmp/p414-direct-history.err

expired_run="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key, definition_version_id, run_mode, lifecycle_status,
    scope_type, scope_key, scheduled_start_at, scheduled_end_at,
    current_phase_id, created_by
  ) values (
    'event.p414-ops',
    '$version_id'::uuid,
    'production',
    'scheduled',
    'region',
    'region.frostmere',
    clock_timestamp() - interval '2 hours',
    clock_timestamp() - interval '1 hour',
    'mobilization',
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$expired_run"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_run_phases (
    run_id, phase_id, ordinal, phase_status
  ) values (
    '$expired_run'::uuid,'mobilization',0,'pending'
  );
" >/dev/null

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.operate_event_run_v2(
    '$staff_id'::uuid,
    '$expired_run'::uuid,
    1,
    '00000000-0000-4000-8000-000000004430'::uuid,
    'start',
    'P4.14 expired window start'
  ,
  true);" >/tmp/p414-expired-start.out 2>/tmp/p414-expired-start.err; then
  echo 'Expected an expired scheduled Event Run to reject manual start.' >&2
  exit 1
fi
grep -Fq 'EVENT_OPERATION_WINDOW_ENDED' /tmp/p414-expired-start.err

elapsed_version_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_templates (event_key, event_family, created_by)
  values ('event.p414-elapsed','regional-event','$owner_id'::uuid);

  insert into app_private.event_definition_versions (
    event_key, definition_version, definition, published_by
  ) values (
    'event.p414-elapsed',
    1,
    jsonb_build_object(
      'schemaVersion',1,
      'eventKey','event.p414-elapsed',
      'templateKey','template.p414-elapsed',
      'contentVersion',1,
      'title','P4.14 Elapsed Transition',
      'summary','CI rejects staff manual skip of an elapsed phase.',
      'internalNotes','CI only.',
      'family','regional-event',
      'scope',jsonb_build_object('type','region','key','region.frostmere'),
      'phases',jsonb_build_array(
        jsonb_build_object(
          'id','timed',
          'name','Timed',
          'objectives',jsonb_build_array(),
          'effects',jsonb_build_array(),
          'cleanupEffects',jsonb_build_array(),
          'transition',jsonb_build_object('type','elapsed','afterSeconds',3600)
        ),
        jsonb_build_object(
          'id','next',
          'name','Next',
          'objectives',jsonb_build_array(),
          'effects',jsonb_build_array(),
          'cleanupEffects',jsonb_build_array(),
          'transition',jsonb_build_object('type','manual')
        )
      ),
      'rewardPackageRefs',jsonb_build_array(),
      'aftermathRefs',jsonb_build_array()
    ),
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$elapsed_version_id"

elapsed_run="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key, definition_version_id, run_mode, lifecycle_status,
    scope_type, scope_key, current_phase_id, started_at, created_by
  ) values (
    'event.p414-elapsed',
    '$elapsed_version_id'::uuid,
    'production',
    'live',
    'region',
    'region.frostmere',
    'timed',
    clock_timestamp(),
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$elapsed_run"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_run_phases (
    run_id, phase_id, ordinal, phase_status, started_at
  ) values
    ('$elapsed_run'::uuid,'timed',0,'live',clock_timestamp()),
    ('$elapsed_run'::uuid,'next',1,'pending',null);
" >/dev/null

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.advance_event_run_phase_v2(
    '$staff_id'::uuid,
    '$elapsed_run'::uuid,
    1,
    '00000000-0000-4000-8000-000000004431'::uuid,
    'P4.14 illegal manual elapsed advance'
  ,
  true);" >/tmp/p414-nonmanual-advance.out 2>/tmp/p414-nonmanual-advance.err; then
  echo 'Expected manual phase advance to reject a non-manual transition.' >&2
  exit 1
fi
grep -Fq 'EVENT_PHASE_ADVANCE_MANUAL_REQUIRED' /tmp/p414-nonmanual-advance.err

echo 'Phase 4 live Event operations authority, recovery and Chronicle verification passed.'
