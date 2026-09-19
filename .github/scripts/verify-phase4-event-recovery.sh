#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

owner_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select user_id::text
  from app_private.master_panel_role_assignments
  where role = 'game-owner' and enabled = true
  limit 1;")"
test -n "$owner_id"

cron_count="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)::text
  from cron.job
  where jobname = 'aurevane-event-recovery-v1';")"
test "$cron_count" = '0'

version_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_templates (event_key, event_family, created_by)
  values ('event.p414-recovery','regional-event','$owner_id'::uuid);

  insert into app_private.event_definition_versions (
    event_key, definition_version, definition, published_by
  ) values (
    'event.p414-recovery',
    1,
    jsonb_build_object(
      'schemaVersion',1,
      'eventKey','event.p414-recovery',
      'templateKey','template.p414-recovery',
      'contentVersion',1,
      'title','P4.14 Recovery Verification',
      'summary','CI server-owned recovery proof.',
      'internalNotes','CI only.',
      'family','regional-event',
      'scope',jsonb_build_object('type','region','key','region.frostmere'),
      'phases',jsonb_build_array(
        jsonb_build_object(
          'id','timed',
          'name','Timed',
          'objectives',jsonb_build_array(
            jsonb_build_object(
              'id','survive',
              'type','protect',
              'referenceKey','objective.p414-recovery',
              'target',1
            )
          ),
          'effects',jsonb_build_array(),
          'cleanupEffects',jsonb_build_array(),
          'transition',jsonb_build_object('type','elapsed','afterSeconds',60)
        ),
        jsonb_build_object(
          'id','aftermath',
          'name','Aftermath',
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
test -n "$version_id"

due_run="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key, definition_version_id, run_mode, lifecycle_status,
    scope_type, scope_key, scheduled_start_at, scheduled_end_at,
    current_phase_id, created_by
  ) values (
    'event.p414-recovery',
    '$version_id'::uuid,
    'production',
    'scheduled',
    'region',
    'region.frostmere',
    clock_timestamp() - interval '2 minutes',
    clock_timestamp() + interval '4 hours',
    'timed',
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$due_run"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_run_phases (
    run_id, phase_id, ordinal, phase_status
  ) values
    ('$due_run'::uuid,'timed',0,'pending'),
    ('$due_run'::uuid,'aftermath',1,'pending');

  insert into app_private.event_run_objectives (
    run_id, phase_id, objective_id, objective_status, progress, target
  ) values (
    '$due_run'::uuid,'timed','survive','inactive',0,1
  );
" >/dev/null

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  select * from app_private.recover_due_event_runs_v1(100);
" >/dev/null

started_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    run.lifecycle_status || '|' ||
    run.state_version::text || '|' ||
    phase.phase_status || '|' ||
    objective.objective_status || '|' ||
    (run.started_at is not null)::text
  from app_private.event_runs as run
  join app_private.event_run_phases as phase
    on phase.run_id = run.id and phase.phase_id = 'timed'
  join app_private.event_run_objectives as objective
    on objective.run_id = run.id
   and objective.phase_id = 'timed'
   and objective.objective_id = 'survive'
  where run.id = '$due_run'::uuid;")"
test "$started_state" = 'live|2|live|active|true'

phase_started_before="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select started_at::text
  from app_private.event_run_phases
  where run_id = '$due_run'::uuid and phase_id = 'timed';")"
test -n "$phase_started_before"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.transition_event_run_v1(
    '$due_run'::uuid,
    2,
    '00000000-0000-4000-8000-000000004501'::uuid,
    'paused',
    'P4.14 recovery pause clock'
  );
" >/dev/null

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.event_runs
  set paused_at = clock_timestamp() - interval '60 seconds'
  where id = '$due_run'::uuid;
" >/dev/null

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.transition_event_run_v1(
    '$due_run'::uuid,
    3,
    '00000000-0000-4000-8000-000000004502'::uuid,
    'live',
    'P4.14 recovery resume clock'
  );
" >/dev/null

pause_shift="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select round(extract(epoch from (
    phase.started_at - '$phase_started_before'::timestamptz
  )))::text
  from app_private.event_run_phases as phase
  where phase.run_id = '$due_run'::uuid
    and phase.phase_id = 'timed';")"
test "$pause_shift" -ge 55
test "$pause_shift" -le 65

paused_marker="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select (paused_at is null)::text
  from app_private.event_runs
  where id = '$due_run'::uuid;")"
test "$paused_marker" = 'true'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.event_run_phases
  set started_at = clock_timestamp() - interval '2 minutes'
  where run_id = '$due_run'::uuid and phase_id = 'timed';
" >/dev/null

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  select * from app_private.recover_due_event_runs_v1(100);
" >/dev/null

advanced_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    run.lifecycle_status || '|' ||
    run.state_version::text || '|' ||
    run.current_phase_id || '|' ||
    string_agg(phase.phase_id || ':' || phase.phase_status, ',' order by phase.ordinal)
  from app_private.event_runs as run
  join app_private.event_run_phases as phase on phase.run_id = run.id
  where run.id = '$due_run'::uuid
  group by run.lifecycle_status, run.state_version, run.current_phase_id;")"
test "$advanced_state" = 'live|5|aftermath|timed:completed,aftermath:live'

phase_receipt="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select from_phase_id || '|' || to_phase_id || '|' || resulting_state_version::text
  from app_private.event_run_phase_advances
  where run_id = '$due_run'::uuid
  order by occurred_at desc
  limit 1;")"
test "$phase_receipt" = 'timed|aftermath|5'

final_version_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_templates (event_key, event_family, created_by)
  values ('event.p414-recovery-final','regional-event','$owner_id'::uuid);

  insert into app_private.event_definition_versions (
    event_key, definition_version, definition, published_by
  ) values (
    'event.p414-recovery-final',
    1,
    jsonb_build_object(
      'schemaVersion',1,
      'eventKey','event.p414-recovery-final',
      'templateKey','template.p414-recovery-final',
      'contentVersion',1,
      'title','P4.14 Final Recovery',
      'summary','CI final phase recovery proof.',
      'internalNotes','CI only.',
      'family','regional-event',
      'scope',jsonb_build_object('type','region','key','region.frostmere'),
      'phases',jsonb_build_array(
        jsonb_build_object(
          'id','final',
          'name','Final',
          'objectives',jsonb_build_array(),
          'effects',jsonb_build_array(),
          'cleanupEffects',jsonb_build_array(),
          'transition',jsonb_build_object('type','scheduled','at','2026-01-01T00:00:00Z')
        )
      ),
      'rewardPackageRefs',jsonb_build_array(),
      'aftermathRefs',jsonb_build_array()
    ),
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$final_version_id"

final_run="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key, definition_version_id, run_mode, lifecycle_status,
    scope_type, scope_key, current_phase_id, started_at, created_by
  ) values (
    'event.p414-recovery-final',
    '$final_version_id'::uuid,
    'production',
    'live',
    'region',
    'region.frostmere',
    'final',
    clock_timestamp() - interval '1 hour',
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$final_run"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_run_phases (
    run_id, phase_id, ordinal, phase_status, started_at
  ) values (
    '$final_run'::uuid,'final',0,'live',clock_timestamp() - interval '1 hour'
  );
" >/dev/null

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  select * from app_private.recover_due_event_runs_v1(100);
" >/dev/null

final_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select lifecycle_status || '|' || state_version::text
  from app_private.event_runs
  where id = '$final_run'::uuid;")"
test "$final_state" = 'resolving|2'

expired_run="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key, definition_version_id, run_mode, lifecycle_status,
    scope_type, scope_key, scheduled_start_at, scheduled_end_at,
    current_phase_id, created_by
  ) values (
    'event.p414-recovery-final',
    '$final_version_id'::uuid,
    'production',
    'scheduled',
    'region',
    'region.frostmere',
    clock_timestamp() - interval '2 hours',
    clock_timestamp() - interval '1 hour',
    'final',
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$expired_run"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_run_phases (
    run_id, phase_id, ordinal, phase_status
  ) values ('$expired_run'::uuid,'final',0,'pending');
" >/dev/null

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  select * from app_private.recover_due_event_runs_v1(100);
" >/dev/null

expired_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select lifecycle_status || '|' || cleanup_status
  from app_private.event_runs
  where id = '$expired_run'::uuid;")"
test "$expired_state" = 'cancelled|not-required'

window_run="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key, definition_version_id, run_mode, lifecycle_status,
    scope_type, scope_key, scheduled_end_at, current_phase_id, started_at, created_by
  ) values (
    'event.p414-recovery',
    '$version_id'::uuid,
    'production',
    'live',
    'region',
    'region.frostmere',
    clock_timestamp() - interval '1 minute',
    'timed',
    clock_timestamp() - interval '2 hours',
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$window_run"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_run_phases (
    run_id, phase_id, ordinal, phase_status, started_at
  ) values
    ('$window_run'::uuid,'timed',0,'live',clock_timestamp() - interval '2 hours'),
    ('$window_run'::uuid,'aftermath',1,'pending',null);
" >/dev/null

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  select * from app_private.recover_due_event_runs_v1(100);
" >/dev/null

window_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select lifecycle_status || '|' || state_version::text
  from app_private.event_runs
  where id = '$window_run'::uuid;")"
test "$window_state" = 'resolving|2'

health="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    (last_started_at is not null)::text || '|' ||
    (last_completed_at is not null)::text || '|' ||
    last_error_count::text
  from app_private.event_recovery_state
  where singleton = true;")"
test "$health" = 'true|true|0'

cron_probe="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  begin;
  select app_private.configure_event_recovery_cron_v1(true)::text;
  select schedule
  from cron.job
  where jobname = 'aurevane-event-recovery-v1';
  select coalesce(app_private.configure_event_recovery_cron_v1(false)::text,'disabled');
  commit;")"
test "$(printf '%s' "$cron_probe" | sed -n '2p')" = '* * * * *'
test "$(printf '%s' "$cron_probe" | sed -n '3p')" = 'disabled'

cron_after="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)::text
  from cron.job
  where jobname = 'aurevane-event-recovery-v1';")"
test "$cron_after" = '0'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from app_private.recover_due_event_runs_v1(100);" >/tmp/p414-recovery-service.out 2>/tmp/p414-recovery-service.err; then
  echo 'Service role unexpectedly invoked the internal Event recovery scheduler.' >&2
  exit 1
fi

echo 'Phase 4 authoritative Event recovery and cron configuration verified.'
