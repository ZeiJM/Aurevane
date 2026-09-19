#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

version_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select id::text
  from app_private.event_definition_versions
  where event_key = 'event.p412-cleanup'
  order by definition_version desc
  limit 1;")"
test -n "$version_id"

created_by="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select published_by::text
  from app_private.event_definition_versions
  where id = '$version_id'::uuid;")"
test -n "$created_by"

run_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key,
    definition_version_id,
    run_mode,
    lifecycle_status,
    scope_type,
    current_phase_id,
    created_by
  ) values (
    'event.p412-cleanup',
    '$version_id'::uuid,
    'production',
    'scheduled',
    'global',
    'mobilization',
    '$created_by'::uuid
  )
  returning id::text;")"
test -n "$run_id"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_run_phases (
    run_id, phase_id, ordinal, phase_status
  ) values
    ('$run_id'::uuid,'mobilization',0,'pending'),
    ('$run_id'::uuid,'aftermath',1,'pending');

  insert into app_private.event_run_objectives (
    run_id, phase_id, objective_id, objective_status, progress, target
  ) values (
    '$run_id'::uuid,'mobilization','community','inactive',0,2
  );
" >/dev/null

cancelled="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.transition_event_run_v1(
    '$run_id'::uuid,
    1,
    '00000000-0000-4000-8000-000000004159'::uuid,
    'cancelled',
    'P4.12 pre-start cancellation'
  );")"
test "$cancelled" = 'cancelled|2'

state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    cleanup_status || '|' ||
    (select count(*)::text
       from app_private.event_run_cleanup_requirements
       where run_id = '$run_id'::uuid) || '|' ||
    coalesce(current_phase_id,'-')
  from app_private.event_runs
  where id = '$run_id'::uuid;")"
test "$state" = 'not-required|0|-'

phase_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select string_agg(phase_id || ':' || phase_status, ',' order by ordinal)
  from app_private.event_run_phases
  where run_id = '$run_id'::uuid;")"
test "$phase_state" = 'mobilization:skipped,aftermath:skipped'

archived="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.transition_event_run_v1(
    '$run_id'::uuid,
    2,
    '00000000-0000-4000-8000-000000004160'::uuid,
    'archived',
    'P4.12 archive cancelled pre-start run'
  );")"
test "$archived" = 'archived|3'

echo 'Phase 4 pre-start Event cancellation cleanup isolation verified.'
