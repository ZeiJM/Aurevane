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

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  update app_private.event_runs
  set lifecycle_status = 'live'
  where id = '$run_id'::uuid;" >/tmp/p52-direct-run-update.out 2>/tmp/p52-direct-run-update.err; then
  echo 'Service role unexpectedly bypassed the event run lifecycle RPC.' >&2
  exit 1
fi
grep -Fq 'permission denied for table event_runs' /tmp/p52-direct-run-update.err

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
    '$transition_key'::uuid,
    'paused',
    'CI conflicting replay'
  );" >/tmp/p52-idempotency-conflict.out 2>/tmp/p52-idempotency-conflict.err; then
  echo 'Expected conflicting event transition replay to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_RUN_IDEMPOTENCY_CONFLICT' /tmp/p52-idempotency-conflict.err

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

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  create or replace function app_private.delay_p52_event_transition_for_test()
  returns trigger
  language plpgsql
  as \$\$
  begin
    if old.id = '$run_id'::uuid and old.state_version = 2 then
      perform pg_sleep(2);
    end if;
    return new;
  end;
  \$\$;

  create trigger delay_p52_event_transition_for_test
  before update on app_private.event_runs
  for each row execute function app_private.delay_p52_event_transition_for_test();
" >/dev/null

concurrent_key='00000000-0000-4000-8000-000000005204'
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select run_id::text || '|' || lifecycle_status || '|' || state_version::text || '|' || replayed::text
  from public.transition_event_run_v1(
    '$run_id'::uuid,
    2,
    '$concurrent_key'::uuid,
    'paused',
    'CI concurrent replay'
  );" >/tmp/p52-concurrent-a.out 2>/tmp/p52-concurrent-a.err &
concurrent_a_pid=$!

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select run_id::text || '|' || lifecycle_status || '|' || state_version::text || '|' || replayed::text
  from public.transition_event_run_v1(
    '$run_id'::uuid,
    2,
    '$concurrent_key'::uuid,
    'paused',
    'CI concurrent replay'
  );" >/tmp/p52-concurrent-b.out 2>/tmp/p52-concurrent-b.err &
concurrent_b_pid=$!

wait "$concurrent_a_pid"
wait "$concurrent_b_pid"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  drop trigger delay_p52_event_transition_for_test on app_private.event_runs;
  drop function app_private.delay_p52_event_transition_for_test();
" >/dev/null

concurrent_results="$(cat /tmp/p52-concurrent-a.out /tmp/p52-concurrent-b.out | sort)"
concurrent_expected="$(printf '%s\n%s\n' "$run_id|paused|3|false" "$run_id|paused|3|true" | sort)"
test "$concurrent_results" = "$concurrent_expected"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.list_recoverable_event_runs_v1();" >/tmp/p52-browser.out 2>/tmp/p52-browser.err; then
  echo 'Authenticated browser unexpectedly read private event recovery state.' >&2
  exit 1
fi

preview_run_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key,
    definition_version_id,
    run_mode,
    lifecycle_status,
    scope_type,
    scope_key,
    current_phase_id,
    created_by
  ) values (
    'event.frostmere-storm',
    '$version_id'::uuid,
    'preview',
    'preview',
    'region',
    'region.frostmere',
    'omen',
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$preview_run_id"

preview_cancel="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.transition_event_run_v1(
    '$preview_run_id'::uuid,
    1,
    '00000000-0000-4000-8000-000000005203'::uuid,
    'cancelled',
    'CI preview cleanup'
  );")"
test "$preview_cancel" = 'cancelled|2'

echo 'Phase 5 persistent event kernel verification passed.'
