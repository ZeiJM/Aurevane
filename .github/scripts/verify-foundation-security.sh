#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

helper_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select case
    when to_regprocedure('public.rls_auto_enable()') is null then 'absent'
    else
      has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')::text || '|' ||
      has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')::text || '|' ||
      has_function_privilege('service_role', 'public.rls_auto_enable()', 'EXECUTE')::text
  end;")"

if [ "$helper_state" != 'absent' ]; then
  test "$helper_state" = 'false|false|true'
fi

schema_privileges="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    has_schema_privilege('anon','app_private','USAGE')::text || '|' ||
    has_schema_privilege('authenticated','app_private','USAGE')::text || '|' ||
    has_schema_privilege('service_role','app_private','USAGE')::text;")"

test "$schema_privileges" = 'false|false|true'
