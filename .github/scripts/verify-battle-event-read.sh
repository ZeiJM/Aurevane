#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

api_url="$TEST_AUTH_API_URL"
server_key="$TEST_AUTH_ADMIN_KEY"
password='P25-battle-log-security-2026!'
email_one="p25-log-one-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
email_two="p25-log-two-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

signup_one="$(signup_test_user "$email_one" "$password")"
signup_two="$(signup_test_user "$email_two" "$password")"
user_one="$(printf '%s' "$signup_one" | jq -r '.user.id')"
user_two="$(printf '%s' "$signup_two" | jq -r '.user.id')"
test -n "$user_one"
test -n "$user_two"

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

character_one="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select id::text
  from public.create_base_character_v1(
    '$user_one'::uuid,
    '00000000-0000-4000-8000-000000002501'::uuid,
    'p25:event-read:character',
    1,
    'P25 Log Wayfarer',
    'p25logwayfarer',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    6, 6, 6, 6
  );")"
test -n "$character_one"

battle_id='battle:p2-5-event-read-regression'
player_combatant="character:$character_one"
snapshot_one="$(jq -cn \
  --arg battle_id "$battle_id" \
  --arg player "$player_combatant" \
  '{
    tactical: {
      battle: {
        battleId: $battle_id,
        rulesVersion: 1,
        contentVersion: 1,
        lifecycle: "active",
        rng: { algorithm: "xorshift32-v1", seed: 11, state: 11, draws: 0 },
        combatants: [
          { id: $player },
          { id: "recruit:p2-4-1" }
        ]
      }
    }
  }')"
participants="$(jq -cn \
  --arg player "$player_combatant" \
  --arg character_id "$character_one" \
  '[
    { combatant_id: $player, participant_role: "player", character_id: $character_id },
    { combatant_id: "recruit:p2-4-1", participant_role: "opponent", character_id: null }
  ]')"

session_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select battle_session_id::text
  from public.create_battle_session_v1(
    'user:$user_one',
    '00000000-0000-4000-8000-000000002510'::uuid,
    'p25:event-read:create',
    '$user_one'::uuid,
    '$battle_id',
    1,
    1,
    '$snapshot_one'::jsonb,
    '$participants'::jsonb
  );")"
test -n "$session_id"

snapshot_two="$(printf '%s' "$snapshot_one" | jq -c '.tactical.battle.turnNumber = 2')"
events_two="$(jq -cn --arg player "$player_combatant" '[{
  event: "combatant_moved",
  combatantId: $player,
  from: { x: 0, y: 1 },
  to: { x: 1, y: 1 },
  movementCost: 1
}]')"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select battle_version
  from public.commit_battle_intent_v1(
    'user:$user_one',
    '00000000-0000-4000-8000-000000002520'::uuid,
    'p25:event-read:commit',
    '$user_one'::uuid,
    '$session_id'::uuid,
    1,
    '$snapshot_two'::jsonb,
    '$events_two'::jsonb
  );" >/tmp/p25-event-commit.out

grep -Fxq '2' /tmp/p25-event-commit.out

own_read="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select battle_version::text || '|' || event_index::text || '|' || (event ->> 'event')
  from public.get_battle_events_v1('$user_one'::uuid, '$session_id'::uuid, 50);")"
test "$own_read" = '2|0|combatant_moved'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.get_battle_events_v1('$user_two'::uuid, '$session_id'::uuid, 50);" \
  >/tmp/p25-event-cross.out 2>/tmp/p25-event-cross.err; then
  echo 'Expected cross-user battle event read to fail.' >&2
  exit 1
fi
grep -Fq 'BATTLE_NOT_AVAILABLE' /tmp/p25-event-cross.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.get_battle_events_v1('$user_one'::uuid, '$session_id'::uuid, 50);" \
  >/tmp/p25-event-auth.out 2>/tmp/p25-event-auth.err; then
  echo 'Authenticated browser role unexpectedly executed battle event read RPC.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/p25-event-auth.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.get_battle_events_v1('$user_one'::uuid, '$session_id'::uuid, 0);" \
  >/tmp/p25-event-limit.out 2>/tmp/p25-event-limit.err; then
  echo 'Expected invalid battle event read limit to fail.' >&2
  exit 1
fi
grep -Fq 'BATTLE_EVENT_LIMIT_INVALID' /tmp/p25-event-limit.err

privileges="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_function_privilege('anon','public.get_battle_events_v1(uuid,uuid,integer)','EXECUTE')::text || '|' ||
    has_function_privilege('authenticated','public.get_battle_events_v1(uuid,uuid,integer)','EXECUTE')::text || '|' ||
    has_function_privilege('service_role','public.get_battle_events_v1(uuid,uuid,integer)','EXECUTE')::text || '|' ||
    has_table_privilege('anon','app_private.battle_events','SELECT')::text || '|' ||
    has_table_privilege('authenticated','app_private.battle_events','SELECT')::text;")"
test "$privileges" = 'false|false|true|false|false'
