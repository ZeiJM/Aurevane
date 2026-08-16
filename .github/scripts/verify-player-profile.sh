#!/usr/bin/env bash
set -euo pipefail

status_env="$(pnpm exec supabase status -o env)"
eval "$(printf '%s\n' "$status_env" | grep '^ANON_KEY=')"
test -n "${ANON_KEY:-}"

api_url='http://127.0.0.1:54321'
password='P11-profile-security-2026!'
email_one="p11-profile-one-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
email_two="p11-profile-two-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

signup() {
  local email="$1"
  curl --fail-with-body --silent --show-error \
    --request POST "$api_url/auth/v1/signup" \
    --header "apikey: $ANON_KEY" \
    --header 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\"}"
}

first="$(signup "$email_one")"
second="$(signup "$email_two")"

user_one="$(printf '%s' "$first" | jq -r '.user.id')"
user_two="$(printf '%s' "$second" | jq -r '.user.id')"
token_one="$(printf '%s' "$first" | jq -r '.access_token')"

test -n "$user_one"
test -n "$user_two"
test -n "$token_one"
test "$token_one" != 'null'

own_profiles="$(curl --fail-with-body --silent --show-error \
  "$api_url/rest/v1/player_profiles?select=user_id,created_at" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $token_one")"
printf '%s' "$own_profiles" | jq -e --arg user "$user_one" \
  'length == 1 and .[0].user_id == $user and (.0.created_at | strings | length > 0)' >/dev/null

cross_account="$(curl --fail-with-body --silent --show-error \
  "$api_url/rest/v1/player_profiles?select=user_id&user_id=eq.$user_two" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $token_one")"
printf '%s' "$cross_account" | jq -e 'length == 0' >/dev/null

mutation_status="$(curl --silent --show-error \
  --output /tmp/p11-profile-mutation.json \
  --write-out '%{http_code}' \
  --request POST "$api_url/rest/v1/player_profiles" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $token_one" \
  --header 'Content-Type: application/json' \
  --data "{\"user_id\":\"$user_one\"}")"

case "$mutation_status" in
  2*)
    echo 'Authenticated browser unexpectedly mutated player_profiles directly.' >&2
    exit 1
    ;;
esac

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
profile_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc \
  "select count(*) from public.player_profiles where user_id in ('$user_one'::uuid, '$user_two'::uuid);")"
test "$profile_count" = '2'
