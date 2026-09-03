#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P31-build-authority-2026!'
email="p31-build-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
signup="$(signup_test_user "$email" "$password")"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$user_id"
test "$user_id" != 'null'
confirm_test_user "$user_id"

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select id::text
  from public.create_character_v3(
    '$user_id'::uuid,
    0::smallint,
    '00000000-0000-4000-8000-000000003101'::uuid,
    'p31:character',
    1,
    'P31 Build Tester',
    'p31buildtester',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    7, 6, 5, 6, 5, 7
  );")"
test -n "$character_id"

catalog="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text || '|' || bool_and(definition_version = 1)::text || '|' || bool_and(profile_version = 1)::text
  from public.get_primary_discipline_catalog_v1();")"
test "$catalog" = '6|true|true'

initial_build="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || primary_discipline_id || '|' || primary_definition_version::text || '|' || primary_profile_version::text
  from public.get_character_active_build_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$initial_build" = '1|vanguard|1|1'

attributes_before="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select might::text || '|' || finesse::text || '|' || vitality::text || '|' || agility::text || '|' || intellect::text || '|' || resolve::text
  from public.characters
  where id = '$character_id'::uuid;")"
test "$attributes_before" = '7|6|5|6|5|7'

change_one="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || primary_discipline_id || '|' || replayed::text
  from public.change_character_primary_discipline_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1,
    'aetherist',
    '00000000-0000-4000-8000-000000003102'::uuid,
    'sha256:p31-aetherist'
  );")"
test "$change_one" = '2|aetherist|false'

attributes_after="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select might::text || '|' || finesse::text || '|' || vitality::text || '|' || agility::text || '|' || intellect::text || '|' || resolve::text
  from public.characters
  where id = '$character_id'::uuid;")"
test "$attributes_after" = "$attributes_before"

replay="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || primary_discipline_id || '|' || replayed::text
  from public.change_character_primary_discipline_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1,
    'aetherist',
    '00000000-0000-4000-8000-000000003102'::uuid,
    'sha256:p31-aetherist'
  );")"
test "$replay" = '2|aetherist|true'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.change_character_primary_discipline_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1,
    'lifebinder',
    '00000000-0000-4000-8000-000000003103'::uuid,
    'sha256:p31-stale'
  );" >/tmp/p31-stale.out 2>/tmp/p31-stale.err; then
  echo 'Expected stale build version to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_BUILD_VERSION_CONFLICT' /tmp/p31-stale.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.change_character_primary_discipline_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2,
    'not-a-discipline',
    '00000000-0000-4000-8000-000000003104'::uuid,
    'sha256:p31-invalid'
  );" >/tmp/p31-invalid.out 2>/tmp/p31-invalid.err; then
  echo 'Expected unavailable Primary Discipline to fail.' >&2
  exit 1
fi
grep -Fq 'PRIMARY_DISCIPLINE_UNAVAILABLE' /tmp/p31-invalid.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.change_character_primary_discipline_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2,
    'lifebinder',
    '00000000-0000-4000-8000-000000003102'::uuid,
    'sha256:p31-different'
  );" >/tmp/p31-idempotency.out 2>/tmp/p31-idempotency.err; then
  echo 'Expected reused idempotency key with a different fingerprint to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_BUILD_IDEMPOTENCY_CONFLICT' /tmp/p31-idempotency.err

audit_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)::text || '|' || min(build_version_before)::text || '|' || max(build_version_after)::text || '|' || min(from_primary_discipline_id) || '|' || min(to_primary_discipline_id)
  from app_private.character_build_change_audit
  where character_id = '$character_id'::uuid;")"
test "$audit_snapshot" = '1|1|2|vanguard|aetherist'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.get_primary_discipline_catalog_v1();" >/tmp/p31-browser-catalog.out 2>/tmp/p31-browser-catalog.err; then
  echo 'Authenticated browser role unexpectedly read the server-only Primary catalog RPC.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.get_character_active_build_v1('$user_id'::uuid, '$character_id'::uuid);" >/tmp/p31-browser-build.out 2>/tmp/p31-browser-build.err; then
  echo 'Authenticated browser role unexpectedly read the server-only active-build RPC.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.change_character_primary_discipline_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2,
    'lifebinder',
    '00000000-0000-4000-8000-000000003105'::uuid,
    'sha256:p31-browser'
  );" >/tmp/p31-browser-change.out 2>/tmp/p31-browser-change.err; then
  echo 'Authenticated browser role unexpectedly executed the Primary change RPC.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from app_private.character_active_builds;" >/tmp/p31-browser-private.out 2>/tmp/p31-browser-private.err; then
  echo 'Authenticated browser role unexpectedly read app_private build state.' >&2
  exit 1
fi
