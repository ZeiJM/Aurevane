#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

api_url="$TEST_AUTH_API_URL"
server_key="$TEST_AUTH_ADMIN_KEY"
password='PVP-authority-2026!'
email_one="pvp-authority-one-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
email_two="pvp-authority-two-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

signup_one="$(signup_test_user "$email_one" "$password")"
signup_two="$(signup_test_user "$email_two" "$password")"
user_one="$(printf '%s' "$signup_one" | jq -r '.user.id')"
user_two="$(printf '%s' "$signup_two" | jq -r '.user.id')"

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
  '00000000-0000-4000-8000-000000003001' \
  'pvp-authority:character:one' \
  'PvP Arlen' \
  'pvparlen')"
character_two="$(create_character \
  "$user_two" \
  '00000000-0000-4000-8000-000000003002' \
  'pvp-authority:character:two' \
  'PvP Sera' \
  'pvpsera')"

test -n "$character_one"
test -n "$character_two"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select public.create_pvp_lobby_v1(
    '$user_one'::uuid,
    '$character_one'::uuid,
    '1v1',
    null,
    null
  );" >/tmp/pvp-browser-create.out 2>/tmp/pvp-browser-create.err; then
  echo 'Authenticated browser role unexpectedly executed PvP lobby creation.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/pvp-browser-create.err

lobby_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.create_pvp_lobby_v1(
    '$user_one'::uuid,
    '$character_one'::uuid,
    '1v1',
    null,
    null
  )::text;")"
test -n "$lobby_id"

lobby_one="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_lobby_v1('$user_one'::uuid, '$lobby_id'::uuid)::text;")"
lobby_key="$(printf '%s' "$lobby_one" | jq -r '.lobby_key')"
test "$(printf '%s' "$lobby_one" | jq -r '.mode')" = '1v1'
test "$(printf '%s' "$lobby_one" | jq -r '.members | length')" = '1'
test "$(printf '%s' "$lobby_one" | jq -r '.ready_to_start')" = 'false'
[[ "$lobby_key" =~ ^AVL-[A-F0-9]{4}-[A-F0-9]{4}$ ]]

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -qc "
  set role service_role;
  select public.set_pvp_lobby_ready_v1('$user_one'::uuid, '$lobby_id'::uuid, true);"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -qc "
  set role service_role;
  select public.join_pvp_lobby_v1(
    '$user_two'::uuid,
    '$character_two'::uuid,
    '$lobby_key'
  );"

lobby_joined="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_lobby_v1('$user_one'::uuid, '$lobby_id'::uuid)::text;")"
test "$(printf '%s' "$lobby_joined" | jq -r '.members | length')" = '2'
test "$(printf '%s' "$lobby_joined" | jq -r '.members[] | select(.user_id == "'"$user_one"'") | .ready')" = 'true'
test "$(printf '%s' "$lobby_joined" | jq -r '.members[] | select(.user_id == "'"$user_two"'") | .ready')" = 'false'
test "$(printf '%s' "$lobby_joined" | jq -r '.members[] | select(.user_id == "'"$user_two"'") | .team_index')" = '1'

for user_id in "$user_one" "$user_two"; do
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -qc "
    set role service_role;
    select public.set_pvp_lobby_ready_v1('$user_id'::uuid, '$lobby_id'::uuid, true);"
done

lobby_ready="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_lobby_v1('$user_two'::uuid, '$lobby_id'::uuid)::text;")"
test "$(printf '%s' "$lobby_ready" | jq -r '.ready_to_start')" = 'true'

battle_id='battle:pvp-authority-regression'
combatant_one="character:$character_one"
combatant_two="character:$character_two"

snapshot="$(jq -cn \
  --arg battle_id "$battle_id" \
  --arg combatant_one "$combatant_one" \
  --arg combatant_two "$combatant_two" \
  '{
    tactical: {
      battle: {
        battleId: $battle_id,
        rulesVersion: 1,
        contentVersion: 1,
        lifecycle: "active",
        rng: { algorithm: "xorshift32-v1", seed: 7, state: 7, draws: 0 },
        combatants: [
          { id: $combatant_one, teamId: "team:0" },
          { id: $combatant_two, teamId: "team:1" }
        ]
      }
    }
  }')"

participants="$(jq -cn \
  --arg combatant_one "$combatant_one" \
  --arg combatant_two "$combatant_two" \
  --arg user_one "$user_one" \
  --arg user_two "$user_two" \
  --arg character_one "$character_one" \
  --arg character_two "$character_two" \
  '[
    {
      combatant_id: $combatant_one,
      user_id: $user_one,
      character_id: $character_one,
      team_index: 0
    },
    {
      combatant_id: $combatant_two,
      user_id: $user_two,
      character_id: $character_two,
      team_index: 1
    }
  ]')"

create_pvp_battle() {
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select battle_session_id::text || '|' || battle_version::text || '|' || battle_key
    from public.create_pvp_battle_session_v1(
      '$user_one'::uuid,
      '$lobby_id'::uuid,
      '$battle_id',
      1,
      1,
      '$snapshot'::jsonb,
      '$participants'::jsonb
    );"
}

first_battle="$(create_pvp_battle)"
replayed_battle="$(create_pvp_battle)"
session_id="${first_battle%%|*}"
first_tail="${first_battle#*|}"
first_version="${first_tail%%|*}"
battle_key="${first_battle##*|}"
replay_session_id="${replayed_battle%%|*}"
replay_battle_key="${replayed_battle##*|}"

test -n "$session_id"
test "$first_version" = '1'
test "$session_id" = "$replay_session_id"
test "$battle_key" = "$replay_battle_key"
[[ "$battle_key" =~ ^AVB-[A-F0-9]{4}-[A-F0-9]{4}$ ]]

meta_one="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_battle_metadata_v1('$user_one'::uuid, '$session_id'::uuid)::text;")"
meta_two="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_battle_metadata_v1('$user_two'::uuid, '$session_id'::uuid)::text;")"

test "$(printf '%s' "$meta_one" | jq -r '.local_character_id')" = "$character_one"
test "$(printf '%s' "$meta_two" | jq -r '.local_character_id')" = "$character_two"
test "$(printf '%s' "$meta_one" | jq -r '.participants | length')" = '2'
test "$(printf '%s' "$meta_two" | jq -r '.participants | length')" = '2'

outsider_meta="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_battle_metadata_v1(
    '00000000-0000-4000-8000-000000009999'::uuid,
    '$session_id'::uuid
  )::text;")"
test -z "$outsider_meta"

spectator_view="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_spectator_view_v1('$battle_key')::text;")"
test "$(printf '%s' "$spectator_view" | jq -r '.battle_session_id')" = "$session_id"
test "$(printf '%s' "$spectator_view" | jq -r '.battle_key')" = "$battle_key"
test "$(printf '%s' "$spectator_view" | jq -r '.participants | length')" = '2'
test "$(printf '%s' "$spectator_view" | jq -r '.lifecycle')" = 'active'

completed_snapshot="$(printf '%s' "$snapshot" | jq -c '.tactical.battle.lifecycle = "completed"')"
completion_result="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select battle_session_id::text || '|' || battle_version::text || '|' || replayed::text
  from public.commit_battle_intent_v2(
    'user:$user_one',
    '00000000-0000-4000-8000-000000003010'::uuid,
    'pvp-authority:battle:complete',
    '$user_one'::uuid,
    '$session_id'::uuid,
    1,
    '$completed_snapshot'::jsonb,
    '[{\"event\":\"battle_completed\"}]'::jsonb
  );")"
test "$(printf '%s' "$completion_result" | cut -d'|' -f1)" = "$session_id"
test "$(printf '%s' "$completion_result" | cut -d'|' -f2)" = '2'
test "$(printf '%s' "$completion_result" | cut -d'|' -f3)" = 'false'

lobby_status="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select status from app_private.pvp_lobbies where id = '$lobby_id'::uuid;")"
test "$lobby_status" = 'completed'

completed_spectator="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_spectator_view_v1('$battle_key')::text;")"
test "$(printf '%s' "$completed_spectator" | jq -r '.lifecycle')" = 'completed'
test "$(printf '%s' "$completed_spectator" | jq -r '.battle_version')" = '2'

missing_spectator="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.get_pvp_spectator_view_v1('AVB-FFFF-FFFF')::text;")"
test -z "$missing_spectator"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select public.get_pvp_spectator_view_v1('$battle_key');" \
  >/tmp/pvp-browser-spectate.out 2>/tmp/pvp-browser-spectate.err; then
  echo 'Authenticated browser role unexpectedly executed PvP spectator RPC.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/pvp-browser-spectate.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select count(*) from app_private.pvp_lobbies;" \
  >/tmp/pvp-browser-table.out 2>/tmp/pvp-browser-table.err; then
  echo 'Authenticated browser role unexpectedly read private PvP lobby storage.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/pvp-browser-table.err

echo 'PvP authority regression checks passed.'
