#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

privileges="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_function_privilege(
      'authenticated',
      'public.get_character_public_active_disciplines_v1(uuid[])',
      'EXECUTE'
    )::text || '|' ||
    has_function_privilege(
      'service_role',
      'public.get_character_public_active_disciplines_v1(uuid[])',
      'EXECUTE'
    )::text;")"
test "$privileges" = 'false|true'

fixture="$(docker exec "$db_container" psql -U postgres -d postgres -AtF '|' -c "
  select
    build.character_id::text,
    build.primary_discipline_id,
    definition.discipline_id,
    definition.definition_version::text
  from app_private.character_active_builds as build
  cross join lateral (
    select
      candidate.discipline_id,
      candidate.definition_version
    from app_private.discipline_definitions as candidate
    where candidate.discipline_id <> build.primary_discipline_id
      and candidate.enabled_for_secondary
    order by candidate.discipline_id, candidate.definition_version desc
    limit 1
  ) as definition
  where build.secondary_discipline_id is null
  order by build.updated_at desc, build.character_id
  limit 1;")"

IFS='|' read -r character_id primary_discipline secondary_discipline secondary_version <<<"$fixture"
test -n "$character_id"
test -n "$primary_discipline"
test -n "$secondary_discipline"
test -n "$secondary_version"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_active_builds
  set
    secondary_discipline_id = '$secondary_discipline',
    secondary_definition_version = '$secondary_version'::integer
  where character_id = '$character_id'::uuid;
" >/dev/null

projection="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    character_id::text || '|' ||
    primary_discipline_id || '|' ||
    coalesce(secondary_discipline_id,'')
  from public.get_character_public_active_disciplines_v1(
    array['$character_id'::uuid]
  );")"
test "$projection" = "$character_id|$primary_discipline|$secondary_discipline"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.get_character_public_active_disciplines_v1(
    array['$character_id'::uuid]
  );" >/tmp/online-users-build-browser.out 2>/tmp/online-users-build-browser.err; then
  echo 'Authenticated browser unexpectedly read committed Discipline build identity directly.' >&2
  exit 1
fi

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_active_builds
  set
    secondary_discipline_id = null,
    secondary_definition_version = null
  where character_id = '$character_id'::uuid;
" >/dev/null

echo 'Online Users committed Primary/Secondary Discipline projection verified.'
