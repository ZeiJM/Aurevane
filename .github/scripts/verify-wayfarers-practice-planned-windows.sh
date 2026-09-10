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

# No explicit plan means no passive entitlement and no report.
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

# A new plan replaces the active plan and restarts the server-authored timer.
overnight_key='00000000-0000-4000-8000-000000001653'
overnight_plan="$(set_plan overnight "$overnight_key" 'a2:plan:overnight')"
test "$overnight_plan" = 'overnight|1|28800|false'

plan_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select planned_window || '|' || planned_window_config_version::text || '|' || planned_window_seconds::text
  from app_private.wayfarers_practice_state
  where character_id = '$character_id'::uuid;")"
test "$plan_state" = 'overnight|1|28800'

# Overnight completes at exactly its authored 8-hour duration and uses the configured 7 XP/hour rate.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.wayfarers_practice_state
  set plan_set_at = clock_timestamp() - interval '9 hours', updated_at = clock_timestamp()
  where character_id = '$character_id'::uuid;"

overnight_report="$(materialize)"
IFS='|' read -r overnight_report_id overnight_source overnight_window overnight_version overnight_seconds overnight_planned overnight_balanced overnight_elapsed overnight_direct overnight_xp overnight_rested overnight_status <<<"$overnight_report"
test -n "$overnight_report_id"
test "$overnight_source" = 'passive_training'
test "$overnight_window" = 'overnight'
test "$overnight_version" = '1'
test "$overnight_seconds" = '28800'
test "$overnight_planned" = '28800'
test "$overnight_balanced" = '0'
test "$overnight_elapsed" = '28800'
test "$overnight_direct" = '28800'
test "$overnight_xp" = '56'
test "$overnight_rested" = '0'
test "$overnight_status" = 'pending'
test "$(materialize)" = "$overnight_report"

overnight_claim="$(claim_report "$overnight_report_id" '00000000-0000-4000-8000-000000001654' 'a2:claim:overnight')"
overnight_claim_replay="$(claim_report "$overnight_report_id" '00000000-0000-4000-8000-000000001654' 'a2:claim:overnight')"
IFS='|' read -r overnight_claim_id overnight_requested overnight_applied overnight_replayed <<<"$overnight_claim"
IFS='|' read -r overnight_replay_id overnight_replay_requested overnight_replay_applied overnight_replay_replayed <<<"$overnight_claim_replay"
test "$overnight_claim_id" = "$overnight_report_id"
test "$overnight_requested" = '56'
test "$overnight_applied" = '56'
test "$overnight_replayed" = 'false'
test "$overnight_replay_id" = "$overnight_report_id"
test "$overnight_replay_requested" = '56'
test "$overnight_replay_applied" = '56'
test "$overnight_replay_replayed" = 'true'

# Extended caps at its authored 24 hours; excess real time is not rewarded.
extended_plan="$(set_plan extended '00000000-0000-4000-8000-000000001655' 'a2:plan:extended')"
test "$extended_plan" = 'extended|1|86400|false'
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.wayfarers_practice_state
  set plan_set_at = clock_timestamp() - interval '30 hours', updated_at = clock_timestamp()
  where character_id = '$character_id'::uuid;"

extended_report="$(materialize)"
IFS='|' read -r extended_report_id extended_source extended_window extended_version extended_seconds extended_planned extended_balanced extended_elapsed extended_direct extended_xp extended_rested extended_status <<<"$extended_report"
test -n "$extended_report_id"
test "$extended_source" = 'passive_training'
test "$extended_window" = 'extended'
test "$extended_version" = '1'
test "$extended_seconds" = '86400'
test "$extended_planned" = '86400'
test "$extended_balanced" = '0'
test "$extended_elapsed" = '86400'
test "$extended_direct" = '86400'
test "$extended_xp" = '96'
test "$extended_rested" = '0'
test "$extended_status" = 'pending'

extended_claim="$(claim_report "$extended_report_id" '00000000-0000-4000-8000-000000001656' 'a2:claim:extended')"
IFS='|' read -r extended_claim_id extended_requested extended_applied extended_replayed <<<"$extended_claim"
test "$extended_claim_id" = "$extended_report_id"
test "$extended_requested" = '96'
test "$extended_applied" = '96'
test "$extended_replayed" = 'false'

# Early Stop Training freezes only elapsed server time into one normal pending report.
short_partial="$(set_plan short '00000000-0000-4000-8000-000000001657' 'a2:plan:partial')"
test "$short_partial" = 'short|1|10800|false'
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.wayfarers_practice_state
  set plan_set_at = clock_timestamp() - interval '90 minutes', updated_at = clock_timestamp()
  where character_id = '$character_id'::uuid;"

stop_result="$(stop_training)"
test "$stop_result" = 'true'
partial_report="$(materialize)"
IFS='|' read -r partial_report_id partial_source partial_window partial_version partial_seconds partial_planned partial_balanced partial_elapsed partial_direct partial_xp partial_rested partial_status <<<"$partial_report"
test -n "$partial_report_id"
test "$partial_source" = 'passive_training'
test "$partial_window" = 'short'
test "$partial_version" = '1'
test "$partial_seconds" = '10800'
test "$partial_planned" -ge '5400'
test "$partial_planned" -le '5415'
test "$partial_balanced" = '0'
test "$partial_elapsed" = "$partial_planned"
test "$partial_direct" = "$partial_planned"
expected_partial_xp=$((partial_planned * 10 / 3600))
test "$partial_xp" = "$expected_partial_xp"
test "$partial_rested" = '0'
test "$partial_status" = 'pending'

after_stop_plan="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select coalesce(planned_window, '') || '|' || coalesce(plan_set_at::text, '')
  from app_private.wayfarers_practice_state
  where character_id = '$character_id'::uuid;")"
test "$after_stop_plan" = '|'

partial_claim="$(claim_report "$partial_report_id" '00000000-0000-4000-8000-000000001658' 'a2:claim:partial')"
partial_claim_replay="$(claim_report "$partial_report_id" '00000000-0000-4000-8000-000000001658' 'a2:claim:partial')"
IFS='|' read -r partial_claim_id partial_requested partial_applied partial_replayed <<<"$partial_claim"
IFS='|' read -r partial_replay_id partial_replay_requested partial_replay_applied partial_replay_replayed <<<"$partial_claim_replay"
test "$partial_claim_id" = "$partial_report_id"
test "$partial_requested" = "$expected_partial_xp"
test "$partial_applied" = "$expected_partial_xp"
test "$partial_replayed" = 'false'
test "$partial_replay_id" = "$partial_report_id"
test "$partial_replay_requested" = "$expected_partial_xp"
test "$partial_replay_applied" = "$expected_partial_xp"
test "$partial_replay_replayed" = 'true'

# No active plan means stop is a no-op and materialization produces no extra report.
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
