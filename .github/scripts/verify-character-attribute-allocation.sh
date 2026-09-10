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

create_aetherist() {
  local slot_index="$1"
  local idempotency_key="$2"
  local fingerprint="$3"
  local name="$4"
  local name_key="$5"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select id::text
    from public.create_character_v3(
      '$user_id'::uuid,
      '$slot_index'::smallint,
      '$idempotency_key'::uuid,
      '$fingerprint',
      1,
      '$name',
      '$name_key',
      'androgynous',
      'they_them',
      'portrait.starter.wayfarer-01',
      'appearance.starter.roadworn',
      'aetherist',
      2, 3, 4, 3, 15, 9
    );"
}

read_allocation() {
  local character_id="$1"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      level::text || '|' || point_pool::text || '|' || spent_points::text || '|' ||
      unspent_points::text || '|' || personal_point_pool::text || '|' || personal_spent_points::text || '|' ||
      (base_attributes = '{\"might\":2,\"finesse\":3,\"vitality\":4,\"agility\":3,\"intellect\":10,\"resolve\":9}'::jsonb)::text || '|' ||
      (cardinality(focus_attributes) = 2 and focus_attributes @> array['intellect','resolve']::text[])::text || '|' ||
      off_focus_cap::text || '|' || conversion_required::text || '|' ||
      reset_used::text || '|' || reset_remaining::text || '|' ||
      coalesce(reset_window_started_at::text, '') || '|' || coalesce(reset_renews_at::text, '')
    from public.get_character_attribute_allocation_v2('$user_id'::uuid, '$character_id'::uuid);"
}

commit_allocation() {
  local character_id="$1"
  local mode="$2"
  local might="$3"
  local finesse="$4"
  local vitality="$5"
  local agility="$6"
  local intellect="$7"
  local resolve="$8"
  local key="$9"
  local fingerprint="${10}"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      might::text || '|' || finesse::text || '|' || vitality::text || '|' || agility::text || '|' ||
      intellect::text || '|' || resolve::text || '|' || unspent_points::text || '|' ||
      personal_spent_points::text || '|' || conversion_required::text || '|' ||
      reset_used::text || '|' || reset_remaining::text || '|' || replayed::text
    from public.commit_character_attribute_allocation_v2(
      '$user_id'::uuid,
      '$character_id'::uuid,
      '$mode',
      $might, $finesse, $vitality, $agility, $intellect, $resolve,
      '$key'::uuid,
      '$fingerprint'
    );"
}

character_id="$(create_aetherist 0 '10000000-0000-4000-8000-000000000001' 'attribute-allocation:create' 'Attribute Tester' 'attributetester')"
test -n "$character_id"

initial="$(read_allocation "$character_id")"
IFS='|' read -r initial_level initial_pool initial_spent initial_unspent initial_personal_pool initial_personal_spent initial_base initial_focus initial_cap initial_conversion initial_used initial_remaining initial_start initial_renews <<<"$initial"
test "$initial_level" = '1'
test "$initial_pool" = '36'
test "$initial_spent" = '36'
test "$initial_unspent" = '0'
test "$initial_personal_pool" = '5'
test "$initial_personal_spent" = '5'
test "$initial_base" = 'true'
test "$initial_focus" = 'true'
test "$initial_cap" = '30'
test "$initial_conversion" = 'false'
test "$initial_used" = '0'
test "$initial_remaining" = '5'
test -z "$initial_start"
test -z "$initial_renews"

personal_initial="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select primary_discipline_id || '|' || primary_profile_version::text || '|' ||
    might::text || '|' || finesse::text || '|' || vitality::text || '|' || agility::text || '|' ||
    intellect::text || '|' || resolve::text || '|' || conversion_required::text
  from app_private.character_attribute_personal_allocations
  where character_id = '$character_id'::uuid;")"
test "$personal_initial" = 'aetherist|1|0|0|0|0|5|0|false'

# Simulate a pre-profile character requiring the one-time conversion. Conversion must be mandatory,
# idempotent, and free: it cannot consume one of the five 30-day resets.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_attribute_personal_allocations
  set conversion_required = true, updated_at = clock_timestamp()
  where character_id = '$character_id'::uuid;" >/dev/null

if commit_allocation "$character_id" spend 2 3 4 3 15 9 '10000000-0000-4000-8000-000000000002' 'attribute-allocation:spend-before-convert' >/tmp/attribute-conversion-required.out 2>/tmp/attribute-conversion-required.err; then
  echo 'Expected normal spending to fail while legacy conversion is required.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_ATTRIBUTE_CONVERSION_REQUIRED' /tmp/attribute-conversion-required.err

converted="$(commit_allocation "$character_id" convert 2 3 4 3 15 9 '10000000-0000-4000-8000-000000000003' 'attribute-allocation:convert')"
IFS='|' read -r _ _ _ _ converted_intellect _ converted_unspent converted_personal_spent converted_required converted_used converted_remaining converted_replayed <<<"$converted"
test "$converted_intellect" = '15'
test "$converted_unspent" = '0'
test "$converted_personal_spent" = '5'
test "$converted_required" = 'false'
test "$converted_used" = '0'
test "$converted_remaining" = '5'
test "$converted_replayed" = 'false'

converted_replay="$(commit_allocation "$character_id" convert 2 3 4 3 15 9 '10000000-0000-4000-8000-000000000003' 'attribute-allocation:convert')"
test "${converted_replay##*|}" = 'true'

if commit_allocation "$character_id" convert 2 3 4 3 15 9 '10000000-0000-4000-8000-000000000004' 'attribute-allocation:convert-again' >/tmp/attribute-conversion-not-required.out 2>/tmp/attribute-conversion-not-required.err; then
  echo 'Expected a second distinct conversion after completion to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_ATTRIBUTE_CONVERSION_NOT_REQUIRED' /tmp/attribute-conversion-not-required.err

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select applied_amount
  from public.grant_character_xp_v1(
    '$character_id'::uuid,
    '10000000-0000-4000-8000-000000000005'::uuid,
    'attribute-allocation:level-two',
    'system:ci-attribute-allocation',
    'system',
    'ci.attribute-allocation',
    'attribute-allocation.level',
    100::bigint
  );" >/dev/null

level_two="$(read_allocation "$character_id")"
IFS='|' read -r level_two_level level_two_pool level_two_spent level_two_unspent level_two_personal_pool level_two_personal_spent _ _ _ _ level_two_used level_two_remaining _ _ <<<"$level_two"
test "$level_two_level" = '2'
test "$level_two_pool" = '37'
test "$level_two_spent" = '36'
test "$level_two_unspent" = '1'
test "$level_two_personal_pool" = '6'
test "$level_two_personal_spent" = '5'
test "$level_two_used" = '0'
test "$level_two_remaining" = '5'

spend="$(commit_allocation "$character_id" spend 2 3 4 3 16 9 '10000000-0000-4000-8000-000000000006' 'attribute-allocation:spend-one')"
IFS='|' read -r _ _ _ _ spend_intellect _ spend_unspent spend_personal_spent _ spend_used spend_remaining spend_replayed <<<"$spend"
test "$spend_intellect" = '16'
test "$spend_unspent" = '0'
test "$spend_personal_spent" = '6'
test "$spend_used" = '0'
test "$spend_remaining" = '5'
test "$spend_replayed" = 'false'

spend_replay="$(commit_allocation "$character_id" spend 2 3 4 3 16 9 '10000000-0000-4000-8000-000000000006' 'attribute-allocation:spend-one')"
test "${spend_replay##*|}" = 'true'

if commit_allocation "$character_id" spend 2 3 4 3 15 10 '10000000-0000-4000-8000-000000000007' 'attribute-allocation:illegal-reduce' >/tmp/attribute-illegal-reduce.out 2>/tmp/attribute-illegal-reduce.err; then
  echo 'Expected ordinary spending to reject moving already-spent personal points.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_ATTRIBUTE_SPEND_CANNOT_REDUCE' /tmp/attribute-illegal-reduce.err

if commit_allocation "$character_id" spend 1 3 4 3 17 9 '10000000-0000-4000-8000-000000000008' 'attribute-allocation:below-base' >/tmp/attribute-below-base.out 2>/tmp/attribute-below-base.err; then
  echo 'Expected effective Core Stats below the Primary base to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_ATTRIBUTE_BELOW_PRIMARY_BASE' /tmp/attribute-below-base.err

if commit_allocation "$character_id" spend 2 3 4 3 17 9 '10000000-0000-4000-8000-000000000009' 'attribute-allocation:overspend' >/tmp/attribute-overspend.out 2>/tmp/attribute-overspend.err; then
  echo 'Expected allocation beyond the personal point pool to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_ATTRIBUTE_POINT_POOL_EXCEEDED' /tmp/attribute-overspend.err

reset_one="$(commit_allocation "$character_id" reset 8 3 4 3 10 9 '10000000-0000-4000-8000-000000000010' 'attribute-allocation:reset-1')"
IFS='|' read -r reset_might _ _ _ reset_intellect _ reset_unspent reset_personal_spent _ reset_used reset_remaining reset_replayed <<<"$reset_one"
test "$reset_might" = '8'
test "$reset_intellect" = '10'
test "$reset_unspent" = '0'
test "$reset_personal_spent" = '6'
test "$reset_used" = '1'
test "$reset_remaining" = '4'
test "$reset_replayed" = 'false'

reset_one_replay="$(commit_allocation "$character_id" reset 8 3 4 3 10 9 '10000000-0000-4000-8000-000000000010' 'attribute-allocation:reset-1')"
IFS='|' read -r _ _ _ _ _ _ _ _ _ reset_replay_used reset_replay_remaining reset_replayed <<<"$reset_one_replay"
test "$reset_replay_used" = '1'
test "$reset_replay_remaining" = '4'
test "$reset_replayed" = 'true'

commit_allocation "$character_id" reset 2 9 4 3 10 9 '10000000-0000-4000-8000-000000000011' 'attribute-allocation:reset-2' >/dev/null
commit_allocation "$character_id" reset 2 3 10 3 10 9 '10000000-0000-4000-8000-000000000012' 'attribute-allocation:reset-3' >/dev/null
commit_allocation "$character_id" reset 2 3 4 9 10 9 '10000000-0000-4000-8000-000000000013' 'attribute-allocation:reset-4' >/dev/null
reset_five="$(commit_allocation "$character_id" reset 2 3 4 3 10 15 '10000000-0000-4000-8000-000000000014' 'attribute-allocation:reset-5')"
IFS='|' read -r _ _ _ _ _ _ _ _ _ reset_five_used reset_five_remaining _ <<<"$reset_five"
test "$reset_five_used" = '5'
test "$reset_five_remaining" = '0'

if commit_allocation "$character_id" reset 2 3 4 3 16 9 '10000000-0000-4000-8000-000000000015' 'attribute-allocation:reset-6' >/tmp/attribute-limit.out 2>/tmp/attribute-limit.err; then
  echo 'Expected the sixth reset in one 30-day window to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_ATTRIBUTE_RESET_LIMIT_REACHED' /tmp/attribute-limit.err

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.character_attribute_reset_windows
  set window_started_at = clock_timestamp() - interval '31 days', updated_at = clock_timestamp()
  where character_id = '$character_id'::uuid;" >/dev/null

renewed="$(commit_allocation "$character_id" reset 2 3 4 3 16 9 '10000000-0000-4000-8000-000000000016' 'attribute-allocation:reset-renewed')"
IFS='|' read -r _ _ _ _ _ _ _ _ _ renewed_used renewed_remaining _ <<<"$renewed"
test "$renewed_used" = '1'
test "$renewed_remaining" = '4'

# A separate level-50 Aetherist proves the asymmetric cap rule: focus stats remain open while
# non-focus effective stats are capped at 30.
cap_character_id="$(create_aetherist 1 '10000000-0000-4000-8000-000000000017' 'attribute-allocation:cap-character' 'Attribute Cap Tester' 'attributecaptester')"
test -n "$cap_character_id"
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update public.characters
  set level = 50
  where id = '$cap_character_id'::uuid;" >/dev/null

if commit_allocation "$cap_character_id" reset 31 3 4 3 35 9 '10000000-0000-4000-8000-000000000018' 'attribute-allocation:off-focus-cap' >/tmp/attribute-cap.out 2>/tmp/attribute-cap.err; then
  echo 'Expected Aetherist Might 31 to exceed the off-focus Core Stat cap.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_ATTRIBUTE_DISCIPLINE_CAP_EXCEEDED' /tmp/attribute-cap.err

focus_open="$(commit_allocation "$cap_character_id" reset 2 3 4 3 64 9 '10000000-0000-4000-8000-000000000019' 'attribute-allocation:focus-open')"
IFS='|' read -r _ _ _ _ focus_intellect _ focus_unspent focus_personal_spent _ focus_used focus_remaining _ <<<"$focus_open"
test "$focus_intellect" = '64'
test "$focus_unspent" = '0'
test "$focus_personal_spent" = '54'
test "$focus_used" = '1'
test "$focus_remaining" = '4'

private_privilege="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select has_table_privilege('authenticated', 'app_private.character_attribute_personal_allocations', 'SELECT')::text;")"
test "$private_privilege" = 'false'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.get_character_attribute_allocation_v2('$user_id'::uuid, '$character_id'::uuid);"; then
  echo 'Authenticated browser role unexpectedly read the v2 attribute allocation RPC.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.commit_character_attribute_allocation_v2(
    '$user_id'::uuid,
    '$character_id'::uuid,
    'reset',
    2, 3, 4, 3, 16, 9,
    '10000000-0000-4000-8000-000000000020'::uuid,
    'attribute-allocation:forged-browser'
  );"; then
  echo 'Authenticated browser role unexpectedly committed a v2 attribute allocation.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from app_private.character_attribute_personal_allocations;"; then
  echo 'Authenticated browser role unexpectedly read private personal Core Stat ownership.' >&2
  exit 1
fi

echo 'Primary Core attribute allocation authority verified.'
