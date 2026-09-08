#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='attribute-allocation-2026!'
email="attribute-allocation-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
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
    '10000000-0000-4000-8000-000000000001'::uuid,
    'attribute-allocation:create',
    1,
    'Attribute Tester',
    'attributetester',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'aetherist',
    6, 6, 6, 6, 6, 6
  );")"
test -n "$character_id"

read_allocation() {
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select level::text || '|' || point_pool::text || '|' || spent_points::text || '|' ||
      unspent_points::text || '|' || reset_used::text || '|' || reset_remaining::text || '|' ||
      coalesce(reset_window_started_at::text, '') || '|' || coalesce(reset_renews_at::text, '')
    from public.get_character_attribute_allocation_v1('$user_id'::uuid, '$character_id'::uuid);"
}

commit_allocation() {
  local mode="$1"
  local might="$2"
  local finesse="$3"
  local vitality="$4"
  local agility="$5"
  local intellect="$6"
  local resolve="$7"
  local key="$8"
  local fingerprint="$9"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      might::text || '|' || finesse::text || '|' || vitality::text || '|' || agility::text || '|' ||
      intellect::text || '|' || resolve::text || '|' || unspent_points::text || '|' ||
      reset_used::text || '|' || reset_remaining::text || '|' || replayed::text
    from public.commit_character_attribute_allocation_v1(
      '$user_id'::uuid,
      '$character_id'::uuid,
      '$mode',
      $might, $finesse, $vitality, $agility, $intellect, $resolve,
      '$key'::uuid,
      '$fingerprint'
    );"
}

initial="$(read_allocation)"
IFS='|' read -r initial_level initial_pool initial_spent initial_unspent initial_used initial_remaining initial_start initial_renews <<<"$initial"
test "$initial_level" = '1'
test "$initial_pool" = '36'
test "$initial_spent" = '36'
test "$initial_unspent" = '0'
test "$initial_used" = '0'
test "$initial_remaining" = '5'
test -z "$initial_start"
test -z "$initial_renews"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select applied_amount
  from public.grant_character_xp_v1(
    '$character_id'::uuid,
    '10000000-0000-4000-8000-000000000002'::uuid,
    'attribute-allocation:level-two',
    'system:ci-attribute-allocation',
    'system',
    'ci.attribute-allocation',
    'attribute-allocation.level',
    100::bigint
  );" >/dev/null

level_two="$(read_allocation)"
IFS='|' read -r level_two_level level_two_pool level_two_spent level_two_unspent _ _ _ _ <<<"$level_two"
test "$level_two_level" = '2'
test "$level_two_pool" = '37'
test "$level_two_spent" = '36'
test "$level_two_unspent" = '1'

spend="$(commit_allocation spend 6 6 6 6 7 6 '10000000-0000-4000-8000-000000000003' 'attribute-allocation:spend-one')"
IFS='|' read -r _ _ _ _ spend_intellect _ spend_unspent spend_used spend_remaining spend_replayed <<<"$spend"
test "$spend_intellect" = '7'
test "$spend_unspent" = '0'
test "$spend_used" = '0'
test "$spend_remaining" = '5'
test "$spend_replayed" = 'false'

spend_replay="$(commit_allocation spend 6 6 6 6 7 6 '10000000-0000-4000-8000-000000000003' 'attribute-allocation:spend-one')"
test "${spend_replay##*|}" = 'true'

if commit_allocation spend 5 6 6 6 8 6 '10000000-0000-4000-8000-000000000004' 'attribute-allocation:illegal-reduce' >/tmp/attribute-illegal.out 2>/tmp/attribute-illegal.err; then
  echo 'Expected ordinary attribute spending to reject reductions.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_ATTRIBUTE_SPEND_CANNOT_REDUCE' /tmp/attribute-illegal.err

reset_one="$(commit_allocation reset 1 1 1 1 32 1 '10000000-0000-4000-8000-000000000005' 'attribute-allocation:reset-1')"
IFS='|' read -r reset_might _ _ _ reset_intellect _ reset_unspent reset_used reset_remaining _ <<<"$reset_one"
test "$reset_might" = '1'
test "$reset_intellect" = '32'
test "$reset_unspent" = '0'
test "$reset_used" = '1'
test "$reset_remaining" = '4'

commit_allocation reset 1 1 1 1 31 2 '10000000-0000-4000-8000-000000000006' 'attribute-allocation:reset-2' >/dev/null
commit_allocation reset 1 1 1 1 30 3 '10000000-0000-4000-8000-000000000007' 'attribute-allocation:reset-3' >/dev/null
commit_allocation reset 1 1 1 1 29 4 '10000000-0000-4000-8000-000000000008' 'attribute-allocation:reset-4' >/dev/null
reset_five="$(commit_allocation reset 1 1 1 1 28 5 '10000000-0000-4000-8000-000000000009' 'attribute-allocation:reset-5')"
IFS='|' read -r _ _ _ _ _ _ _ reset_five_used reset_five_remaining _ <<<"$reset_five"
test "$reset_five_used" = '5'
test "$reset_five_remaining" = '0'

if commit_allocation reset 1 1 1 1 27 6 '10000000-0000-4000-8000-000000000010' 'attribute-allocation:reset-6' >/tmp/attribute-limit.out 2>/tmp/attribute-limit.err; then
  echo 'Expected the sixth reset in one window to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_ATTRIBUTE_RESET_LIMIT_REACHED' /tmp/attribute-limit.err

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.character_attribute_reset_windows
  set window_started_at = clock_timestamp() - interval '31 days', updated_at = clock_timestamp()
  where character_id = '$character_id'::uuid;" >/dev/null

renewed="$(commit_allocation reset 1 1 1 1 26 7 '10000000-0000-4000-8000-000000000011' 'attribute-allocation:reset-renewed')"
IFS='|' read -r _ _ _ _ _ _ _ renewed_used renewed_remaining _ <<<"$renewed"
test "$renewed_used" = '1'
test "$renewed_remaining" = '4'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.get_character_attribute_allocation_v1('$user_id'::uuid, '$character_id'::uuid);"; then
  echo 'Authenticated browser role unexpectedly read the attribute allocation RPC.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.commit_character_attribute_allocation_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    'reset',
    1, 1, 1, 1, 25, 8,
    '10000000-0000-4000-8000-000000000012'::uuid,
    'attribute-allocation:forged-browser'
  );"; then
  echo 'Authenticated browser role unexpectedly committed an attribute allocation.' >&2
  exit 1
fi

echo 'Character attribute allocation authority verified.'
