#!/usr/bin/env bash
set -euo pipefail

status_env="$(pnpm exec supabase status -o env)"
eval "$(printf '%s\n' "$status_env" | grep '^ANON_KEY=')"
test -n "${ANON_KEY:-}"

api_url='http://127.0.0.1:54321'
password='Emoji-privacy-2026!'
email="emoji-privacy-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

signup="$(curl --fail-with-body --silent --show-error \
  --request POST "$api_url/auth/v1/signup" \
  --header "apikey: $ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data "{\"email\":\"$email\",\"password\":\"$password\"}")"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$user_id"

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

saved="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select array_to_json(public.save_player_recent_emojis_v1(
    '$user_id'::uuid,
    array['😀','⚔️','🔥']::text[]
  ))::text;")"
test "$(printf '%s' "$saved" | jq -r 'length')" = '3'
test "$(printf '%s' "$saved" | jq -r '.[0]')" = '😀'
test "$(printf '%s' "$saved" | jq -r '.[1]')" = '⚔️'

loaded="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select array_to_json(public.get_player_recent_emojis_v1('$user_id'::uuid))::text;")"
test "$loaded" = "$saved"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.save_player_recent_emojis_v1(
    '$user_id'::uuid,
    array['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','🙂']::text[]
  );" >/tmp/emoji-too-many.out 2>/tmp/emoji-too-many.err; then
  echo 'Recent emoji storage unexpectedly accepted more than ten entries.' >&2
  exit 1
fi
grep -q 'RECENT_EMOJIS_INVALID' /tmp/emoji-too-many.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select public.get_player_recent_emojis_v1('$user_id'::uuid);" \
  >/tmp/emoji-browser-rpc.out 2>/tmp/emoji-browser-rpc.err; then
  echo 'Authenticated browser role unexpectedly executed recent emoji preference RPC.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/emoji-browser-rpc.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select recent_emojis from app_private.player_recent_emojis where user_id = '$user_id'::uuid;" \
  >/tmp/emoji-browser-table.out 2>/tmp/emoji-browser-table.err; then
  echo 'Authenticated browser role unexpectedly read private recent emoji preferences.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/emoji-browser-table.err

echo 'Recent emoji preference privacy regression checks passed.'
