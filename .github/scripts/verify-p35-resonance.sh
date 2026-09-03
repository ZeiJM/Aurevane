#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P35-resonance-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

email="p35-resonance-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
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
    '00000000-0000-4000-8000-000000003501'::uuid,
    'p35:character:resonancetester',
    1,
    'P35 Resonance Tester',
    'p35resonancetester',
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
test "$initial" = '4|1|vanguard|'

pure_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    (snapshot ->> 'schemaVersion') || '|' ||
    coalesce(snapshot -> 'extensions' ->> 'resonance', '')
  from (
    select public.get_character_committed_build_snapshot_v1('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$pure_snapshot" = '4|'

privileges="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    has_table_privilege('authenticated', 'app_private.resonance_definitions', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.resonance_definitions', 'UPDATE')::text || '|' ||
    has_function_privilege(
      'authenticated',
      'app_private.resolve_resonance_reference_v1(text,text)',
      'EXECUTE'
    )::text || '|' ||
    (select count(*)::text
      from information_schema.columns
      where table_schema = 'app_private'
        and table_name = 'character_active_builds'
        and column_name = 'resonance_id');")"
test "$privileges" = 'false|false|false|0'

mastery="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select discipline_id || '|' || mastered_definition_version::text || '|' || replayed::text
  from public.record_character_discipline_mastery_v1(
    '$character_id'::uuid,
    'lifebinder',
    'system',
    'p35.database-proof'
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
    '00000000-0000-4000-8000-000000003502'::uuid,
    'sha256:p35-mixed'
  );")"
test "$mixed_change" = '4|2|vanguard|lifebinder'

mixed_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    (snapshot ->> 'schemaVersion') || '|' ||
    (snapshot -> 'extensions' -> 'resonance' ->> 'resonanceId') || '|' ||
    (snapshot -> 'extensions' -> 'resonance' ->> 'contentVersion') || '|' ||
    (snapshot -> 'extensions' -> 'resonance' -> 'disciplinePair' ->> 0) || '|' ||
    (snapshot -> 'extensions' -> 'resonance' -> 'disciplinePair' ->> 1)
  from (
    select public.get_character_committed_build_snapshot_v1('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$mixed_snapshot" = '4|resonance.lifebinder-vanguard.mercys-edge|1|lifebinder|vanguard'

# Content disablement fails closed: the pair cannot fabricate or retain a disabled Resonance.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.resonance_definitions
  set enabled = false
  where resonance_id = 'resonance.lifebinder-vanguard.mercys-edge'
    and content_version = 1;" >/dev/null

disabled_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select coalesce(snapshot -> 'extensions' ->> 'resonance', '')
  from (
    select public.get_character_committed_build_snapshot_v1('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$disabled_snapshot" = ''

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.resonance_definitions
  set enabled = true
  where resonance_id = 'resonance.lifebinder-vanguard.mercys-edge'
    and content_version = 1;
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
    '00000000-0000-4000-8000-000000003503'::uuid,
    'sha256:p35-pure-again'
  );")"
test "$pure_again" = '4|3|'

resolved_pure_again="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select coalesce(snapshot -> 'extensions' ->> 'resonance', '')
  from (
    select public.get_character_committed_build_snapshot_v1('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$resolved_pure_again" = ''

echo 'P3.5 Resonance database authority verified.'
