#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

api_url="$TEST_AUTH_API_URL"
password='P11-profile-security-2026!'
email_one="p11-profile-one-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
email_two="p11-profile-two-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

first="$(signup_test_user "$email_one" "$password")"
second="$(signup_test_user "$email_two" "$password")"

user_one="$(printf '%s' "$first" | jq -r '.user.id')"
user_two="$(printf '%s' "$second" | jq -r '.user.id')"

test -n "$user_one"
test -n "$user_two"
test "$user_one" != 'null'
test "$user_two" != 'null'

confirm_test_user "$user_one"
confirm_test_user "$user_two"

token_one="$(sign_in_test_user "$email_one" "$password" | jq -r '.access_token')"
test -n "$token_one"
test "$token_one" != 'null'

own_profiles="$(curl --fail-with-body --silent --show-error \
  "$api_url/rest/v1/player_profiles?select=user_id,created_at,combat_keybinds" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $token_one")"
printf '%s' "$own_profiles" | jq -e --arg user "$user_one" \
  'length == 1 and .[0].user_id == $user and (.[0].created_at | strings | length > 0) and .[0].combat_keybinds.move.code == "Digit2" and .[0].combat_keybinds.endTurn.code == "Space" and .[0].combat_keybinds.previousTarget.shift == true' >/dev/null

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

keybind_patch_status="$(curl --silent --show-error \
  --output /tmp/p27-keybind-patch.json \
  --write-out '%{http_code}' \
  --request PATCH "$api_url/rest/v1/player_profiles?user_id=eq.$user_one" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $token_one" \
  --header 'Content-Type: application/json' \
  --data '{"combat_keybinds":{"move":{"code":"KeyM","shift":false}}}')"

case "$keybind_patch_status" in
  2*)
    echo 'Authenticated browser unexpectedly updated combat_keybinds directly.' >&2
    exit 1
    ;;
esac

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
profile_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc \
  "select count(*) from public.player_profiles where user_id in ('$user_one'::uuid, '$user_two'::uuid);")"
test "$profile_count" = '2'

move_key="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc \
  "select combat_keybinds->'move'->>'code' from public.player_profiles where user_id = '$user_one'::uuid;")"
test "$move_key" = 'Digit2'
