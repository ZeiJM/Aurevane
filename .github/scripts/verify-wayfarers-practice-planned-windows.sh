#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='A2-passive-training-2026!'
email="a2-passive-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

signup="$(signup_test_user "$email" "$password")"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$user_id"

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select id::text
  from public.create_character_v3(
    '$user_id'::uuid,
    0::smallint,
    '00000000-0000-4000-8000-000000001651'::uuid,
    'a2:passive:create',
    1,
    'Passive Wayfarer',
    'passivewayfarer',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    12, 4, 7, 4, 3, 6
  );")"
test -n "$character_id"

materialize() {
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      report_id::text || '|' || practice_source || '|' || coalesce(planned_window, '') || '|' ||
      coalesce(planned_window_config_version::text, '') || '|' || coalesce(planned_window_seconds::text, '') || '|' ||
      planned_elapsed_seconds::text || '|' || balanced_fallback_seconds::text || '|' || elapsed_seconds::text || '|' ||
      credited_direct_seconds::text || '|' || requested_character_xp::text || '|' || rested_momentum_gain::text || '|' || status
    from public.materialize_training_report_v2('$user_id'::uuid, '$character_id'::uuid);"
}

set_plan() {
  local window="$1"
  local key="$2"
  local fingerprint="$3"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select planned_window || '|' || planned_window_config_version::text || '|' || planned_window_seconds::text || '|' || replayed::text
    from public.set_wayfarers_practice_plan_v1(
      'user:$user_id',
      'wayfarers_practice.set_plan.v1',
      '$key'::uuid,
      '$fingerprint',
      '$user_id'::uuid,
      '$character_id'::uuid,
      '$window'
    );"
}

claim_report() {
  local report_id="$1"
  local key="$2"
  local fingerprint="$3"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select report_id::text || '|' || requested_character_xp::text || '|' || applied_character_xp::text || '|' || replayed::text
    from public.claim_training_report_v1(
      'user:$user_id',
      'wayfarers_practice.claim.v1',
      '$key'::uuid,
      '$fingerprint',
      '$user_id'::uuid,
      '$character_id'::uuid,
      '$report_id'::uuid
    );"
}

stop_training() {
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select stopped::text from public.stop_passive_training_v1('$user_id'::uuid, '$character_id'::uuid);"
}

age_plan() {
  local interval_value="$1"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    update app_private.wayfarers_practice_state
    set plan_set_at = clock_timestamp() - interval '$interval_value', updated_at = clock_timestamp()
    where character_id = '$character_id'::uuid;"
}

assert_completed_report() {
  local row="$1"
  local expected_window="$2"
  local expected_seconds="$3"
  local expected_xp="$4"

  IFS='|' read -r report_id source window version seconds planned balanced elapsed direct xp rested status <<<"$row"
  test -n "$report_id"
  test "$source" = 'passive_training'
  test "$window" = "$expected_window"
  test "$version" = '1'
  test "$seconds" = "$expected_seconds"
  test "$planned" = "$expected_seconds"
  test "$balanced" = '0'
  test "$elapsed" = "$expected_seconds"
  test "$direct" = "$expected_seconds"
  test "$xp" = "$expected_xp"
  test "$rested" = '0'
  test "$status" = 'pending'
}

window_config="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select short_seconds::text || '|' || overnight_seconds::text || '|' || extended_seconds::text
  from app_private.wayfarers_practice_window_configs
  order by version desc
  limit 1;")"
test "$window_config" = '10800|28800|86400'

rate_config="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select short_xp_per_hour::text || '|' || medium_xp_per_hour::text || '|' || extended_xp_per_hour::text
  from app_private.passive_training_rate_configs
  order by version desc
  limit 1;")"
test "$rate_config" = '10|7|4'

# Without an explicit plan, absence or browser inactivity cannot manufacture rewards.
test -z "$(materialize)"

# Short is a 3-hour plan. Selection is idempotent and conflicting fingerprints fail closed.
short_key='00000000-0000-4000-8000-000000001652'
short_plan="$(set_plan short "$short_key" 'a2:plan:short')"
short_plan_replay="$(set_plan short "$short_key" 'a2:plan:short')"
test "$short_plan" = 'short|1|10800|false'
test "$short_plan_replay" = 'short|1|10800|true'

if set_plan short "$short_key" 'a2:plan:conflict' >/tmp/a2-plan-conflict.out 2>/tmp/a2-plan-conflict.err; then
  echo 'Expected conflicting plan idempotency fingerprint to fail.' >&2
  exit 1
fi
grep -Fq 'idempotency key reused' /tmp/a2-plan-conflict.err

# Retired window names are rejected by the current authority contract.
if set_plan medium '00000000-0000-4000-8000-000000001660' 'a2:plan:retired-medium' \
  >/tmp/a2-plan-retired.out 2>/tmp/a2-plan-retired.err; then
  echo 'Expected retired Passive Training window name to fail.' >&2
  exit 1
fi
grep -Fq 'Passive Training plan authority is invalid' /tmp/a2-plan-retired.err

# An active plan cannot be silently replaced; the player must complete or stop it first.
if set_plan overnight '00000000-0000-4000-8000-000000001662' 'a2:plan:active-replace' \
  >/tmp/a2-plan-active.out 2>/tmp/a2-plan-active.err; then
  echo 'Expected active Passive Training replacement to fail.' >&2
  exit 1
fi
grep -Fq 'PASSIVE_TRAINING_ACTIVE' /tmp/a2-plan-active.err

# Complete the short plan so the next plan starts from a clean authoritative state.
age_plan '4 hours'
short_report="$(materialize)"
assert_completed_report "$short_report" short 10800 30
short_report_id="${short_report%%|*}"
short_claim="$(claim_report "$short_report_id" '00000000-0000-4000-8000-000000001663' 'a2:claim:short')"
test "$short_claim" = "$short_report_id|30|30|false"

# Overnight completes at exactly its authored 8-hour duration and uses 7 XP/hour.
overnight_plan="$(set_plan overnight '00000000-0000-4000-8000-000000001653' 'a2:plan:overnight')"
test "$overnight_plan" = 'overnight|1|28800|false'
age_plan '9 hours'
overnight_report="$(materialize)"
assert_completed_report "$overnight_report" overnight 28800 56
overnight_report_id="${overnight_report%%|*}"
overnight_claim="$(claim_report "$overnight_report_id" '00000000-0000-4000-8000-000000001654' 'a2:claim:overnight')"
overnight_claim_replay="$(claim_report "$overnight_report_id" '00000000-0000-4000-8000-000000001654' 'a2:claim:overnight')"
test "$overnight_claim" = "$overnight_report_id|56|56|false"
test "$overnight_claim_replay" = "$overnight_report_id|56|56|true"

# Extended caps at its authored 24 hours; excess real time is not rewarded.
extended_plan="$(set_plan extended '00000000-0000-4000-8000-000000001655' 'a2:plan:extended')"
test "$extended_plan" = 'extended|1|86400|false'
age_plan '30 hours'
extended_report="$(materialize)"
assert_completed_report "$extended_report" extended 86400 96
extended_report_id="${extended_report%%|*}"
extended_claim="$(claim_report "$extended_report_id" '00000000-0000-4000-8000-000000001656' 'a2:claim:extended')"
test "$extended_claim" = "$extended_report_id|96|96|false"

# Early Stop Training freezes only elapsed server time into one proportional pending report.
partial_plan="$(set_plan short '00000000-0000-4000-8000-000000001657' 'a2:plan:partial')"
test "$partial_plan" = 'short|1|10800|false'
age_plan '90 minutes'
test "$(stop_training)" = 'true'
partial_report="$(materialize)"
IFS='|' read -r partial_report_id partial_source partial_window partial_version partial_seconds partial_planned partial_balanced partial_elapsed partial_direct partial_xp partial_rested partial_status <<<"$partial_report"
test -n "$partial_report_id"
test "$partial_source" = 'passive_training'
test "$partial_window" = 'short'
test "$partial_version" = '1'
test "$partial_seconds" = '10800'
test "$partial_planned" -ge 5400
test "$partial_planned" -le 5415
test "$partial_balanced" = '0'
test "$partial_elapsed" = "$partial_planned"
test "$partial_direct" = "$partial_planned"
expected_partial_xp=$((partial_planned * 10 / 3600))
test "$partial_xp" = "$expected_partial_xp"
test "$partial_rested" = '0'
test "$partial_status" = 'pending'

state_after_stop="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select coalesce(planned_window, '') || '|' || coalesce(plan_set_at::text, '')
  from app_private.wayfarers_practice_state
  where character_id = '$character_id'::uuid;")"
test "$state_after_stop" = '|'

partial_claim="$(claim_report "$partial_report_id" '00000000-0000-4000-8000-000000001658' 'a2:claim:partial')"
partial_claim_replay="$(claim_report "$partial_report_id" '00000000-0000-4000-8000-000000001658' 'a2:claim:partial')"
test "$partial_claim" = "$partial_report_id|$expected_partial_xp|$expected_partial_xp|false"
test "$partial_claim_replay" = "$partial_report_id|$expected_partial_xp|$expected_partial_xp|true"

# No active plan means Stop Training is a no-op and no extra report appears.
test "$(stop_training)" = 'false'
test -z "$(materialize)"

# Cross-account access remains unavailable even through the privileged server RPC.
other_signup="$(signup_test_user "a2-passive-other-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com" "$password")"
other_user="$(printf '%s' "$other_signup" | jq -r '.user.id')"
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select * from public.set_wayfarers_practice_plan_v1(
    'user:$other_user',
    'wayfarers_practice.set_plan.v1',
    '00000000-0000-4000-8000-000000001659'::uuid,
    'a2:other',
    '$other_user'::uuid,
    '$character_id'::uuid,
    'short'
  );" >/tmp/a2-passive-other.out 2>/tmp/a2-passive-other.err; then
  echo 'Expected cross-account plan selection to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_NOT_FOUND' /tmp/a2-passive-other.err

# Browser roles cannot invoke plan authority directly.
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.set_wayfarers_practice_plan_v1(
    'user:$user_id',
    'wayfarers_practice.set_plan.v1',
    '00000000-0000-4000-8000-000000001661'::uuid,
    'a2:browser',
    '$user_id'::uuid,
    '$character_id'::uuid,
    'short'
  );" >/tmp/a2-passive-browser.out 2>/tmp/a2-passive-browser.err; then
  echo 'Authenticated browser role unexpectedly executed Passive Training plan authority.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/a2-passive-browser.err

printf '%s\n' 'Passive Training planned windows authority verified.'
