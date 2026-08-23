#!/usr/bin/env bash
set -euo pipefail

status_env="$(pnpm exec supabase status -o env)"
eval "$(printf '%s\n' "$status_env" | grep '^ANON_KEY=')"
test -n "${ANON_KEY:-}"

api_url='http://127.0.0.1:54321'
password='PVP-spectator-join-2026!'
email="pvp-spectator-join-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

signup="$(curl --fail-with-body --silent --show-error \
  --request POST "$api_url/auth/v1/signup" \
  --header "apikey: $ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data "{\"email\":\"$email\",\"password\":\"$password\"}")"
spectator_user="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$spectator_user"

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

battle_row="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select b.id::text || '|' || l.battle_key
  from app_private.battle_sessions b
  join app_private.pvp_lobbies l on l.battle_session_id = b.id
  where b.battle_id = 'battle:pvp-authority-regression'
  order by b.created_at desc
  limit 1;")"
test -n "$battle_row"

session_id="${battle_row%%|*}"
battle_key="${battle_row##*|}"
test -n "$session_id"
[[ "$battle_key" =~ ^AVB-[A-F0-9]{4}-[A-F0-9]{4}$ ]]

lower_key="$(printf '%s' "$battle_key" | tr '[:upper:]' '[:lower:]')"

join_spectator() {
  local key="$1"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select battle_session_id::text
    from public.join_pvp_spectator_v1(
      '$spectator_user'::uuid,
      '$key'
    );"
}

# First call verifies normalized-key lookup. The second call reaches the presence upsert conflict
# path that previously failed because battle_session_id was ambiguous inside PL/pgSQL.
first_join="$(join_spectator "  $lower_key  ")"
second_join="$(join_spectator "$battle_key")"
test "$first_join" = "$session_id"
test "$second_join" = "$session_id"

state_count="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)
  from app_private.pvp_active_spectating s
  where s.user_id = '$spectator_user'::uuid
    and s.battle_session_id = '$session_id'::uuid;")"
presence_count="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)
  from app_private.pvp_battle_spectator_presence p
  where p.user_id = '$spectator_user'::uuid
    and p.battle_session_id = '$session_id'::uuid;")"
test "$state_count" = '1'
test "$presence_count" = '1'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.join_pvp_spectator_v1(
    '$spectator_user'::uuid,
    '$battle_key'
  );" >/tmp/pvp-browser-spectator-join.out 2>/tmp/pvp-browser-spectator-join.err; then
  echo 'Authenticated browser role unexpectedly executed PvP spectator join.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/pvp-browser-spectator-join.err

echo 'PvP spectator join regression checks passed.'
