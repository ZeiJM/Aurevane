#!/usr/bin/env bash
set -euo pipefail

status_env="$(pnpm exec supabase status -o env)"
eval "$(printf '%s\n' "$status_env" | grep -E '^(SERVICE_ROLE_KEY|SECRET_KEY)=')"
server_key="${SECRET_KEY:-${SERVICE_ROLE_KEY:-}}"
test -n "$server_key"

api_url='http://127.0.0.1:54321'
password='PVP-seating-2026!'
email_one="pvp-seat-one-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
email_two="pvp-seat-two-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

create_user() {
  local email="$1"
  curl --fail-with-body --silent --show-error \
    --request POST "$api_url/auth/v1/admin/users" \
    --header "apikey: $server_key" \
    --header "Authorization: Bearer $server_key" \
    --header 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\",\"email_confirm\":true}"
}

created_one="$(create_user "$email_one")"
created_two="$(create_user "$email_two")"
user_one="$(printf '%s' "$created_one" | jq -r '.id // .user.id // empty')"
user_two="$(printf '%s' "$created_two" | jq -r '.id // .user.id // empty')"
test -n "$user_one"
test -n "$user_two"

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

create_character() {
  local user_id="$1"
  local idempotency_key="$2"
  local fingerprint="$3"
  local name="$4"
  local name_key="$5"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select id::text
    from public.create_base_character_v1(
      '$user_id'::uuid,
      '$idempotency_key'::uuid,
      '$fingerprint',
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

character_one="$(create_character \
  "$user_one" \
  '00000000-0000-4000-8000-000000006101' \
  'pvp-seating:character:one' \
  'Seat Arlen' \
  'seatarlen')"
character_two="$(create_character \
  "$user_two" \
  '00000000-0000-4000-8000-000000006102' \
  'pvp-seating:character:two' \
  'Seat Sera' \
  'seatsera')"

test -n "$character_one"
test -n "$character_two"

lobby_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.create_pvp_lobby_v1(
    '$user_one'::uuid,
    '$character_one'::uuid,
    '2v2',
    null,
    null
  )::text;")"
test -n "$lobby_id"

lobby_key="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_lobby_v1('$user_one'::uuid, '$lobby_id'::uuid) ->> 'lobby_key';")"
[[ "$lobby_key" =~ ^AVL-[A-F0-9]{4}-[A-F0-9]{4}$ ]]

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -qc "
  set role service_role;
  select public.join_pvp_lobby_v1(
    '$user_two'::uuid,
    '$character_two'::uuid,
    '$lobby_key'
  );"

initial="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_lobby_v1('$user_one'::uuid, '$lobby_id'::uuid)::text;")"
test "$(printf '%s' "$initial" | jq -r '[.members[] | select(.seated == true)] | length')" = '2'
test "$(printf '%s' "$initial" | jq -r '[.members[].ready] | all(. == false)')" = 'true'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select public.move_pvp_lobby_seat_v2(
    '$user_one'::uuid,
    '$lobby_id'::uuid,
    null,
    null
  );" >/tmp/pvp-seat-browser.out 2>/tmp/pvp-seat-browser.err; then
  echo 'Authenticated browser role unexpectedly executed authoritative seat mutation.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/pvp-seat-browser.err

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -qc "
  set role service_role;
  select public.move_pvp_lobby_seat_v2(
    '$user_one'::uuid,
    '$lobby_id'::uuid,
    null,
    null
  );"

unseated="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_lobby_v1('$user_one'::uuid, '$lobby_id'::uuid)::text;")"
test "$(printf '%s' "$unseated" | jq -r '.members[] | select(.user_id == "'"$user_one"'") | .seated')" = 'false'
test "$(printf '%s' "$unseated" | jq -r '.members[] | select(.user_id == "'"$user_one"'") | .ready')" = 'false'
test "$(printf '%s' "$unseated" | jq -r '.ready_to_start')" = 'false'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.set_pvp_lobby_ready_v1('$user_one'::uuid, '$lobby_id'::uuid, true);" \
  >/tmp/pvp-seat-ready.out 2>/tmp/pvp-seat-ready.err; then
  echo 'Unseated combatant unexpectedly became ready.' >&2
  exit 1
fi
grep -q 'PVP_LOBBY_NOT_AVAILABLE' /tmp/pvp-seat-ready.err

# The host's original Team 1 seat 1 is now open. Re-seat into Team 1 seat 2.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -qc "
  set role service_role;
  select public.move_pvp_lobby_seat_v2(
    '$user_one'::uuid,
    '$lobby_id'::uuid,
    0,
    1
  );"

reseated="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_lobby_v1('$user_one'::uuid, '$lobby_id'::uuid)::text;")"
test "$(printf '%s' "$reseated" | jq -r '.members[] | select(.user_id == "'"$user_one"'") | .seated')" = 'true'
test "$(printf '%s' "$reseated" | jq -r '.members[] | select(.user_id == "'"$user_one"'") | .team_index')" = '0'
test "$(printf '%s' "$reseated" | jq -r '.members[] | select(.user_id == "'"$user_one"'") | .seat_index')" = '1'
test "$(printf '%s' "$reseated" | jq -r '[.members[].ready] | all(. == false)')" = 'true'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select seated from app_private.pvp_lobby_members limit 1;" \
  >/tmp/pvp-seat-private.out 2>/tmp/pvp-seat-private.err; then
  echo 'Authenticated browser role unexpectedly read private lobby seating state.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/pvp-seat-private.err

echo 'PvP lobby seating authority regression checks passed.'
