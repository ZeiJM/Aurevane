#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

api_url="$TEST_AUTH_API_URL"
server_key="$TEST_AUTH_ADMIN_KEY"
password='P24-battle-security-2026!'
email_one="p24-battle-one-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
email_two="p24-battle-two-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

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
  '00000000-0000-4000-8000-000000002401' \
  'p24:character:one' \
  'P24 Arlen' \
  'p24arlen')"
character_two="$(create_character \
  "$user_two" \
  '00000000-0000-4000-8000-000000002402' \
  'p24:character:two' \
  'P24 Sera' \
  'p24sera')"

test -n "$character_one"
test -n "$character_two"

battle_id='battle:p2-4-db-regression'
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
        rng: { algorithm: "xorshift32-v1", seed: 7, state: 7, draws: 0 },
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

create_battle() {
  local idempotency_key="$1"
  local fingerprint="$2"
  local user_id="$3"
  local snapshot="$4"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select battle_session_id::text || '|' || battle_version::text || '|' || replayed::text
    from public.create_battle_session_v1(
      'user:$user_id',
      '$idempotency_key'::uuid,
      '$fingerprint',
      '$user_id'::uuid,
      '$battle_id',
      1,
      1,
      '$snapshot'::jsonb,
      '$participants'::jsonb
    );"
}

create_key='00000000-0000-4000-8000-000000002410'
first_create="$(create_battle "$create_key" 'p24:battle:create' "$user_one" "$snapshot_one")"
replay_create="$(create_battle "$create_key" 'p24:battle:create' "$user_one" "$snapshot_one")"

session_id="${first_create%%|*}"
first_create_tail="${first_create#*|}"
first_create_version="${first_create_tail%%|*}"
first_create_replayed="${first_create##*|}"
replay_session_id="${replay_create%%|*}"
replay_create_replayed="${replay_create##*|}"

test -n "$session_id"
test "$session_id" = "$replay_session_id"
test "$first_create_version" = '1'
test "$first_create_replayed" = 'false'
test "$replay_create_replayed" = 'true'

if create_battle "$create_key" 'p24:battle:create:conflict' "$user_one" "$snapshot_one" \
  >/tmp/p24-create-conflict.out 2>/tmp/p24-create-conflict.err; then
  echo 'Expected battle-create idempotency conflict to fail.' >&2
  exit 1
fi
grep -Fq 'BATTLE_IDEMPOTENCY_CONFLICT' /tmp/p24-create-conflict.err

malformed_snapshot="$(printf '%s' "$snapshot_one" | jq -c 'del(.tactical.battle.battleId)')"
if create_battle \
  '00000000-0000-4000-8000-000000002411' \
  'p24:battle:malformed-create' \
  "$user_one" \
  "$malformed_snapshot" \
  >/tmp/p24-malformed-create.out 2>/tmp/p24-malformed-create.err; then
  echo 'Expected malformed initial battle snapshot to fail.' >&2
  exit 1
fi
grep -Eq 'BATTLE_(SNAPSHOT_IDENTITY_MISMATCH|INVALID_SNAPSHOT)' /tmp/p24-malformed-create.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select *
  from public.create_battle_session_v1(
    'user:$user_one',
    '00000000-0000-4000-8000-000000002412'::uuid,
    'p24:browser-create',
    '$user_one'::uuid,
    '$battle_id',
    1,
    1,
    '$snapshot_one'::jsonb,
    '$participants'::jsonb
  );" >/tmp/p24-browser-create.out 2>/tmp/p24-browser-create.err; then
  echo 'Authenticated browser role unexpectedly executed battle creation RPC.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/p24-browser-create.err

cross_read_count="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)
  from public.get_battle_session_v1('$user_two'::uuid, '$session_id'::uuid);")"
test "$cross_read_count" = '0'

snapshot_two="$(printf '%s' "$snapshot_one" | jq -c '.tactical.battle.turnNumber = 2')"
events_two='[{"event":"turn_ended","combatantId":"p24"}]'

commit_battle() {
  local idempotency_key="$1"
  local fingerprint="$2"
  local user_id="$3"
  local expected_version="$4"
  local snapshot="$5"
  local events="$6"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select battle_session_id::text || '|' || battle_version::text || '|' || replayed::text
    from public.commit_battle_intent_v1(
      'user:$user_id',
      '$idempotency_key'::uuid,
      '$fingerprint',
      '$user_id'::uuid,
      '$session_id'::uuid,
      '$expected_version'::bigint,
      '$snapshot'::jsonb,
      '$events'::jsonb
    );"
}

commit_key='00000000-0000-4000-8000-000000002420'
first_commit="$(commit_battle "$commit_key" 'p24:battle:intent:one' "$user_one" 1 "$snapshot_two" "$events_two")"
replay_commit="$(commit_battle "$commit_key" 'p24:battle:intent:one' "$user_one" 1 "$snapshot_two" "$events_two")"

first_commit_tail="${first_commit#*|}"
first_commit_version="${first_commit_tail%%|*}"
first_commit_replayed="${first_commit##*|}"
replay_commit_version="$(printf '%s' "$replay_commit" | cut -d'|' -f2)"
replay_commit_replayed="${replay_commit##*|}"

test "$first_commit_version" = '2'
test "$first_commit_replayed" = 'false'
test "$replay_commit_version" = '2'
test "$replay_commit_replayed" = 'true'

if commit_battle \
  '00000000-0000-4000-8000-000000002421' \
  'p24:battle:intent:stale' \
  "$user_one" \
  1 \
  "$snapshot_two" \
  "$events_two" \
  >/tmp/p24-stale.out 2>/tmp/p24-stale.err; then
  echo 'Expected unused stale battle version to fail.' >&2
  exit 1
fi
grep -Fq 'BATTLE_VERSION_STALE:2' /tmp/p24-stale.err

if commit_battle \
  '00000000-0000-4000-8000-000000002422' \
  'p24:battle:intent:cross-user' \
  "$user_two" \
  2 \
  "$snapshot_two" \
  "$events_two" \
  >/tmp/p24-cross-user.out 2>/tmp/p24-cross-user.err; then
  echo 'Expected cross-user battle mutation to fail.' >&2
  exit 1
fi
grep -Fq 'BATTLE_NOT_AVAILABLE' /tmp/p24-cross-user.err

malformed_commit="$(printf '%s' "$snapshot_two" | jq -c 'del(.tactical.battle.battleId)')"
if commit_battle \
  '00000000-0000-4000-8000-000000002423' \
  'p24:battle:intent:malformed' \
  "$user_one" \
  2 \
  "$malformed_commit" \
  "$events_two" \
  >/tmp/p24-malformed-commit.out 2>/tmp/p24-malformed-commit.err; then
  echo 'Expected malformed committed battle snapshot to fail.' >&2
  exit 1
fi
grep -Eq 'BATTLE_(SNAPSHOT_IDENTITY_MISMATCH|INVALID_SNAPSHOT)' /tmp/p24-malformed-commit.err

if commit_battle \
  "$commit_key" \
  'p24:battle:intent:conflict' \
  "$user_one" \
  1 \
  "$snapshot_two" \
  "$events_two" \
  >/tmp/p24-commit-conflict.out 2>/tmp/p24-commit-conflict.err; then
  echo 'Expected battle-intent idempotency conflict to fail.' >&2
  exit 1
fi
grep -Fq 'BATTLE_IDEMPOTENCY_CONFLICT' /tmp/p24-commit-conflict.err

state_counts="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    s.current_version::text || '|' ||
    (select count(*) from app_private.battle_snapshots snap where snap.battle_session_id = s.id)::text || '|' ||
    (select count(*) from app_private.battle_events e where e.battle_session_id = s.id)::text
  from app_private.battle_sessions s
  where s.id = '$session_id'::uuid;")"
test "$state_counts" = '2|2|1'

privileges="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_table_privilege('anon','app_private.battle_sessions','SELECT')::text || '|' ||
    has_table_privilege('authenticated','app_private.battle_sessions','SELECT')::text || '|' ||
    has_table_privilege('authenticated','app_private.battle_sessions','UPDATE')::text;")"
test "$privileges" = 'false|false|false'
