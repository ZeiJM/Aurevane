#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P52-event-kernel-2026!'
owner_email="p52-event-owner-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
owner_signup="$(signup_test_user "$owner_email" "$password")"
owner_id="$(printf '%s' "$owner_signup" | jq -r '.user.id')"
test -n "$owner_id"
test "$owner_id" != 'null'
confirm_test_user "$owner_id"

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

version_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_templates (event_key, event_family, created_by)
  values ('event.frostmere-storm','regional-event','$owner_id'::uuid);

  insert into app_private.event_definition_versions (
    event_key,
    definition_version,
    definition,
    published_by
  ) values (
    'event.frostmere-storm',
    1,
    jsonb_build_object(
      'schemaVersion',1,
      'eventKey','event.frostmere-storm',
      'templateKey','template.regional-crisis',
      'contentVersion',1,
      'title','Storm over Frostmere',
      'scope',jsonb_build_object('type','region','key','region.frostmere')
    ),
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$version_id"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_publications (event_key, version_id, updated_by)
  values ('event.frostmere-storm','$version_id'::uuid,'$owner_id'::uuid);
" >/dev/null

current="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select event_key || '|' || definition_version::text
  from public.read_current_event_definition_v1('event.frostmere-storm');")"
test "$current" = 'event.frostmere-storm|1'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.event_definition_versions
  set definition = jsonb_build_object('mutated',true)
  where id = '$version_id'::uuid;" >/tmp/p52-immutable.out 2>/tmp/p52-immutable.err; then
  echo 'Expected immutable event definition update to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_DEFINITION_VERSION_IMMUTABLE' /tmp/p52-immutable.err

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
    'event.frostmere-storm',
    '$version_id'::uuid,
    'production',
    'scheduled',
    'region',
    'region.frostmere',
    clock_timestamp() - interval '1 minute',
    clock_timestamp() + interval '2 hours',
    'omen',
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$run_id"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_run_phases (run_id, phase_id, ordinal, phase_status)
  values
    ('$run_id'::uuid,'omen',0,'pending'),
    ('$run_id'::uuid,'crisis',1,'pending');

  insert into app_private.event_run_objectives (
    run_id, phase_id, objective_id, objective_status, progress, target
  ) values (
    '$run_id'::uuid,'omen','survey','inactive',0,1
  );
" >/dev/null

recoverable="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select run_id::text || '|' || lifecycle_status || '|' || state_version::text
  from public.list_recoverable_event_runs_v1()
  where run_id = '$run_id'::uuid;")"
test "$recoverable" = "$run_id|scheduled|1"

transition_key='00000000-0000-4000-8000-000000005201'
first="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select run_id::text || '|' || lifecycle_status || '|' || state_version::text || '|' || replayed::text
  from public.transition_event_run_v1(
    '$run_id'::uuid,
    1,
    '$transition_key'::uuid,
    'live',
    'CI scheduled start'
  );")"
test "$first" = "$run_id|live|2|false"

second="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select run_id::text || '|' || lifecycle_status || '|' || state_version::text || '|' || replayed::text
  from public.transition_event_run_v1(
    '$run_id'::uuid,
    1,
    '$transition_key'::uuid,
    'live',
    'CI scheduled start'
  );")"
test "$second" = "$run_id|live|2|true"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.transition_event_run_v1(
    '$run_id'::uuid,
    1,
    '00000000-0000-4000-8000-000000005202'::uuid,
    'paused',
    'CI stale transition'
  );" >/tmp/p52-stale.out 2>/tmp/p52-stale.err; then
  echo 'Expected stale event state version to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_RUN_STATE_VERSION_CONFLICT' /tmp/p52-stale.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.list_recoverable_event_runs_v1();" >/tmp/p52-browser.out 2>/tmp/p52-browser.err; then
  echo 'Authenticated browser unexpectedly read private event recovery state.' >&2
  exit 1
fi

echo 'Phase 5 persistent event kernel verification passed.'
