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
  from public.create_base_character_v1(
    '$user_id'::uuid,
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
    6, 6, 6, 6
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

window_config="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select version::text || '|' || short_seconds::text || '|' || overnight_seconds::text || '|' || extended_seconds::text
  from app_private.wayfarers_practice_window_configs order by version;")"
test "$window_config" = '1|10800|28800|86400'

rate_config="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select version::text || '|' || short_xp_per_hour::text || '|' || medium_xp_per_hour::text || '|' || extended_xp_per_hour::text
  from app_private.passive_training_rate_configs order by version;")"
test "$rate_config" = '1|10|7|4'

permissions="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_table_privilege('authenticated', 'app_private.passive_training_rate_configs', 'SELECT')::text || '|' ||
    has_function_privilege('authenticated', 'public.materialize_training_report_v2(uuid, uuid)', 'EXECUTE')::text || '|' ||
    has_function_privilege('authenticated', 'public.get_wayfarers_practice_status_v1(uuid, uuid)', 'EXECUTE')::text || '|' ||
    has_function_privilege('authenticated', 'public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text)', 'EXECUTE')::text || '|' ||
    has_function_privilege('authenticated', 'public.stop_passive_training_v1(uuid, uuid)', 'EXECUTE')::text || '|' ||
    has_function_privilege('service_role', 'public.materialize_training_report_v2(uuid, uuid)', 'EXECUTE')::text || '|' ||
    has_function_privilege('service_role', 'public.get_wayfarers_practice_status_v1(uuid, uuid)', 'EXECUTE')::text || '|' ||
    has_function_privilege('service_role', 'public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text)', 'EXECUTE')::text || '|' ||
    has_function_privilege('service_role', 'public.stop_passive_training_v1(uuid, uuid)', 'EXECUTE')::text;")"
test "$permissions" = 'false|false|false|false|false|true|true|true|true'

test -z "$(materialize)"

status="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select focus || '|' || config_version::text || '|' || minimum_offline_seconds::text || '|' ||
    rested_momentum_balance::text || '|' || coalesce(planned_window, '') || '|' ||
    short_window_seconds::text || '|' || overnight_window_seconds::text || '|' || extended_window_seconds::text
  from public.get_wayfarers_practice_status_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$status" = 'balanced|1|0|0||10800|28800|86400'

# A long absence by itself does not create training. The legacy activity boundaries are moved to one
# identical timestamp so their invariant remains valid.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  with boundary as (select clock_timestamp() - interval '96 hours' as at)
  update app_private.wayfarers_practice_state state
  set last_active_at = boundary.at,
      practice_claimed_through_at = boundary.at,
      updated_at = clock_timestamp()
  from boundary
  where state.character_id = '$character_id'::uuid;"
test -z "$(materialize)"

plan_key='00000000-0000-4000-8000-000000001652'
first_plan="$(set_plan overnight "$plan_key" 'a2:plan:medium')"
replay_plan="$(set_plan overnight "$plan_key" 'a2:plan:medium')"
test "$first_plan" = 'overnight|1|28800|false'
test "$replay_plan" = 'overnight|1|28800|true'

if set_plan short "$plan_key" 'a2:plan:short-conflict' >/tmp/a2-plan-conflict.out 2>/tmp/a2-plan-conflict.err; then
  echo 'Expected conflicting Passive Training idempotency reuse to fail.' >&2
  exit 1
fi
grep -Fq 'idempotency key reused' /tmp/a2-plan-conflict.err

if set_plan short '00000000-0000-4000-8000-000000001653' 'a2:plan:second-active' >/tmp/a2-plan-active.out 2>/tmp/a2-plan-active.err; then
  echo 'Expected a second active Passive Training plan to fail.' >&2
  exit 1
fi
grep -Fq 'PASSIVE_TRAINING_ACTIVE' /tmp/a2-plan-active.err

# Returning before completion creates no partial report and preserves the active plan.
test -z "$(materialize)"
plan_survived="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select planned_window from app_private.wayfarers_practice_state where character_id = '$character_id'::uuid;")"
test "$plan_survived" = 'overnight'

# Complete Medium (internal compatibility id: overnight) by moving only the authoritative plan start.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.wayfarers_practice_state
  set plan_set_at = clock_timestamp() - interval '9 hours', updated_at = clock_timestamp()
  where character_id = '$character_id'::uuid;"

completed="$(materialize)"
IFS='|' read -r report_id source window version window_seconds planned_elapsed fallback elapsed credited xp rested report_status <<<"$completed"
test -n "$report_id"
test "$source" = 'passive_training'
test "$window" = 'overnight'
test "$version" = '1'
test "$window_seconds" = '28800'
test "$planned_elapsed" = '28800'
test "$fallback" = '0'
test "$elapsed" = '28800'
test "$credited" = '28800'
test "$xp" = '56'
test "$rested" = '0'
test "$report_status" = 'pending'

test "$(materialize)" = "$completed"

claim_key='00000000-0000-4000-8000-000000001654'
first_claim="$(claim_report "$report_id" "$claim_key" 'a2:claim:medium')"
replay_claim="$(claim_report "$report_id" "$claim_key" 'a2:claim:medium')"
test "$first_claim" = "$report_id|56|56|false"
test "$replay_claim" = "$report_id|56|56|true"
test -z "$(materialize)"

# Stopping an unfinished plan freezes elapsed server time into one proportional pending report.
short_plan="$(set_plan short '00000000-0000-4000-8000-000000001655' 'a2:plan:short-stop')"
test "$short_plan" = 'short|1|10800|false'
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.wayfarers_practice_state
  set plan_set_at = clock_timestamp() - interval '90 minutes', updated_at = clock_timestamp()
  where character_id = '$character_id'::uuid;"
test "$(stop_training)" = 'true'
test "$(stop_training)" = 'false'

partial="$(materialize)"
IFS='|' read -r partial_report_id partial_source partial_window partial_version partial_window_seconds partial_planned_elapsed partial_fallback partial_elapsed partial_credited partial_xp partial_rested partial_status <<<"$partial"
test -n "$partial_report_id"
test "$partial_source" = 'passive_training'
test "$partial_window" = 'short'
test "$partial_version" = '1'
test "$partial_window_seconds" = '10800'
test "$partial_fallback" = '0'
test "$partial_planned_elapsed" = "$partial_elapsed"
test "$partial_credited" = "$partial_elapsed"
test "$partial_elapsed" -ge 5400
test "$partial_elapsed" -le 5410
test "$partial_xp" = '15'
test "$partial_rested" = '0'
test "$partial_status" = 'pending'

partial_claim_key='00000000-0000-4000-8000-000000001656'
partial_claim="$(claim_report "$partial_report_id" "$partial_claim_key" 'a2:claim:short-partial')"
test "$partial_claim" = "$partial_report_id|15|15|false"
test -z "$(materialize)"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.set_wayfarers_practice_plan_v1(
    'user:$user_id',
    'wayfarers_practice.set_plan.v1',
    '00000000-0000-4000-8000-000000001657'::uuid,
    'browser-forbidden',
    '$user_id'::uuid,
    '$character_id'::uuid,
    'extended'
  );"; then
  echo 'Authenticated browser role unexpectedly started Passive Training.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.stop_passive_training_v1('$user_id'::uuid, '$character_id'::uuid);"; then
  echo 'Authenticated browser role unexpectedly stopped Passive Training.' >&2
  exit 1
fi

printf '%s\n' 'Passive Training window authority verified.'
