#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

privileges="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_table_privilege('service_role','app_private.event_templates','INSERT')::text || '|' ||
    has_table_privilege('service_role','app_private.event_definition_versions','INSERT')::text || '|' ||
    has_table_privilege('service_role','app_private.event_publications','UPDATE')::text || '|' ||
    has_table_privilege('service_role','app_private.event_runs','INSERT')::text || '|' ||
    has_table_privilege('service_role','app_private.event_run_phases','UPDATE')::text || '|' ||
    has_table_privilege('service_role','app_private.event_run_objectives','UPDATE')::text;")"
test "$privileges" = 'false|false|false|false|false|false'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  insert into app_private.event_templates (
    event_key, event_family, created_by
  ) values (
    'event.p413-forged',
    'regional-event',
    '00000000-0000-4000-8000-000000004399'::uuid
  );" >/tmp/p413-direct-template.out 2>/tmp/p413-direct-template.err; then
  echo 'Service role unexpectedly bypassed Event Builder with a direct template write.' >&2
  exit 1
fi
grep -Fq 'permission denied for table event_templates' /tmp/p413-direct-template.err

run_id="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select id::text
  from app_private.event_runs
  order by created_at desc
  limit 1;")"

if [ -n "$run_id" ]; then
  if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
    set role service_role;
    update app_private.event_run_phases
    set phase_status = 'completed'
    where run_id = '$run_id'::uuid;" >/tmp/p413-direct-phase.out 2>/tmp/p413-direct-phase.err; then
    echo 'Service role unexpectedly bypassed Event operations with a direct phase update.' >&2
    exit 1
  fi
  grep -Fq 'permission denied for table event_run_phases' /tmp/p413-direct-phase.err
fi

echo 'Phase 4 Event Builder direct-write authority boundary verified.'
