#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P36-essence-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

email="p36-essence-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
signup="$(signup_test_user "$email" "$password")"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$user_id"
test "$user_id" != 'null'
confirm_test_user "$user_id"

character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select id::text
  from public.create_character_v3(
    '$user_id'::uuid,
    0::smallint,
    '00000000-0000-4000-8000-000000003601'::uuid,
    'p36:character:essencetester',
    1,
    'P36 Essence Tester',
    'p36essencetester',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    7, 6, 5, 6, 5, 7
  );")"
test -n "$character_id"

initial="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select schema_version::text || '|' || build_version::text || '|' || primary_discipline_id || '|' || coalesce(secondary_discipline_id, '')
  from public.get_character_active_build_v2('$user_id'::uuid, '$character_id'::uuid);")"
test "$initial" = '2|1|vanguard|'

pure_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    (snapshot ->> 'schemaVersion') || '|' ||
    coalesce(snapshot -> 'extensions' ->> 'resonance', '') || '|' ||
    (snapshot -> 'extensions' -> 'essence' ->> 'essenceId') || '|' ||
    (snapshot -> 'extensions' -> 'essence' ->> 'contentVersion') || '|' ||
    (snapshot -> 'extensions' -> 'essence' ->> 'sourceDisciplineId') || '|' ||
    (snapshot -> 'extensions' -> 'essence' ->> 'skillId') || '|' ||
    (snapshot -> 'extensions' -> 'essence' ->> 'skillContentVersion') || '|' ||
    jsonb_array_length(snapshot -> 'disciplineSkills')::text
  from (
    select public.get_character_committed_build_snapshot_v2('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$pure_snapshot" = '2||essence.vanguard.unbroken-strike|1|vanguard|essence.vanguard.unbroken-strike|1|0'

privileges="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    has_table_privilege('authenticated', 'app_private.essence_definitions', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.essence_definitions', 'UPDATE')::text || '|' ||
    has_function_privilege(
      'authenticated',
      'app_private.resolve_essence_reference_v1(text,text)',
      'EXECUTE'
    )::text || '|' ||
    (select count(*)::text
      from information_schema.columns
      where table_schema = 'app_private'
        and table_name = 'character_active_builds'
        and column_name = 'essence_id');")"
test "$privileges" = 'false|false|false|0'

mastery="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select discipline_id || '|' || mastered_definition_version::text || '|' || replayed::text
  from public.record_character_discipline_mastery_v1(
    '$character_id'::uuid,
    'lifebinder',
    'system',
    'p36.database-proof'
  );")"
test "$mastery" = 'lifebinder|1|false'

mixed_change="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select schema_version::text || '|' || build_version::text || '|' || primary_discipline_id || '|' || secondary_discipline_id
  from public.change_character_disciplines_v2(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1,
    false,
    'vanguard',
    true,
    'lifebinder',
    '00000000-0000-4000-8000-000000003602'::uuid,
    'sha256:p36-mixed'
  );")"
test "$mixed_change" = '2|2|vanguard|lifebinder'

mixed_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    coalesce(snapshot -> 'extensions' ->> 'essence', '') || '|' ||
    (snapshot -> 'extensions' -> 'resonance' ->> 'resonanceId') || '|' ||
    jsonb_array_length(snapshot -> 'disciplineSkills')::text
  from (
    select public.get_character_committed_build_snapshot_v2('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$mixed_snapshot" = '|resonance.lifebinder-vanguard.mercys-edge|0'

# Expire only the Secondary attunement lock so the authoritative removal path can be exercised.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_active_builds
  set secondary_attunement_locked_until = clock_timestamp() - interval '1 second'
  where character_id = '$character_id'::uuid;" >/dev/null

pure_again="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select schema_version::text || '|' || build_version::text || '|' || coalesce(secondary_discipline_id, '')
  from public.change_character_disciplines_v2(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2,
    false,
    'vanguard',
    true,
    null,
    '00000000-0000-4000-8000-000000003603'::uuid,
    'sha256:p36-pure-again'
  );")"
test "$pure_again" = '2|3|'

restored_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    (snapshot -> 'extensions' -> 'essence' ->> 'essenceId') || '|' ||
    coalesce(snapshot -> 'extensions' ->> 'resonance', '') || '|' ||
    jsonb_array_length(snapshot -> 'disciplineSkills')::text
  from (
    select public.get_character_committed_build_snapshot_v2('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$restored_snapshot" = 'essence.vanguard.unbroken-strike||0'

echo 'P3.6 Essence database authority verified.'
