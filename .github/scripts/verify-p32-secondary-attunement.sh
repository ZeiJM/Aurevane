#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P32-secondary-authority-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

create_test_user() {
  local email="$1"
  local signup user_id
  signup="$(signup_test_user "$email" "$password")"
  user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
  test -n "$user_id"
  test "$user_id" != 'null'
  confirm_test_user "$user_id"
  printf '%s' "$user_id"
}

create_test_character() {
  local user_id="$1"
  local idempotency_key="$2"
  local name="$3"
  local name_key="$4"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select id::text
    from public.create_character_v3(
      '$user_id'::uuid,
      0::smallint,
      '$idempotency_key'::uuid,
      'p32:character:$name_key',
      1,
      '$name',
      '$name_key',
      'androgynous',
      'they_them',
      'portrait.starter.wayfarer-01',
      'appearance.starter.roadworn',
      'vanguard',
      7, 6, 5, 6, 5, 7
    );"
}

policy="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select policy.version::text || '|' || policy.primary_cooldown_seconds::text || '|' || policy.secondary_cooldown_seconds::text
  from app_private.character_build_attunement_policy_state state
  join app_private.character_build_attunement_policies policy
    on policy.version = state.current_policy_version
  where state.singleton;")"
test "$policy" = '1|14400|14400'

email="p32-build-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
user_id="$(create_test_user "$email")"
character_id="$(create_test_character "$user_id" '00000000-0000-4000-8000-000000003201' 'P32 Build Tester' 'p32buildtester')"
test -n "$character_id"

initial="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select schema_version::text || '|' || build_version::text || '|' || primary_discipline_id || '|' || coalesce(secondary_discipline_id, '') || '|' || primary_cooldown_seconds::text || '|' || secondary_cooldown_seconds::text
  from public.get_character_active_build_v2('$user_id'::uuid, '$character_id'::uuid);")"
test "$initial" = '2|1|vanguard||14400|14400'

attributes_before="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select might::text || '|' || finesse::text || '|' || vitality::text || '|' || agility::text || '|' || intellect::text || '|' || resolve::text
  from public.characters where id = '$character_id'::uuid;")"
test "$attributes_before" = '7|6|5|6|5|7'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.change_character_disciplines_v2(
    '$user_id'::uuid, '$character_id'::uuid, 1,
    false, 'vanguard', true, 'aetherist',
    '00000000-0000-4000-8000-000000003202'::uuid,
    'sha256:p32-unmastered'
  );" >/tmp/p32-unmastered.out 2>/tmp/p32-unmastered.err; then
  echo 'Expected unmastered Secondary to fail.' >&2
  exit 1
fi
grep -Fq 'SECONDARY_DISCIPLINE_NOT_MASTERED' /tmp/p32-unmastered.err

mastery="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select discipline_id || '|' || mastered_definition_version::text || '|' || replayed::text
  from public.record_character_discipline_mastery_v1(
    '$character_id'::uuid, 'aetherist', 'system', 'p32.database-proof'
  );")"
test "$mastery" = 'aetherist|1|false'
mastery_replay="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select discipline_id || '|' || mastered_definition_version::text || '|' || replayed::text
  from public.record_character_discipline_mastery_v1(
    '$character_id'::uuid, 'aetherist', 'system', 'p32.database-proof-retry'
  );")"
test "$mastery_replay" = 'aetherist|1|true'

catalog="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text || '|' || count(*) filter (where mastered_at is not null)::text || '|' || bool_and(enabled_for_secondary)::text
  from public.get_character_discipline_catalog_v2('$user_id'::uuid, '$character_id'::uuid);")"
test "$catalog" = '6|1|true'

secondary_change="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || primary_discipline_id || '|' || secondary_discipline_id || '|' ||
    (primary_attunement_locked_until is null)::text || '|' ||
    round(extract(epoch from (secondary_attunement_locked_until - server_now)))::integer::text || '|' || replayed::text
  from public.change_character_disciplines_v2(
    '$user_id'::uuid, '$character_id'::uuid, 1,
    false, 'vanguard', true, 'aetherist',
    '00000000-0000-4000-8000-000000003203'::uuid,
    'sha256:p32-secondary'
  );")"
test "$secondary_change" = '2|vanguard|aetherist|true|14400|false'

secondary_lock="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select secondary_attunement_locked_until::text
  from app_private.character_active_builds
  where character_id = '$character_id'::uuid;")"
test -n "$secondary_lock"

primary_change="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || primary_discipline_id || '|' || secondary_discipline_id || '|' ||
    round(extract(epoch from (primary_attunement_locked_until - server_now)))::integer::text || '|' ||
    (secondary_attunement_locked_until = '$secondary_lock'::timestamptz)::text || '|' || replayed::text
  from public.change_character_disciplines_v2(
    '$user_id'::uuid, '$character_id'::uuid, 2,
    true, 'lifebinder', false, 'aetherist',
    '00000000-0000-4000-8000-000000003204'::uuid,
    'sha256:p32-primary-independent'
  );")"
test "$primary_change" = '3|lifebinder|aetherist|14400|true|false'

attributes_after="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select might::text || '|' || finesse::text || '|' || vitality::text || '|' || agility::text || '|' || intellect::text || '|' || resolve::text
  from public.characters where id = '$character_id'::uuid;")"
test "$attributes_after" = "$attributes_before"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.change_character_disciplines_v2(
    '$user_id'::uuid, '$character_id'::uuid, 3,
    false, 'lifebinder', true, null,
    '00000000-0000-4000-8000-000000003205'::uuid,
    'sha256:p32-secondary-locked'
  );" >/tmp/p32-secondary-lock.out 2>/tmp/p32-secondary-lock.err; then
  echo 'Expected Secondary attunement lock to reject removal.' >&2
  exit 1
fi
grep -Fq 'SECONDARY_ATTUNEMENT_LOCKED' /tmp/p32-secondary-lock.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.change_character_disciplines_v2(
    '$user_id'::uuid, '$character_id'::uuid, 3,
    true, 'farstrider', false, 'aetherist',
    '00000000-0000-4000-8000-000000003206'::uuid,
    'sha256:p32-primary-locked'
  );" >/tmp/p32-primary-lock.out 2>/tmp/p32-primary-lock.err; then
  echo 'Expected Primary attunement lock to reject a second Primary change.' >&2
  exit 1
fi
grep -Fq 'PRIMARY_ATTUNEMENT_LOCKED' /tmp/p32-primary-lock.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.change_character_disciplines_v2(
    '$user_id'::uuid, '$character_id'::uuid, 2,
    true, 'farstrider', false, 'aetherist',
    '00000000-0000-4000-8000-000000003207'::uuid,
    'sha256:p32-stale'
  );" >/tmp/p32-stale.out 2>/tmp/p32-stale.err; then
  echo 'Expected stale build version to fail before attunement evaluation.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_BUILD_VERSION_CONFLICT' /tmp/p32-stale.err

audit="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)::text || '|' || count(*) filter (where change_primary and not change_secondary)::text || '|' || count(*) filter (where change_secondary and not change_primary)::text || '|' || bool_and(attunement_policy_version = 1)::text
  from app_private.character_build_change_audit
  where character_id = '$character_id'::uuid;")"
test "$audit" = '2|1|1|true'

combined_email="p32-combined-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
combined_user_id="$(create_test_user "$combined_email")"
combined_character_id="$(create_test_character "$combined_user_id" '00000000-0000-4000-8000-000000003208' 'P32 Combined Tester' 'p32combinedtester')"
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select * from public.record_character_discipline_mastery_v1(
    '$combined_character_id'::uuid, 'lifebinder', 'system', 'p32.combined-proof'
  );" >/dev/null

combined="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || primary_discipline_id || '|' || secondary_discipline_id || '|' ||
    round(extract(epoch from (primary_attunement_locked_until - server_now)))::integer::text || '|' ||
    round(extract(epoch from (secondary_attunement_locked_until - server_now)))::integer::text || '|' || replayed::text
  from public.change_character_disciplines_v2(
    '$combined_user_id'::uuid, '$combined_character_id'::uuid, 1,
    true, 'aetherist', true, 'lifebinder',
    '00000000-0000-4000-8000-000000003209'::uuid,
    'sha256:p32-combined'
  );")"
test "$combined" = '2|aetherist|lifebinder|14400|14400|false'

combined_replay="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || primary_discipline_id || '|' || secondary_discipline_id || '|' || replayed::text
  from public.change_character_disciplines_v2(
    '$combined_user_id'::uuid, '$combined_character_id'::uuid, 1,
    true, 'aetherist', true, 'lifebinder',
    '00000000-0000-4000-8000-000000003209'::uuid,
    'sha256:p32-combined'
  );")"
test "$combined_replay" = '2|aetherist|lifebinder|true'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.change_character_disciplines_v2(
    '$combined_user_id'::uuid, '$combined_character_id'::uuid, 1,
    true, 'aetherist', true, 'lifebinder',
    '00000000-0000-4000-8000-000000003209'::uuid,
    'sha256:p32-combined-different'
  );" >/tmp/p32-idempotency.out 2>/tmp/p32-idempotency.err; then
  echo 'Expected conflicting idempotency fingerprint to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_BUILD_IDEMPOTENCY_CONFLICT' /tmp/p32-idempotency.err

legacy_email="p32-legacy-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
legacy_user_id="$(create_test_user "$legacy_email")"
legacy_character_id="$(create_test_character "$legacy_user_id" '00000000-0000-4000-8000-000000003210' 'P32 Legacy Tester' 'p32legacytester')"
legacy="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || primary_discipline_id || '|' || replayed::text
  from public.change_character_primary_discipline_v1(
    '$legacy_user_id'::uuid,
    '$legacy_character_id'::uuid,
    1,
    'aetherist',
    '00000000-0000-4000-8000-000000003211'::uuid,
    'sha256:p32-legacy-wrapper'
  );")"
test "$legacy" = '2|aetherist|false'
legacy_lock="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select (primary_attunement_locked_until > server_now)::text
  from public.get_character_active_build_v2('$legacy_user_id'::uuid, '$legacy_character_id'::uuid);")"
test "$legacy_lock" = 'true'

for statement in \
  "select * from public.get_character_discipline_catalog_v2('$user_id'::uuid, '$character_id'::uuid)" \
  "select * from public.get_character_active_build_v2('$user_id'::uuid, '$character_id'::uuid)" \
  "select * from public.record_character_discipline_mastery_v1('$character_id'::uuid, 'lifebinder', 'system', 'browser')" \
  "select * from public.change_character_disciplines_v2('$user_id'::uuid, '$character_id'::uuid, 3, false, 'lifebinder', true, null, '00000000-0000-4000-8000-000000003212'::uuid, 'sha256:p32-browser')"; do
  if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "set role authenticated; $statement;" >/tmp/p32-browser.out 2>/tmp/p32-browser.err; then
    echo "Authenticated browser role unexpectedly executed server-only build authority: $statement" >&2
    exit 1
  fi
done

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from app_private.character_discipline_masteries;" >/tmp/p32-browser-private.out 2>/tmp/p32-browser-private.err; then
  echo 'Authenticated browser role unexpectedly read private Discipline mastery facts.' >&2
  exit 1
fi
