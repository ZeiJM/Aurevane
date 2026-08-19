#!/usr/bin/env bash
set -euo pipefail

status_env="$(pnpm exec supabase status -o env)"
eval "$(printf '%s\n' "$status_env" | grep '^ANON_KEY=')"
test -n "${ANON_KEY:-}"

api_url='http://127.0.0.1:54321'
password='A2-passive-authority-2026!'
email_one="a2-passive-one-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
email_two="a2-passive-two-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

signup() {
  local email="$1"
  curl --fail-with-body --silent --show-error \
    --request POST "$api_url/auth/v1/signup" \
    --header "apikey: $ANON_KEY" \
    --header 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\"}"
}

first_signup="$(signup "$email_one")"
second_signup="$(signup "$email_two")"
user_one="$(printf '%s' "$first_signup" | jq -r '.user.id')"
user_two="$(printf '%s' "$second_signup" | jq -r '.user.id')"
test -n "$user_one"
test -n "$user_two"

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

create_character() {
  local user_id="$1"
  local idempotency_key="$2"
  local name="$3"
  local name_key="$4"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select id::text
    from public.create_base_character_v1(
      '$user_id'::uuid,
      '$idempotency_key'::uuid,
      'a2:create:$name_key',
      1,
      '$name',
      '$name_key',
      'androgynous',
      'they_them',
      'portrait.starter.wayfarer-01',
      'appearance.starter.roadworn',
      'vanguard',
      6, 6, 6, 6
    );"
}

materialize() {
  local user_id="$1"
  local character_id="$2"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      report_id::text || '|' || practice_source || '|' ||
      coalesce(planned_window, '') || '|' || elapsed_seconds::text || '|' ||
      requested_character_xp::text || '|' || rested_momentum_gain::text || '|' || status
    from public.materialize_training_report_v2('$user_id'::uuid, '$character_id'::uuid);"
}

set_plan() {
  local user_id="$1"
  local character_id="$2"
  local key="$3"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select planned_window || '|' || planned_window_seconds::text || '|' || replayed::text
    from public.set_wayfarers_practice_plan_v1(
      'user:$user_id',
      'wayfarers_practice.set_plan.v1',
      '$key'::uuid,
      'a2:short-plan',
      '$user_id'::uuid,
      '$character_id'::uuid,
      'short'
    );"
}

claim() {
  local user_id="$1"
  local character_id="$2"
  local report_id="$3"
  local key="$4"
  local fingerprint="$5"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      report_id::text || '|' || coalesce(xp_grant_id::text, '') || '|' ||
      requested_character_xp::text || '|' || applied_character_xp::text || '|' ||
      xp_before::text || '|' || xp_after::text || '|' || replayed::text
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

private_access="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_table_privilege('authenticated', 'app_private.wayfarers_practice_state', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.training_reports', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.training_report_claims', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.passive_training_rate_configs', 'SELECT')::text || '|' ||
    has_table_privilege('service_role', 'app_private.training_reports', 'SELECT')::text;")"
test "$private_access" = 'false|false|false|false|true'

character_one="$(create_character "$user_one" '00000000-0000-4000-8000-000000001601' 'Arlen Trainee' 'arlentrainee')"
character_two="$(create_character "$user_two" '00000000-0000-4000-8000-000000001602' 'Sera Trainee' 'seratrainee')"
test -n "$character_one"
test -n "$character_two"

# Merely being idle/offline cannot manufacture a report. Move both legacy activity boundaries
# to one identical historical timestamp so the database invariant remains true.
initial="$(materialize "$user_one" "$character_one")"
test -z "$initial"
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  with boundary as (
    select clock_timestamp() - interval '14 days' as at
  )
  update app_private.wayfarers_practice_state state
  set
    last_active_at = boundary.at,
    practice_claimed_through_at = boundary.at,
    updated_at = clock_timestamp()
  from boundary
  where state.character_id = '$character_one'::uuid;"
test -z "$(materialize "$user_one" "$character_one")"

# Cross-account materialization remains forbidden.
if materialize "$user_two" "$character_one" >/tmp/a2-passive-owner.out 2>/tmp/a2-passive-owner.err; then
  echo 'Expected cross-account Passive Training materialization to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_NOT_FOUND' /tmp/a2-passive-owner.err

plan_key='00000000-0000-4000-8000-000000001603'
first_plan="$(set_plan "$user_one" "$character_one" "$plan_key")"
test "$first_plan" = 'short|10800|false'

# Completion is based on the server-authored plan start, not last-active timestamps.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update app_private.wayfarers_practice_state
  set plan_set_at = clock_timestamp() - interval '4 hours', updated_at = clock_timestamp()
  where character_id = '$character_one'::uuid;"

first_report="$(materialize "$user_one" "$character_one")"
IFS='|' read -r report_one source_one window_one elapsed_one xp_one rested_one status_one <<<"$first_report"
test -n "$report_one"
test "$source_one" = 'passive_training'
test "$window_one" = 'short'
test "$elapsed_one" = '10800'
test "$xp_one" = '30'
test "$rested_one" = '0'
test "$status_one" = 'pending'

# Materialization is frozen/idempotent while the report is pending.
test "$(materialize "$user_one" "$character_one")" = "$first_report"

claim_key='00000000-0000-4000-8000-000000001604'
first_claim="$(claim "$user_one" "$character_one" "$report_one" "$claim_key" 'a2:claim:short')"
replay_claim="$(claim "$user_one" "$character_one" "$report_one" "$claim_key" 'a2:claim:short')"
IFS='|' read -r first_report_id first_grant first_requested first_applied first_xp_before first_xp_after first_replayed <<<"$first_claim"
IFS='|' read -r replay_report_id replay_grant replay_requested replay_applied replay_xp_before replay_xp_after replay_replayed <<<"$replay_claim"

test "$first_report_id" = "$report_one"
test "$replay_report_id" = "$report_one"
test -n "$first_grant"
test "$first_grant" = "$replay_grant"
test "$first_requested" = '30'
test "$first_applied" = '30'
test "$replay_requested" = '30'
test "$replay_applied" = '30'
test "$first_xp_before" = '0'
test "$first_xp_after" = '30'
test "$replay_xp_before" = '0'
test "$replay_xp_after" = '30'
test "$first_replayed" = 'false'
test "$replay_replayed" = 'true'

if claim "$user_one" "$character_one" "$report_one" "$claim_key" 'a2:claim:different' >/tmp/a2-passive-idempotency.out 2>/tmp/a2-passive-idempotency.err; then
  echo 'Expected conflicting Training Report idempotency fingerprint to fail.' >&2
  exit 1
fi
grep -Fq 'idempotency key reused' /tmp/a2-passive-idempotency.err

claim_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.training_report_claims where report_id = '$report_one'::uuid;")"
test "$claim_count" = '1'

grant_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.character_xp_grants where id = '$first_grant'::uuid;")"
test "$grant_count" = '1'

atomic_state="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select c.xp::text || '|' || report.status || '|' || (report.claimed_at is not null)::text
  from public.characters c
  join app_private.training_reports report on report.character_id = c.id
  where c.id = '$character_one'::uuid and report.id = '$report_one'::uuid;")"
test "$atomic_state" = '30|claimed|true'

test -z "$(materialize "$user_one" "$character_one")"

# Browser roles cannot call reward or materialization authority directly.
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.materialize_training_report_v2('$user_one'::uuid, '$character_one'::uuid);"; then
  echo 'Authenticated browser role unexpectedly materialized Passive Training.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.claim_training_report_v1(
    'user:$user_one',
    'wayfarers_practice.claim.v1',
    '00000000-0000-4000-8000-000000001605'::uuid,
    'a2:browser',
    '$user_one'::uuid,
    '$character_one'::uuid,
    '$report_one'::uuid
  );"; then
  echo 'Authenticated browser role unexpectedly claimed a Training Report.' >&2
  exit 1
fi

printf '%s\n' 'Passive Training claim authority verified.'
