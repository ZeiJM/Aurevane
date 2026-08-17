#!/usr/bin/env bash
set -euo pipefail

status_env="$(pnpm exec supabase status -o env)"
eval "$(printf '%s\n' "$status_env" | grep '^ANON_KEY=')"
test -n "${ANON_KEY:-}"

api_url='http://127.0.0.1:54321'
password='P16-planned-practice-2026!'
email="p16-planned-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

signup="$(curl --fail-with-body --silent --show-error \
  --request POST "$api_url/auth/v1/signup" \
  --header "apikey: $ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data "{\"email\":\"$email\",\"password\":\"$password\"}")"
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
    'p16:planned:create',
    1,
    'Planned Wayfarer',
    'plannedwayfarer',
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
      report_id::text || '|' ||
      practice_source || '|' ||
      coalesce(planned_window, '') || '|' ||
      coalesce(planned_window_config_version::text, '') || '|' ||
      coalesce(planned_window_seconds::text, '') || '|' ||
      planned_elapsed_seconds::text || '|' ||
      balanced_fallback_seconds::text || '|' ||
      elapsed_seconds::text || '|' ||
      requested_character_xp::text || '|' ||
      rested_momentum_gain::text || '|' ||
      status
    from public.materialize_training_report_v2(
      '$user_id'::uuid,
      '$character_id'::uuid
    );"
}

set_plan() {
  local window="$1"
  local key="$2"
  local fingerprint="$3"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      planned_window || '|' ||
      planned_window_config_version::text || '|' ||
      planned_window_seconds::text || '|' ||
      replayed::text
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
    select report_id::text || '|' || replayed::text
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

set_absence() {
  local interval_value="$1"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    with boundary as (
      select clock_timestamp() - interval '$interval_value' as at
    )
    update app_private.wayfarers_practice_state state
    set
      last_active_at = boundary.at,
      practice_claimed_through_at = boundary.at,
      updated_at = clock_timestamp()
    from boundary
    where state.character_id = '$character_id'::uuid;"
}

window_config="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select version::text || '|' || short_seconds::text || '|' || overnight_seconds::text || '|' || extended_seconds::text
  from app_private.wayfarers_practice_window_configs
  order by version;")"
test "$window_config" = '1|10800|28800|86400'

permissions="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_table_privilege('authenticated', 'app_private.wayfarers_practice_window_configs', 'SELECT')::text || '|' ||
    has_function_privilege('authenticated', 'public.materialize_training_report_v2(uuid, uuid)', 'EXECUTE')::text || '|' ||
    has_function_privilege('authenticated', 'public.get_wayfarers_practice_status_v1(uuid, uuid)', 'EXECUTE')::text || '|' ||
    has_function_privilege('authenticated', 'public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text)', 'EXECUTE')::text || '|' ||
    has_function_privilege('service_role', 'public.materialize_training_report_v2(uuid, uuid)', 'EXECUTE')::text || '|' ||
    has_function_privilege('service_role', 'public.get_wayfarers_practice_status_v1(uuid, uuid)', 'EXECUTE')::text || '|' ||
    has_function_privilege('service_role', 'public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text)', 'EXECUTE')::text;")"
test "$permissions" = 'false|false|false|false|true|true|true'

initial="$(materialize)"
test -z "$initial"

status="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    focus || '|' || config_version::text || '|' || minimum_offline_seconds::text || '|' ||
    rested_momentum_balance::text || '|' || coalesce(planned_window, '') || '|' ||
    short_window_seconds::text || '|' || overnight_window_seconds::text || '|' || extended_window_seconds::text
  from public.get_wayfarers_practice_status_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$status" = 'balanced|1|3600|0||10800|28800|86400'

plan_key='00000000-0000-4000-8000-000000001652'
first_plan="$(set_plan overnight "$plan_key" 'p16:plan:overnight')"
replay_plan="$(set_plan overnight "$plan_key" 'p16:plan:overnight')"
test "$first_plan" = 'overnight|1|28800|false'
test "$replay_plan" = 'overnight|1|28800|true'

if set_plan short "$plan_key" 'p16:plan:short' >/tmp/p16-plan-conflict.out 2>/tmp/p16-plan-conflict.err; then
  echo 'Expected conflicting Set Practice idempotency reuse to fail.' >&2
  exit 1
fi
grep -Fq 'idempotency key reused' /tmp/p16-plan-conflict.err

state_plan="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select planned_window || '|' || planned_window_config_version::text || '|' || planned_window_seconds::text || '|' || (plan_set_at is not null)::text
  from app_private.wayfarers_practice_state
  where character_id = '$character_id'::uuid;")"
test "$state_plan" = 'overnight|1|28800|true'

set_absence '30 minutes'
short_return="$(materialize)"
test -z "$short_return"
plan_survived_short_return="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select planned_window from app_private.wayfarers_practice_state where character_id = '$character_id'::uuid;")"
test "$plan_survived_short_return" = 'overnight'

set_absence '2 hours'
early_report="$(materialize)"
IFS='|' read -r early_id early_source early_window early_version early_window_seconds early_planned early_fallback early_elapsed early_xp early_rested early_status <<<"$early_report"
test -n "$early_id"
test "$early_source" = 'planned_balanced'
test "$early_window" = 'overnight'
test "$early_version" = '1'
test "$early_window_seconds" = '28800'
test "$early_planned" -ge 7200
test "$early_planned" -le 7210
test "$early_fallback" = '0'
test "$early_elapsed" -ge 7200
test "$early_xp" = '8'
test "$early_rested" = '0'
test "$early_status" = 'pending'

plan_consumed="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select (planned_window is null)::text || '|' || (plan_set_at is null)::text
  from app_private.wayfarers_practice_state where character_id = '$character_id'::uuid;")"
test "$plan_consumed" = 'true|true'

frozen="$(materialize)"
test "$frozen" = "$early_report"

first_claim="$(claim_report "$early_id" '00000000-0000-4000-8000-000000001653' 'p16:claim:early')"
test "$first_claim" = "$early_id|false"

second_plan="$(set_plan overnight '00000000-0000-4000-8000-000000001654' 'p16:plan:overflow')"
test "$second_plan" = 'overnight|1|28800|false'
set_absence '12 hours'
overflow_report="$(materialize)"
IFS='|' read -r overflow_id overflow_source overflow_window overflow_version overflow_window_seconds overflow_planned overflow_fallback overflow_elapsed overflow_xp overflow_rested overflow_status <<<"$overflow_report"
test -n "$overflow_id"
test "$overflow_source" = 'planned_balanced'
test "$overflow_window" = 'overnight'
test "$overflow_version" = '1'
test "$overflow_window_seconds" = '28800'
test "$overflow_planned" = '28800'
test "$overflow_fallback" -ge 14400
test "$overflow_fallback" -le 14410
test "$overflow_elapsed" -ge 43200
test "$overflow_xp" = '88'
test "$overflow_rested" = '0'
test "$overflow_status" = 'pending'

claim_report "$overflow_id" '00000000-0000-4000-8000-000000001655' 'p16:claim:overflow' >/dev/null
set_absence '2 hours'
automatic_report="$(materialize)"
IFS='|' read -r automatic_id automatic_source automatic_window automatic_version automatic_window_seconds automatic_planned automatic_fallback automatic_elapsed automatic_xp automatic_rested automatic_status <<<"$automatic_report"
test -n "$automatic_id"
test "$automatic_source" = 'automatic_balanced'
test -z "$automatic_window"
test -z "$automatic_version"
test -z "$automatic_window_seconds"
test "$automatic_planned" = '0'
test "$automatic_fallback" -ge 7200
test "$automatic_xp" = '8'
test "$automatic_rested" = '0'
test "$automatic_status" = 'pending'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.set_wayfarers_practice_plan_v1(
    'user:$user_id',
    'wayfarers_practice.set_plan.v1',
    '00000000-0000-4000-8000-000000001656'::uuid,
    'browser-forbidden',
    '$user_id'::uuid,
    '$character_id'::uuid,
    'extended'
  );"; then
  echo 'Authenticated browser role unexpectedly set a Practice plan.' >&2
  exit 1
fi

printf '%s\n' "Wayfarer's Practice planned-window authority verified."
