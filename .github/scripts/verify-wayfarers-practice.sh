#!/usr/bin/env bash
set -euo pipefail

status_env="$(pnpm exec supabase status -o env)"
eval "$(printf '%s\n' "$status_env" | grep '^ANON_KEY=')"
test -n "${ANON_KEY:-}"

api_url='http://127.0.0.1:54321'
password='P16-wayfarers-practice-2026!'
email_one="p16-wayfarer-one-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
email_two="p16-wayfarer-two-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

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
      'p16:create:$name_key',
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
      report_id::text || '|' ||
      window_ended_at::text || '|' ||
      elapsed_seconds::text || '|' ||
      credited_direct_seconds::text || '|' ||
      requested_character_xp::text || '|' ||
      direct_xp_cap_reached::text || '|' ||
      rested_momentum_seconds::text || '|' ||
      rested_momentum_gain::text || '|' ||
      rested_momentum_cap_reached::text || '|' ||
      status
    from public.materialize_training_report_v1(
      '$user_id'::uuid,
      '$character_id'::uuid
    );"
}

claim() {
  local user_id="$1"
  local character_id="$2"
  local report_id="$3"
  local idempotency_key="$4"
  local fingerprint="$5"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      report_id::text || '|' ||
      coalesce(xp_grant_id::text, '') || '|' ||
      requested_character_xp::text || '|' ||
      applied_character_xp::text || '|' ||
      xp_before::text || '|' ||
      xp_after::text || '|' ||
      level_before::text || '|' ||
      level_after::text || '|' ||
      coalesce(reached_level::text, '') || '|' ||
      rested_momentum_before::text || '|' ||
      rested_momentum_applied::text || '|' ||
      rested_momentum_after::text || '|' ||
      replayed::text
    from public.claim_training_report_v1(
      'user:$user_id',
      'wayfarers_practice.claim.v1',
      '$idempotency_key'::uuid,
      '$fingerprint',
      '$user_id'::uuid,
      '$character_id'::uuid,
      '$report_id'::uuid
    );"
}

set_absence() {
  local character_id="$1"
  local interval_value="$2"

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

private_access="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_table_privilege('authenticated', 'app_private.wayfarers_practice_configs', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.wayfarers_practice_state', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.training_reports', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.training_report_claims', 'SELECT')::text || '|' ||
    has_table_privilege('service_role', 'app_private.training_reports', 'SELECT')::text;")"
test "$private_access" = 'false|false|false|false|true'

character_one="$(create_character "$user_one" '00000000-0000-4000-8000-000000001601' 'Arlen Wayfarer' 'arlenwayfarer')"
character_two="$(create_character "$user_two" '00000000-0000-4000-8000-000000001602' 'Sera Wayfarer' 'serawayfarer')"
test -n "$character_one"
test -n "$character_two"

initial="$(materialize "$user_one" "$character_one")"
test -z "$initial"

state_initialized="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select focus || '|' || config_version::text || '|' || rested_momentum_balance::text
  from app_private.wayfarers_practice_state
  where character_id = '$character_one'::uuid;")"
test "$state_initialized" = 'balanced|1|0'

set_absence "$character_one" '30 minutes'
short_reconnect="$(materialize "$user_one" "$character_one")"
test -z "$short_reconnect"
short_report_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.training_reports
  where character_id = '$character_one'::uuid;")"
test "$short_report_count" = '0'

if materialize "$user_two" "$character_one" >/tmp/p16-owner.out 2>/tmp/p16-owner.err; then
  echo 'Expected cross-account Training Report materialization to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_NOT_FOUND' /tmp/p16-owner.err

set_absence "$character_one" '96 hours'
first_report="$(materialize "$user_one" "$character_one")"
IFS='|' read -r report_one report_one_end report_one_elapsed report_one_direct_seconds report_one_xp report_one_direct_cap report_one_rested_seconds report_one_rested report_one_rested_cap report_one_status <<<"$first_report"

test -n "$report_one"
test "$report_one_xp" = '376'
test "$report_one_direct_cap" = 'true'
test "$report_one_rested" = '12'
test "$report_one_rested_cap" = 'false'
test "$report_one_status" = 'pending'
test "$report_one_elapsed" -ge 345600
test "$report_one_direct_seconds" = '255600'
test "$report_one_rested_seconds" -ge 86400

frozen_report="$(materialize "$user_one" "$character_one")"
IFS='|' read -r frozen_id frozen_end _ _ frozen_xp _ _ frozen_rested _ frozen_status <<<"$frozen_report"
test "$frozen_id" = "$report_one"
test "$frozen_end" = "$report_one_end"
test "$frozen_xp" = "$report_one_xp"
test "$frozen_rested" = "$report_one_rested"
test "$frozen_status" = 'pending'

first_claim="$(claim "$user_one" "$character_one" "$report_one" '00000000-0000-4000-8000-000000001603' 'p16:claim:one')"
replay_claim="$(claim "$user_one" "$character_one" "$report_one" '00000000-0000-4000-8000-000000001603' 'p16:claim:one')"
IFS='|' read -r first_report_id first_grant_id first_requested first_applied first_xp_before first_xp_after first_level_before first_level_after first_reached first_rested_before first_rested_applied first_rested_after first_replayed <<<"$first_claim"
IFS='|' read -r replay_report_id replay_grant_id _ _ _ _ _ _ _ _ _ _ replay_replayed <<<"$replay_claim"

test "$first_report_id" = "$report_one"
test "$replay_report_id" = "$report_one"
test -n "$first_grant_id"
test "$first_grant_id" = "$replay_grant_id"
test "$first_requested" = '376'
test "$first_applied" = '376'
test "$first_xp_before" = '0'
test "$first_xp_after" = '376'
test "$first_level_before" = '1'
test "$first_level_after" = '3'
test "$first_reached" = '3'
test "$first_rested_before" = '0'
test "$first_rested_applied" = '12'
test "$first_rested_after" = '12'
test "$first_replayed" = 'false'
test "$replay_replayed" = 'true'

if claim "$user_one" "$character_one" "$report_one" '00000000-0000-4000-8000-000000001603' 'p16:claim:different' >/tmp/p16-idempotency.out 2>/tmp/p16-idempotency.err; then
  echo 'Expected conflicting Training Report idempotency fingerprint to fail.' >&2
  exit 1
fi
grep -Fq 'idempotency key reused' /tmp/p16-idempotency.err

duplicate_claim="$(claim "$user_one" "$character_one" "$report_one" '00000000-0000-4000-8000-000000001604' 'p16:claim:duplicate-intent')"
IFS='|' read -r duplicate_report duplicate_grant _ _ _ _ _ _ _ _ _ _ duplicate_replayed <<<"$duplicate_claim"
test "$duplicate_report" = "$report_one"
test "$duplicate_grant" = "$first_grant_id"
test "$duplicate_replayed" = 'true'

atomic_state="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    c.xp::text || '|' || c.level::text || '|' ||
    state.rested_momentum_balance::text || '|' ||
    report.status || '|' ||
    (report.claimed_at is not null)::text || '|' ||
    (state.practice_claimed_through_at = report.window_ended_at)::text
  from public.characters c
  join app_private.wayfarers_practice_state state on state.character_id = c.id
  join app_private.training_reports report on report.id = '$report_one'::uuid
  where c.id = '$character_one'::uuid;")"
test "$atomic_state" = '376|3|12|claimed|true|true'

first_claim_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.training_report_claims
  where report_id = '$report_one'::uuid;")"
test "$first_claim_count" = '1'

xp_provenance="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    source_kind || '|' || source_id || '|' || reason_tag || '|' ||
    requested_amount::text || '|' || applied_amount::text
  from app_private.character_xp_grants
  where id = '$first_grant_id'::uuid;")"
test "$xp_provenance" = "system|$report_one|wayfarers_practice.balanced.v1|376|376"

post_claim_reconnect="$(materialize "$user_one" "$character_one")"
test -z "$post_claim_reconnect"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.materialize_training_report_v1(
    '$user_one'::uuid,
    '$character_one'::uuid
  );"; then
  echo 'Authenticated browser role unexpectedly materialized a Training Report.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.claim_training_report_v1(
    'user:$user_one',
    'wayfarers_practice.claim.v1',
    '00000000-0000-4000-8000-000000001605'::uuid,
    'p16:browser',
    '$user_one'::uuid,
    '$character_one'::uuid,
    '$report_one'::uuid
  );"; then
  echo 'Authenticated browser role unexpectedly claimed a Training Report.' >&2
  exit 1
fi

cap_threshold="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select cumulative_xp_by_level[max_level]
  from app_private.level_progression_curves
  where version = 1;")"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  update public.characters
  set xp = $cap_threshold::bigint, level = 100
  where id = '$character_one'::uuid;
  update app_private.wayfarers_practice_state
  set rested_momentum_balance = 130
  where character_id = '$character_one'::uuid;"

set_absence "$character_one" '96 hours'
cap_report_raw="$(materialize "$user_one" "$character_one")"
IFS='|' read -r cap_report _ _ _ cap_report_xp _ _ cap_report_rested _ _ <<<"$cap_report_raw"
test -n "$cap_report"
test "$cap_report_xp" = '376'
test "$cap_report_rested" = '12'

cap_claim="$(claim "$user_one" "$character_one" "$cap_report" '00000000-0000-4000-8000-000000001606' 'p16:claim:cap')"
IFS='|' read -r _ cap_grant cap_requested cap_applied cap_xp_before cap_xp_after cap_level_before cap_level_after cap_reached cap_rested_before cap_rested_applied cap_rested_after cap_replayed <<<"$cap_claim"
test -n "$cap_grant"
test "$cap_requested" = '376'
test "$cap_applied" = '0'
test "$cap_xp_before" = "$cap_threshold"
test "$cap_xp_after" = "$cap_threshold"
test "$cap_level_before" = '100'
test "$cap_level_after" = '100'
test -z "$cap_reached"
test "$cap_rested_before" = '130'
test "$cap_rested_applied" = '2'
test "$cap_rested_after" = '132'
test "$cap_replayed" = 'false'

cap_ledger="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select requested_amount::text || '|' || applied_amount::text || '|' || level_after::text
  from app_private.character_xp_grants
  where id = '$cap_grant'::uuid;")"
test "$cap_ledger" = '376|0|100'

set_absence "$character_one" '96 hours'
concurrent_report_raw="$(materialize "$user_one" "$character_one")"
IFS='|' read -r concurrent_report _ _ _ _ _ _ _ _ _ <<<"$concurrent_report_raw"
test -n "$concurrent_report"

(
  claim "$user_one" "$character_one" "$concurrent_report" '00000000-0000-4000-8000-000000001607' 'p16:claim:concurrent:a' > /tmp/p16-concurrent-a.out
) &
pid_a=$!
(
  claim "$user_one" "$character_one" "$concurrent_report" '00000000-0000-4000-8000-000000001608' 'p16:claim:concurrent:b' > /tmp/p16-concurrent-b.out
) &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

IFS='|' read -r concurrent_report_a concurrent_grant_a _ _ _ _ _ _ _ _ concurrent_rested_a concurrent_after_a concurrent_replayed_a </tmp/p16-concurrent-a.out
IFS='|' read -r concurrent_report_b concurrent_grant_b _ _ _ _ _ _ _ _ concurrent_rested_b concurrent_after_b concurrent_replayed_b </tmp/p16-concurrent-b.out

test "$concurrent_report_a" = "$concurrent_report"
test "$concurrent_report_b" = "$concurrent_report"
test "$concurrent_grant_a" = "$concurrent_grant_b"
test "$concurrent_rested_a" = '0'
test "$concurrent_rested_b" = '0'
test "$concurrent_after_a" = '132'
test "$concurrent_after_b" = '132'
if [ "$concurrent_replayed_a|$concurrent_replayed_b" != 'false|true' ] && [ "$concurrent_replayed_a|$concurrent_replayed_b" != 'true|false' ]; then
  echo 'Expected exactly one concurrent Training Report claim execution.' >&2
  exit 1
fi

concurrent_claim_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.training_report_claims
  where report_id = '$concurrent_report'::uuid;")"
test "$concurrent_claim_count" = '1'

concurrent_grant_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.character_xp_grants
  where source_id = '$concurrent_report';")"
test "$concurrent_grant_count" = '1'
