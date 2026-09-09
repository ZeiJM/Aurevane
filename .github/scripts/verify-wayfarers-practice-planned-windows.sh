#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

api_url="$TEST_AUTH_API_URL"
server_key="$TEST_AUTH_ADMIN_KEY"
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

# No plan means there is no report and no passive entitlement.
test -z "$(materialize)"

# The short plan snapshots its authored duration and is idempotent.
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

# An active plan can be replaced; the server restarts its clock with the new authored snapshot.
medium_key='00000000-0000-4000-8000-000000001653'
medium_plan="$(set_plan medium "$medium_key" 'a2:plan:medium')"
test "$medium_plan" = 'medium|1|21600|false'

plan_state="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select planned_window || '|' || planned_window_config_version::text || '|' || planned_window_seconds::text
  from app_private.wayfarers_practice_state
  where character_id = '$character_id'::uuid;")"
test "$plan_state" = 'medium|1|21600'

# Completion uses the frozen planned duration, not the current config row.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.wayfarers_practice_state
  set plan_set_at = clock_timestamp() - interval '7 hours', updated_at = clock_timestamp()
  where character_id = '$character_id'::uuid;
  update app_private.passive_training_rate_configs
  set seconds_per_xp = 1200
  where version = 1;"

medium_report="$(materialize)"
IFS='|' read -r medium_report_id medium_source medium_window medium_version medium_seconds medium_planned medium_balanced medium_elapsed medium_direct medium_xp medium_rested medium_status <<<"$medium_report"
test -n "$medium_report_id"
test "$medium_source" = 'passive_training'
test "$medium_window" = 'medium'
test "$medium_version" = '1'
test "$medium_seconds" = '21600'
test "$medium_planned" = '21600'
test "$medium_balanced" = '0'
test "$medium_elapsed" = '21600'
test "$medium_direct" = '21600'
test "$medium_xp" = '18'
test "$medium_rested" = '0'
test "$medium_status" = 'pending'
test "$(materialize)" = "$medium_report"

# The report captures the versioned rate and survives later config mutation.
report_snapshot="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    practice_rate_config_version::text || '|' ||
    planned_window_config_version::text || '|' ||
    planned_window_seconds::text || '|' ||
    direct_credit_cap_seconds::text
  from app_private.training_reports where id = '$medium_report_id'::uuid;")"
test "$report_snapshot" = '1|1|21600|21600'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.passive_training_rate_configs set seconds_per_xp = 9999 where version = 1;"
test "$(materialize)" = "$medium_report"

medium_claim="$(claim_report "$medium_report_id" '00000000-0000-4000-8000-000000001654' 'a2:claim:medium')"
medium_claim_replay="$(claim_report "$medium_report_id" '00000000-0000-4000-8000-000000001654' 'a2:claim:medium')"
IFS='|' read -r medium_claim_id medium_requested medium_applied medium_replayed <<<"$medium_claim"
IFS='|' read -r medium_replay_id medium_replay_requested medium_replay_applied medium_replay_replayed <<<"$medium_claim_replay"
test "$medium_claim_id" = "$medium_report_id"
test "$medium_requested" = '18'
test "$medium_applied" = '18'
test "$medium_replayed" = 'false'
test "$medium_replay_id" = "$medium_report_id"
test "$medium_replay_requested" = '18'
test "$medium_replay_applied" = '18'
test "$medium_replay_replayed" = 'true'

# Restore the authored rate before the next plan so the next report has an obvious expected value.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.passive_training_rate_configs set seconds_per_xp = 360 where version = 1;"

# The long plan stops exactly at its 12-hour authored cap; extra real time is not rewarded.
long_plan="$(set_plan long '00000000-0000-4000-8000-000000001655' 'a2:plan:long')"
test "$long_plan" = 'long|1|43200|false'
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.wayfarers_practice_state
  set plan_set_at = clock_timestamp() - interval '20 hours', updated_at = clock_timestamp()
  where character_id = '$character_id'::uuid;"

long_report="$(materialize)"
IFS='|' read -r long_report_id long_source long_window long_version long_seconds long_planned long_balanced long_elapsed long_direct long_xp long_rested long_status <<<"$long_report"
test "$long_source" = 'passive_training'
test "$long_window" = 'long'
test "$long_version" = '1'
test "$long_seconds" = '43200'
test "$long_planned" = '43200'
test "$long_balanced" = '0'
test "$long_elapsed" = '43200'
test "$long_direct" = '43200'
test "$long_xp" = '120'
test "$long_rested" = '0'
test "$long_status" = 'pending'

long_claim="$(claim_report "$long_report_id" '00000000-0000-4000-8000-000000001656' 'a2:claim:long')"
IFS='|' read -r long_claim_id long_requested long_applied long_replayed <<<"$long_claim"
test "$long_claim_id" = "$long_report_id"
test "$long_requested" = '120'
test "$long_applied" = '120'
test "$long_replayed" = 'false'

# Partial Stop Training materializes the elapsed slice, clears the plan, and remains claim-once.
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
test "$partial_planned" -ge '5390'
test "$partial_planned" -le '5410'
test "$partial_balanced" = '0'
test "$partial_elapsed" = "$partial_planned"
test "$partial_direct" = "$partial_planned"
test "$partial_xp" = '15'
test "$partial_rested" = '0'
test "$partial_status" = 'pending'

after_stop_plan="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select coalesce(planned_window, '') || '|' || coalesce(plan_set_at::text, '')
  from app_private.wayfarers_practice_state where character_id = '$character_id'::uuid;")"
test "$after_stop_plan" = '|'

partial_claim="$(claim_report "$partial_report_id" '00000000-0000-4000-8000-000000001658' 'a2:claim:partial')"
partial_claim_replay="$(claim_report "$partial_report_id" '00000000-0000-4000-8000-000000001658' 'a2:claim:partial')"
IFS='|' read -r partial_claim_id partial_requested partial_applied partial_replayed <<<"$partial_claim"
IFS='|' read -r partial_replay_id partial_replay_requested partial_replay_applied partial_replay_replayed <<<"$partial_claim_replay"
test "$partial_claim_id" = "$partial_report_id"
test "$partial_requested" = '15'
test "$partial_applied" = '15'
test "$partial_replayed" = 'false'
test "$partial_replay_id" = "$partial_report_id"
test "$partial_replay_requested" = '15'
test "$partial_replay_applied" = '15'
test "$partial_replay_replayed" = 'true'

# No active plan means stop is a no-op and creates no extra report.
test "$(stop_training)" = 'false'
test -z "$(materialize)"

# Cross-account access still fails closed.
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

printf '%s\n' 'Passive Training planned windows authority verified.'
