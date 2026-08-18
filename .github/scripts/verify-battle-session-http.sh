#!/usr/bin/env bash
set -euo pipefail

status_env="$(pnpm exec supabase status -o env)"
eval "$(printf '%s\n' "$status_env" | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|SECRET_KEY)=')"
test -n "${ANON_KEY:-}"
server_key="${SECRET_KEY:-${SERVICE_ROLE_KEY:-}}"
test -n "$server_key"

api_url='http://127.0.0.1:54321'
web_url='http://127.0.0.1:3000'
email="p24-http-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
password='P24-http-authority-2026!'
create_key='00000000-0000-4000-8000-000000002440'
move_key='00000000-0000-4000-8000-000000002441'
stale_key='00000000-0000-4000-8000-000000002442'
face_key='00000000-0000-4000-8000-000000002443'
opponent_key='00000000-0000-4000-8000-000000002444'

signup_response="$(curl --fail-with-body --silent --show-error \
  --request POST "$api_url/auth/v1/signup" \
  --header "apikey: $ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data "{\"email\":\"$email\",\"password\":\"$password\"}")"
user_id="$(printf '%s' "$signup_response" | jq -r '.user.id')"
test -n "$user_id"
test "$user_id" != 'null'

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select id::text
  from public.create_base_character_v1(
    '$user_id'::uuid,
    '00000000-0000-4000-8000-000000002445'::uuid,
    'p24:http:character',
    1,
    'P24 HTTP Wayfarer',
    'p24httpwayfarer',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    6, 6, 6, 6
  );")"
test -n "$character_id"

cookie_header="$(
  P24_SUPABASE_URL="$api_url" \
  P24_SUPABASE_ANON_KEY="$ANON_KEY" \
  P24_EMAIL="$email" \
  P24_PASSWORD="$password" \
  pnpm --filter @aurevane/web exec node --input-type=module <<'NODE'
import { createServerClient } from '@supabase/ssr'

const cookieJar = new Map()
const client = createServerClient(
  process.env.P24_SUPABASE_URL,
  process.env.P24_SUPABASE_ANON_KEY,
  {
    cookies: {
      getAll() {
        return [...cookieJar].map(([name, value]) => ({ name, value }))
      },
      setAll(cookies) {
        for (const { name, value } of cookies) {
          cookieJar.set(name, value)
        }
      },
    },
  },
)

const { error } = await client.auth.signInWithPassword({
  email: process.env.P24_EMAIL,
  password: process.env.P24_PASSWORD,
})

if (error) process.exit(1)
process.stdout.write([...cookieJar].map(([name, value]) => `${name}=${value}`).join('; '))
NODE
)"
test -n "$cookie_header"

AUREVANE_ENV=local \
NEXT_PUBLIC_AUREVANE_ENV=local \
NEXT_PUBLIC_SUPABASE_URL="$api_url" \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY" \
SUPABASE_SECRET_KEY="$server_key" \
pnpm --filter @aurevane/web exec next dev -H 127.0.0.1 -p 3000 \
  >/tmp/p24-http-web.log 2>&1 &
web_pid=$!

cleanup_web() {
  kill "$web_pid" 2>/dev/null || true
  wait "$web_pid" 2>/dev/null || true
}
trap cleanup_web EXIT

ready=false
for _ in $(seq 1 45); do
  if curl --fail --silent "$web_url/" >/dev/null; then
    ready=true
    break
  fi
  if ! kill -0 "$web_pid" 2>/dev/null; then
    break
  fi
  sleep 1
done
if [ "$ready" != 'true' ]; then
  echo 'Local AUREVANE web server did not become ready for P2.4 HTTP verification.' >&2
  cat /tmp/p24-http-web.log >&2 || true
  exit 1
fi

create_body="$(jq -cn --arg key "$create_key" --arg character "$character_id" \
  '{idempotencyKey: $key, characterId: $character}')"

unauth_status="$(curl --silent --show-error \
  --output /tmp/p24-http-unauth.json \
  --write-out '%{http_code}' \
  --request POST "$web_url/api/battles" \
  --header 'Content-Type: application/json' \
  --data "$create_body")"
test "$unauth_status" = '401'
jq -e '.error.code == "UNAUTHENTICATED"' /tmp/p24-http-unauth.json >/dev/null

claim_status="$(curl --silent --show-error \
  --output /tmp/p24-http-claim.json \
  --write-out '%{http_code}' \
  --request POST "$web_url/api/account/game-session/claim" \
  --cookie "$cookie_header")"
test "$claim_status" = '200'
jq -e '.active == true' /tmp/p24-http-claim.json >/dev/null

create_status="$(curl --silent --show-error \
  --output /tmp/p24-http-create.json \
  --write-out '%{http_code}' \
  --request POST "$web_url/api/battles" \
  --header 'Content-Type: application/json' \
  --cookie "$cookie_header" \
  --data "$create_body")"
test "$create_status" = '200'
jq -e \
  --arg player "character:$character_id" \
  '.battle.battleVersion == 1
    and .battle.replayed == false
    and (.battle.battleSessionId | strings | length > 0)
    and .battle.snapshot.tactical.battle.rng == null
    and .battle.snapshot.tactical.battle.currentTurn.combatantId == $player' \
  /tmp/p24-http-create.json >/dev/null
session_id="$(jq -r '.battle.battleSessionId' /tmp/p24-http-create.json)"

test -n "$session_id"

replay_create_status="$(curl --silent --show-error \
  --output /tmp/p24-http-create-replay.json \
  --write-out '%{http_code}' \
  --request POST "$web_url/api/battles" \
  --header 'Content-Type: application/json' \
  --cookie "$cookie_header" \
  --data "$create_body")"
test "$replay_create_status" = '200'
jq -e --arg session "$session_id" \
  '.battle.battleSessionId == $session and .battle.battleVersion == 1 and .battle.replayed == true and .battle.snapshot.tactical.battle.rng == null' \
  /tmp/p24-http-create-replay.json >/dev/null

get_status="$(curl --silent --show-error \
  --output /tmp/p24-http-get.json \
  --write-out '%{http_code}' \
  --request GET "$web_url/api/battles/$session_id" \
  --cookie "$cookie_header")"
test "$get_status" = '200'
jq -e --arg session "$session_id" \
  '.battle.battleSessionId == $session and .battle.battleVersion == 1 and .battle.snapshot.tactical.battle.rng == null' \
  /tmp/p24-http-get.json >/dev/null

move_body="$(jq -cn --arg key "$move_key" '{
  idempotencyKey: $key,
  expectedBattleVersion: 1,
  intent: {kind: "move", path: [{x: 0, y: 1}, {x: 1, y: 1}]}
}')"
move_status="$(curl --silent --show-error \
  --output /tmp/p24-http-move.json \
  --write-out '%{http_code}' \
  --request POST "$web_url/api/battles/$session_id/intents" \
  --header 'Content-Type: application/json' \
  --cookie "$cookie_header" \
  --data "$move_body")"
test "$move_status" = '200'
jq -e \
  --arg player "character:$character_id" \
  '.battle.battleVersion == 2
    and .battle.replayed == false
    and .battle.snapshot.tactical.battle.rng == null
    and ([.battle.snapshot.tactical.placements[] | select(.combatantId == $player) | .position] == [{x: 1, y: 1}])' \
  /tmp/p24-http-move.json >/dev/null

move_replay_status="$(curl --silent --show-error \
  --output /tmp/p24-http-move-replay.json \
  --write-out '%{http_code}' \
  --request POST "$web_url/api/battles/$session_id/intents" \
  --header 'Content-Type: application/json' \
  --cookie "$cookie_header" \
  --data "$move_body")"
test "$move_replay_status" = '200'
jq -e '.battle.battleVersion == 2 and .battle.replayed == true' \
  /tmp/p24-http-move-replay.json >/dev/null

stale_body="$(jq -cn --arg key "$stale_key" '{
  idempotencyKey: $key,
  expectedBattleVersion: 1,
  intent: {kind: "end-turn"}
}')"
stale_status="$(curl --silent --show-error \
  --output /tmp/p24-http-stale.json \
  --write-out '%{http_code}' \
  --request POST "$web_url/api/battles/$session_id/intents" \
  --header 'Content-Type: application/json' \
  --cookie "$cookie_header" \
  --data "$stale_body")"
test "$stale_status" = '409'
jq -e '.error.code == "STALE_VERSION" and .error.currentVersion == 2' \
  /tmp/p24-http-stale.json >/dev/null

face_body="$(jq -cn --arg key "$face_key" '{
  idempotencyKey: $key,
  expectedBattleVersion: 2,
  intent: {kind: "face", facing: "east"}
}')"
face_status="$(curl --silent --show-error \
  --output /tmp/p24-http-face.json \
  --write-out '%{http_code}' \
  --request POST "$web_url/api/battles/$session_id/intents" \
  --header 'Content-Type: application/json' \
  --cookie "$cookie_header" \
  --data "$face_body")"
test "$face_status" = '200'
jq -e \
  --arg player "character:$character_id" \
  '.battle.battleVersion == 3
    and .battle.snapshot.tactical.battle.rng == null
    and .battle.snapshot.tactical.battle.currentTurn.combatantId == "recruit:p2-4-1"
    and ([.battle.snapshot.tactical.placements[] | select(.combatantId == $player) | .facing] == ["east"])' \
  /tmp/p24-http-face.json >/dev/null

opponent_body="$(jq -cn --arg key "$opponent_key" '{
  idempotencyKey: $key,
  expectedBattleVersion: 3,
  intent: {kind: "end-turn"}
}')"
opponent_status="$(curl --silent --show-error \
  --output /tmp/p24-http-opponent.json \
  --write-out '%{http_code}' \
  --request POST "$web_url/api/battles/$session_id/intents" \
  --header 'Content-Type: application/json' \
  --cookie "$cookie_header" \
  --data "$opponent_body")"
test "$opponent_status" = '403'
jq -e '.error.code == "FORBIDDEN"' /tmp/p24-http-opponent.json >/dev/null

stored_rng_type="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select jsonb_typeof(current_snapshot #> '{tactical,battle,rng}')
  from app_private.battle_sessions
  where id = '$session_id'::uuid;")"
test "$stored_rng_type" = 'object'

if grep -Fq "$server_key" /tmp/p24-http-web.log; then
  echo 'Supabase server credential appeared in P2.4 web logs.' >&2
  exit 1
fi
