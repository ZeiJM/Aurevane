#!/usr/bin/env bash
set -euo pipefail

status_env="$(pnpm exec supabase status -o env)"
eval "$(printf '%s\n' "$status_env" | grep '^ANON_KEY=')"
test -n "${ANON_KEY:-}"

api_url='http://127.0.0.1:54321'
password='P15-character-progression-2026!'
email_one="p15-progression-one-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
email_two="p15-progression-two-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

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
token_one="$(printf '%s' "$first_signup" | jq -r '.access_token')"

test -n "$user_one"
test -n "$user_two"
test "$token_one" != 'null'

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
      'p15:create:$name_key',
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

grant_xp() {
  local character_id="$1"
  local idempotency_key="$2"
  local fingerprint="$3"
  local amount="$4"
  local source_id="${5:-ci.progression}"
  local reason_tag="${6:-progression.integration}"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      grant_id::text || '|' || replayed::text || '|' || requested_amount::text || '|' ||
      applied_amount::text || '|' || xp_before::text || '|' || xp_after::text || '|' ||
      level_before::text || '|' || level_after::text || '|' || coalesce(reached_level::text, '') || '|' ||
      curve_version::text
    from public.grant_character_xp_v1(
      '$character_id'::uuid,
      '$idempotency_key'::uuid,
      '$fingerprint',
      'system:ci-progression',
      'system',
      '$source_id',
      '$reason_tag',
      $amount::bigint
    );"
}

curve="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  set role service_role;
  select curve_version::text || '|' || max_level::text || '|' || array_length(cumulative_xp_by_level, 1)::text || '|' || cumulative_xp_by_level[1]::text || '|' || cumulative_xp_by_level[2]::text
  from public.get_level_progression_curve_v1(1);")"
test "$curve" = '1|100|100|0|100'

private_access="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_table_privilege('authenticated', 'app_private.level_progression_curves', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.character_xp_grants', 'SELECT')::text || '|' ||
    has_table_privilege('service_role', 'app_private.level_progression_curves', 'SELECT')::text || '|' ||
    has_table_privilege('service_role', 'app_private.character_xp_grants', 'SELECT')::text;")"
test "$private_access" = 'false|false|true|true'

character_one="$(create_character "$user_one" '00000000-0000-4000-8000-000000001501' 'Arlen Progress' 'arlenprogress')"
character_two="$(create_character "$user_two" '00000000-0000-4000-8000-000000001502' 'Sera Progress' 'seraprogress')"
test -n "$character_one"
test -n "$character_two"

first="$(grant_xp "$character_one" '00000000-0000-4000-8000-000000001503' 'p15:first' 650)"
replay="$(grant_xp "$character_one" '00000000-0000-4000-8000-000000001503' 'p15:first' 650)"
IFS='|' read -r first_id first_replayed first_requested first_applied first_before first_after first_level_before first_level_after first_reached first_curve <<<"$first"
IFS='|' read -r replay_id replay_replayed _ _ _ _ _ _ _ _ <<<"$replay"

test -n "$first_id"
test "$first_id" = "$replay_id"
test "$first_replayed" = 'false'
test "$replay_replayed" = 'true'
test "$first_requested" = '650'
test "$first_applied" = '650'
test "$first_before" = '0'
test "$first_after" = '650'
test "$first_level_before" = '1'
test "$first_level_after" = '5'
test "$first_reached" = '5'
test "$first_curve" = '1'

first_ledger_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.character_xp_grants where id = '$first_id'::uuid;")"
test "$first_ledger_count" = '1'

telemetry="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select source_kind || '|' || source_id || '|' || reason_tag || '|' || curve_version::text || '|' ||
    level_before::text || '|' || level_after::text || '|' || reached_level::text || '|' ||
    (seconds_since_cycle_start >= 0)::text
  from app_private.character_xp_grants
  where id = '$first_id'::uuid;")"
test "$telemetry" = 'system|ci.progression|progression.integration|1|1|5|5|true'

if grant_xp "$character_one" '00000000-0000-4000-8000-000000001503' 'p15:different' 650 >/tmp/p15-idempotency.out 2>/tmp/p15-idempotency.err; then
  echo 'Expected conflicting XP idempotency fingerprint to fail.' >&2
  exit 1
fi
grep -Fq 'idempotency key reused' /tmp/p15-idempotency.err

if grant_xp "$character_one" '00000000-0000-4000-8000-000000001504' 'p15:negative' -1 >/tmp/p15-negative.out 2>/tmp/p15-negative.err; then
  echo 'Expected negative XP grant to fail.' >&2
  exit 1
fi
grep -Fq 'XP grant amount must be positive' /tmp/p15-negative.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.get_level_progression_curve_v1(1);"; then
  echo 'Authenticated browser role unexpectedly read the private XP curve RPC.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.grant_character_xp_v1(
    '$character_one'::uuid,
    '00000000-0000-4000-8000-000000001505'::uuid,
    'p15:browser',
    'browser:forged',
    'gameplay',
    'browser.forged',
    'progression.forged',
    999999::bigint
  );"; then
  echo 'Authenticated browser role unexpectedly executed the XP grant RPC.' >&2
  exit 1
fi

mutation_status="$(curl --silent --show-error \
  --output /tmp/p15-direct-xp.json \
  --write-out '%{http_code}' \
  --request PATCH "$api_url/rest/v1/characters?id=eq.$character_one" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $token_one" \
  --header 'Content-Type: application/json' \
  --header 'Prefer: return=representation' \
  --data '{"level":100,"xp":999999999}')"
case "$mutation_status" in
  2*)
    echo 'Authenticated browser unexpectedly mutated Level/XP directly.' >&2
    exit 1
    ;;
esac

(
  grant_xp "$character_two" '00000000-0000-4000-8000-000000001506' 'p15:concurrent:a' 150 'ci.concurrent' 'progression.concurrent' > /tmp/p15-concurrent-a.out
) &
pid_a=$!
(
  grant_xp "$character_two" '00000000-0000-4000-8000-000000001507' 'p15:concurrent:b' 150 'ci.concurrent' 'progression.concurrent' > /tmp/p15-concurrent-b.out
) &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

concurrent_state="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select xp::text || '|' || level::text from public.characters where id = '$character_two'::uuid;")"
test "$concurrent_state" = '300|3'
concurrent_ledger_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.character_xp_grants where character_id = '$character_two'::uuid;")"
test "$concurrent_ledger_count" = '2'

cap="$(grant_xp "$character_one" '00000000-0000-4000-8000-000000001508' 'p15:cap' 9223372036854775807 'ci.cap' 'progression.cap')"
IFS='|' read -r _ _ _ cap_applied _ cap_after _ cap_level_after cap_reached _ <<<"$cap"
test "$cap_level_after" = '100'
test "$cap_reached" = '100'
test "$cap_applied" -gt 0

cap_threshold="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select cumulative_xp_by_level[max_level] from app_private.level_progression_curves where version = 1;")"
test "$cap_after" = "$cap_threshold"

at_cap="$(grant_xp "$character_one" '00000000-0000-4000-8000-000000001509' 'p15:at-cap' 1 'ci.cap' 'progression.cap')"
IFS='|' read -r _ _ _ at_cap_applied _ at_cap_after _ at_cap_level_after at_cap_reached _ <<<"$at_cap"
test "$at_cap_applied" = '0'
test "$at_cap_after" = "$cap_threshold"
test "$at_cap_level_after" = '100'
test -z "$at_cap_reached"
