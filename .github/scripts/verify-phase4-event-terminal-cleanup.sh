#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P412-event-cleanup-2026!'
email="p412-event-cleanup-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
signup="$(signup_test_user "$email" "$password")"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$user_id"
test "$user_id" != 'null'
confirm_test_user "$user_id"

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

cleanup_version_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_templates (event_key, event_family, created_by)
  values ('event.p412-cleanup','community-objective','$user_id'::uuid);

  insert into app_private.event_definition_versions (
    event_key,
    definition_version,
    definition,
    published_by
  ) values (
    'event.p412-cleanup',
    1,
    jsonb_build_object(
      'schemaVersion',1,
      'eventKey','event.p412-cleanup',
      'templateKey','template.community-objective',
      'contentVersion',1,
      'title','P4.12 Cleanup Verification',
      'phases',jsonb_build_array(
        jsonb_build_object(
          'id','mobilization',
          'name','Mobilization',
          'objectives',jsonb_build_array(),
          'effects',jsonb_build_array(),
          'cleanupEffects',jsonb_build_array(
            jsonb_build_object(
              'type','event-node',
              'referenceKey','node.p412-cleanup',
              'enabled',false
            )
          ),
          'transition',jsonb_build_object('type','manual')
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
    '$user_id'::uuid
  )
  returning id::text;")"
test -n "$cleanup_version_id"

clean_version_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_templates (event_key, event_family, created_by)
  values ('event.p412-clean','community-objective','$user_id'::uuid);

  insert into app_private.event_definition_versions (
    event_key,
    definition_version,
    definition,
    published_by
  ) values (
    'event.p412-clean',
    1,
    jsonb_build_object(
      'schemaVersion',1,
      'eventKey','event.p412-clean',
      'templateKey','template.community-objective',
      'contentVersion',1,
      'title','P4.12 No Cleanup Verification',
      'phases',jsonb_build_array(
        jsonb_build_object(
          'id','mobilization',
          'name','Mobilization',
          'objectives',jsonb_build_array(),
          'effects',jsonb_build_array(),
          'cleanupEffects',jsonb_build_array(),
          'transition',jsonb_build_object('type','manual')
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
    '$user_id'::uuid
  )
  returning id::text;")"
test -n "$clean_version_id"

create_run() {
  local event_key="$1"
  local version_id="$2"
  local run_mode="$3"
  local lifecycle="$4"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    insert into app_private.event_runs (
      event_key,
      definition_version_id,
      run_mode,
      lifecycle_status,
      scope_type,
      current_phase_id,
      created_by
    ) values (
      '$event_key',
      '$version_id'::uuid,
      '$run_mode',
      '$lifecycle',
      'global',
      'mobilization',
      '$user_id'::uuid
    )
    returning id::text;"
}

initialize_state() {
  local run_id="$1"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
    insert into app_private.event_run_phases (
      run_id, phase_id, ordinal, phase_status, started_at
    ) values
      ('$run_id'::uuid,'mobilization',0,'live',clock_timestamp()),
      ('$run_id'::uuid,'aftermath',1,'pending',null);

    insert into app_private.event_run_objectives (
      run_id, phase_id, objective_id, objective_status, progress, target
    ) values
      ('$run_id'::uuid,'mobilization','community','active',1,2),
      ('$run_id'::uuid,'aftermath','epilogue','inactive',0,1);
  " >/dev/null
}

transition_run() {
  local run_id="$1"
  local expected_version="$2"
  local key="$3"
  local to_status="$4"
  local reason="$5"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select lifecycle_status || '|' || state_version::text || '|' || replayed::text
    from public.transition_event_run_v1(
      '$run_id'::uuid,
      '$expected_version'::bigint,
      '$key'::uuid,
      '$to_status',
      '$reason'
    );"
}

cleanup_run="$(create_run 'event.p412-cleanup' "$cleanup_version_id" 'production' 'live')"
test -n "$cleanup_run"
initialize_state "$cleanup_run"

resolve_cleanup="$(transition_run   "$cleanup_run"   1   '00000000-0000-4000-8000-000000004151'   'resolving'   'P4.12 resolve cleanup run')"
test "$resolve_cleanup" = 'resolving|2|false'

end_cleanup="$(transition_run   "$cleanup_run"   2   '00000000-0000-4000-8000-000000004152'   'ended'   'P4.12 end cleanup run')"
test "$end_cleanup" = 'ended|3|false'

terminal_state="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    lifecycle_status || '|' ||
    state_version::text || '|' ||
    coalesce(current_phase_id,'-') || '|' ||
    cleanup_status || '|' ||
    (cleanup_required_at is not null)::text || '|' ||
    (cleanup_completed_at is null)::text
  from app_private.event_runs
  where id = '$cleanup_run'::uuid;")"
test "$terminal_state" = 'ended|3|-|pending|true|true'

phase_state="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select string_agg(phase_id || ':' || phase_status, ',' order by ordinal)
  from app_private.event_run_phases
  where run_id = '$cleanup_run'::uuid;")"
test "$phase_state" = 'mobilization:completed,aftermath:skipped'

objective_state="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select string_agg(objective_id || ':' || objective_status, ',' order by objective_id)
  from app_private.event_run_objectives
  where run_id = '$cleanup_run'::uuid;")"
test "$objective_state" = 'community:failed,epilogue:failed'

cleanup_requirement="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    phase_id || '|' ||
    effect_ordinal::text || '|' ||
    effect_type || '|' ||
    reference_key || '|' ||
    enabled::text || '|' ||
    cleanup_status
  from app_private.event_run_cleanup_requirements
  where run_id = '$cleanup_run'::uuid;")"
test "$cleanup_requirement" = 'mobilization|0|event-node|node.p412-cleanup|false|pending'

if transition_run   "$cleanup_run"   3   '00000000-0000-4000-8000-000000004153'   'archived'   'P4.12 archive blocked cleanup run' >/tmp/p412-cleanup-archive.out 2>/tmp/p412-cleanup-archive.err; then
  echo 'Expected archive to fail while cleanup obligations remain pending.' >&2
  exit 1
fi
grep -Fq 'EVENT_RUN_CLEANUP_PENDING' /tmp/p412-cleanup-archive.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  insert into app_private.event_run_cleanup_requirements (
    run_id,
    phase_id,
    effect_ordinal,
    effect_type,
    reference_key,
    enabled
  ) values (
    '$cleanup_run'::uuid,
    'mobilization',
    99,
    'event-node',
    'node.forged-cleanup',
    false
  );" >/tmp/p412-cleanup-direct.out 2>/tmp/p412-cleanup-direct.err; then
  echo 'Service role unexpectedly forged an Event cleanup requirement.' >&2
  exit 1
fi
grep -Fq 'permission denied for table event_run_cleanup_requirements' /tmp/p412-cleanup-direct.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  update app_private.event_runs
  set cleanup_status = 'completed',
      cleanup_completed_at = clock_timestamp()
  where id = '$cleanup_run'::uuid;" >/tmp/p412-cleanup-state-direct.out 2>/tmp/p412-cleanup-state-direct.err; then
  echo 'Service role unexpectedly bypassed cleanup authority on Event Run.' >&2
  exit 1
fi
grep -Fq 'permission denied for table event_runs' /tmp/p412-cleanup-state-direct.err

clean_run="$(create_run 'event.p412-clean' "$clean_version_id" 'production' 'live')"
test -n "$clean_run"
initialize_state "$clean_run"

test "$(transition_run   "$clean_run"   1   '00000000-0000-4000-8000-000000004154'   'resolving'   'P4.12 resolve clean run')" = 'resolving|2|false'

test "$(transition_run   "$clean_run"   2   '00000000-0000-4000-8000-000000004155'   'ended'   'P4.12 end clean run')" = 'ended|3|false'

clean_terminal="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select cleanup_status || '|' || coalesce(current_phase_id,'-')
  from app_private.event_runs
  where id = '$clean_run'::uuid;")"
test "$clean_terminal" = 'not-required|-'

test "$(transition_run   "$clean_run"   3   '00000000-0000-4000-8000-000000004156'   'archived'   'P4.12 archive clean run')" = 'archived|4|false'

archived_incomplete="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    (
      select count(*)
      from app_private.event_run_phases
      where run_id = '$clean_run'::uuid
        and phase_status in ('pending','live')
    )::text || '|' ||
    (
      select count(*)
      from app_private.event_run_objectives
      where run_id = '$clean_run'::uuid
        and objective_status in ('inactive','active')
    )::text;")"
test "$archived_incomplete" = '0|0'

preview_run="$(create_run 'event.p412-cleanup' "$cleanup_version_id" 'preview' 'preview')"
test -n "$preview_run"
initialize_state "$preview_run"

test "$(transition_run   "$preview_run"   1   '00000000-0000-4000-8000-000000004157'   'archived'   'P4.12 archive preview run')" = 'archived|2|false'

preview_state="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    cleanup_status || '|' ||
    coalesce(current_phase_id,'-') || '|' ||
    (
      select count(*)
      from app_private.event_run_cleanup_requirements
      where run_id = '$preview_run'::uuid
    )::text
  from app_private.event_runs
  where id = '$preview_run'::uuid;")"
test "$preview_state" = 'not-required|-|0'

preview_phase_state="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select string_agg(phase_id || ':' || phase_status, ',' order by ordinal)
  from app_private.event_run_phases
  where run_id = '$preview_run'::uuid;")"
test "$preview_phase_state" = 'mobilization:skipped,aftermath:skipped'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from app_private.event_run_cleanup_requirements;" >/tmp/p412-cleanup-browser.out 2>/tmp/p412-cleanup-browser.err; then
  echo 'Authenticated browser unexpectedly read private Event cleanup requirements.' >&2
  exit 1
fi

echo 'Phase 4 Event terminal state and fail-closed cleanup invariants verified.'
