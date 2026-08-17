#!/usr/bin/env bash
set -euo pipefail

status_env="$(pnpm exec supabase status -o env)"
eval "$(printf '%s\n' "$status_env" | grep '^ANON_KEY=')"
test -n "${ANON_KEY:-}"

api_url='http://127.0.0.1:54321'
password='PV1A-validation-security-2026!'
run_id="${GITHUB_RUN_ID:-local-$(date +%s)}"
run_attempt="${GITHUB_RUN_ATTEMPT:-1}"
email="pv1a-${run_id}-${run_attempt}@example.com"

signup="$(curl --fail-with-body --silent --show-error \
  --request POST "$api_url/auth/v1/signup" \
  --header "apikey: $ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data "{\"email\":\"$email\",\"password\":\"$password\"}")"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$user_id"

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select id::text
  from public.create_base_character_v1(
    '$user_id'::uuid,
    '00000000-0000-4000-8000-000000101001'::uuid,
    'pv1a:character:create',
    1,
    'PV1A Wayfarer',
    'pv1awayfarer',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    6, 6, 6, 6
  );")"
test -n "$character_id"

create_battle() {
  local battle_id="$1"
  local opponent_id="$2"
  local idempotency_key="$3"
  local fingerprint="$4"
  local player_combatant="character:$character_id"
  local snapshot
  local participants

  snapshot="$(jq -cn \
    --arg battle_id "$battle_id" \
    --arg player "$player_combatant" \
    --arg opponent "$opponent_id" \
    '{
      tactical: {
        battle: {
          battleId: $battle_id,
          rulesVersion: 1,
          contentVersion: 1,
          lifecycle: "active",
          rng: { algorithm: "xorshift32-v1", seed: 17, state: 17, draws: 0 },
          combatants: [
            { id: $player },
            { id: $opponent }
          ]
        }
      }
    }')"

  participants="$(jq -cn \
    --arg player "$player_combatant" \
    --arg opponent "$opponent_id" \
    --arg character_id "$character_id" \
    '[
      { combatant_id: $player, participant_role: "player", character_id: $character_id },
      { combatant_id: $opponent, participant_role: "opponent", character_id: null }
    ]')"

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

commit_lifecycle() {
  local session_id="$1"
  local battle_id="$2"
  local opponent_id="$3"
  local expected_version="$4"
  local lifecycle="$5"
  local idempotency_key="$6"
  local fingerprint="$7"
  local player_combatant="character:$character_id"
  local snapshot
  local events

  snapshot="$(jq -cn \
    --arg battle_id "$battle_id" \
    --arg player "$player_combatant" \
    --arg opponent "$opponent_id" \
    --arg lifecycle "$lifecycle" \
    '{
      tactical: {
        battle: {
          battleId: $battle_id,
          rulesVersion: 1,
          contentVersion: 1,
          lifecycle: $lifecycle,
          rng: { algorithm: "xorshift32-v1", seed: 17, state: 17, draws: 0 },
          combatants: [
            { id: $player },
            { id: $opponent }
          ]
        }
      }
    }')"
  events="$(jq -cn --arg lifecycle "$lifecycle" '[{event: "pv1a_lifecycle_probe", lifecycle: $lifecycle}]')"

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

battle_one='battle:pv1a-validation-one'
opponent_one='recruit:pv1a-one'
create_one="$(create_battle \
  "$battle_one" \
  "$opponent_one" \
  '00000000-0000-4000-8000-000000101010' \
  'pv1a:battle:create:one')"
session_one="${create_one%%|*}"
test -n "$session_one"
test "${create_one##*|}" = 'false'

start_count="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)
  from app_private.product_validation_events
  where user_id = '$user_id'::uuid
    and event_name = 'first_combat_started';")"
test "$start_count" = '1'

# A second authoritative battle must not duplicate the per-user first-start event.
battle_two='battle:pv1a-validation-two'
opponent_two='recruit:pv1a-two'
create_two="$(create_battle \
  "$battle_two" \
  "$opponent_two" \
  '00000000-0000-4000-8000-000000101011' \
  'pv1a:battle:create:two')"
session_two="${create_two%%|*}"
test -n "$session_two"

start_count_after_second="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)
  from app_private.product_validation_events
  where user_id = '$user_id'::uuid
    and event_name = 'first_combat_started';")"
test "$start_count_after_second" = '1'

complete_key='00000000-0000-4000-8000-000000101020'
complete_one="$(commit_lifecycle \
  "$session_one" \
  "$battle_one" \
  "$opponent_one" \
  1 \
  'completed' \
  "$complete_key" \
  'pv1a:battle:complete:one')"
test "$(printf '%s' "$complete_one" | cut -d'|' -f2)" = '2'
test "${complete_one##*|}" = 'false'

# Replaying the same authoritative commit must not duplicate telemetry.
complete_replay="$(commit_lifecycle \
  "$session_one" \
  "$battle_one" \
  "$opponent_one" \
  1 \
  'completed' \
  "$complete_key" \
  'pv1a:battle:complete:one')"
test "${complete_replay##*|}" = 'true'

completion_count="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)
  from app_private.product_validation_events
  where user_id = '$user_id'::uuid
    and event_name = 'first_combat_completed';")"
test "$completion_count" = '1'

abandon_key='00000000-0000-4000-8000-000000101021'
abandon_two="$(commit_lifecycle \
  "$session_two" \
  "$battle_two" \
  "$opponent_two" \
  1 \
  'abandoned' \
  "$abandon_key" \
  'pv1a:battle:abandon:two')"
test "$(printf '%s' "$abandon_two" | cut -d'|' -f2)" = '2'
test "${abandon_two##*|}" = 'false'

abandon_replay="$(commit_lifecycle \
  "$session_two" \
  "$battle_two" \
  "$opponent_two" \
  1 \
  'abandoned' \
  "$abandon_key" \
  'pv1a:battle:abandon:two')"
test "${abandon_replay##*|}" = 'true'

abandon_count="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)
  from app_private.product_validation_events
  where user_id = '$user_id'::uuid
    and battle_session_id = '$session_two'::uuid
    and event_name = 'combat_abandoned';")"
test "$abandon_count" = '1'

# A later completion still leaves only the first completion event for this user.
battle_three='battle:pv1a-validation-three'
opponent_three='recruit:pv1a-three'
create_three="$(create_battle \
  "$battle_three" \
  "$opponent_three" \
  '00000000-0000-4000-8000-000000101012' \
  'pv1a:battle:create:three')"
session_three="${create_three%%|*}"
test -n "$session_three"
commit_lifecycle \
  "$session_three" \
  "$battle_three" \
  "$opponent_three" \
  1 \
  'completed' \
  '00000000-0000-4000-8000-000000101022' \
  'pv1a:battle:complete:three' >/dev/null

completion_count_after_second="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)
  from app_private.product_validation_events
  where user_id = '$user_id'::uuid
    and event_name = 'first_combat_completed';")"
test "$completion_count_after_second" = '1'

# Metadata is generated by the server and restricted to the approved stable keys.
unexpected_metadata_keys="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)
  from app_private.product_validation_events e
  where e.user_id = '$user_id'::uuid
    and exists (
      select 1
      from jsonb_object_keys(e.metadata) as metadata_key(key)
      where metadata_key.key not in ('battle_id', 'rules_version', 'content_version', 'battle_version')
    );")"
test "$unexpected_metadata_keys" = '0'

metadata_mismatches="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)
  from app_private.product_validation_events e
  where e.user_id = '$user_id'::uuid
    and (
      e.metadata ->> 'battle_id' is distinct from e.battle_id
      or (e.metadata ->> 'rules_version')::integer is distinct from e.rules_version
      or (e.metadata ->> 'content_version')::integer is distinct from e.content_version
      or (e.metadata ->> 'battle_version')::bigint is distinct from e.battle_version
    );")"
test "$metadata_mismatches" = '0'

# Browser roles cannot inspect or forge private validation events.
privileges="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    has_table_privilege('anon','app_private.product_validation_events','SELECT')::text || '|' ||
    has_table_privilege('anon','app_private.product_validation_events','INSERT')::text || '|' ||
    has_table_privilege('authenticated','app_private.product_validation_events','SELECT')::text || '|' ||
    has_table_privilege('authenticated','app_private.product_validation_events','INSERT')::text || '|' ||
    has_table_privilege('authenticated','app_private.product_validation_events','UPDATE')::text || '|' ||
    has_table_privilege('authenticated','app_private.product_validation_events','DELETE')::text;")"
test "$privileges" = 'false|false|false|false|false|false'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from app_private.product_validation_events limit 1;" \
  >/tmp/pv1a-browser-read.out 2>/tmp/pv1a-browser-read.err; then
  echo 'Authenticated browser role unexpectedly read private validation telemetry.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/pv1a-browser-read.err
