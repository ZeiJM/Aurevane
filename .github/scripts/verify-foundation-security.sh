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

# Exercise the exact server-side spectator projection under its real database role.
# This fails with 42501 even when no matching character exists if either column
# is unreadable; it must not accidentally run as the postgres connection owner.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  begin;
  set local role service_role;
  select id, personal_title from public.characters
  where id in ('00000000-0000-4000-8000-000000000000'::uuid);
  rollback;"

browser_character_authority() {
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    select jsonb_build_object(
      'table_grants', (select jsonb_agg(to_jsonb(g) order by grantee, privilege_type)
        from information_schema.table_privileges g
        where table_schema = 'public' and table_name = 'characters'
          and grantee in ('PUBLIC', 'anon', 'authenticated')),
      'column_grants', (select jsonb_agg(to_jsonb(g) order by grantee, column_name, privilege_type)
        from information_schema.column_privileges g
        where table_schema = 'public' and table_name = 'characters'
          and grantee in ('PUBLIC', 'anon', 'authenticated')),
      'rls', (select relrowsecurity from pg_class where oid = 'public.characters'::regclass),
      'policies', (select jsonb_agg(to_jsonb(p) order by policyname)
        from pg_policies p where schemaname = 'public' and tablename = 'characters')
    );"
}

# Reapplying the additive privilege contract must preserve all browser grants,
# ownership policies and RLS, including existing deployment-specific grants.
browser_authority_before="$(browser_character_authority)"
docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < supabase/migrations/20260912165224_spectator_participant_title_read.sql
test "$(browser_character_authority)" = "$browser_authority_before"

browser_privileges="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    has_any_column_privilege('anon', 'public.characters', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'public.characters', 'SELECT')::text || '|' ||
    has_any_column_privilege('authenticated', 'public.characters', 'INSERT,UPDATE')::text || '|' ||
    has_table_privilege('authenticated', 'public.characters', 'DELETE,TRUNCATE')::text || '|' ||
    (select relrowsecurity from pg_class where oid = 'public.characters'::regclass)::text;")"
test "$browser_privileges" = 'false|true|false|false|true'

echo 'Spectator title server-read and browser authority checks passed.'
