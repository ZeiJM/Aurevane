#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

journal_table="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select (to_regclass('app_private.battle_privacy_journal') is not null)::text;")"
test "$journal_table" = 'true'

journal_rpc="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select (to_regprocedure('public.commit_battle_intent_v3(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb,jsonb)') is not null)::text;")"
test "$journal_rpc" = 'true'

privileges="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_table_privilege('anon','app_private.battle_privacy_journal','SELECT')::text || '|' ||
    has_table_privilege('authenticated','app_private.battle_privacy_journal','SELECT')::text || '|' ||
    has_function_privilege('anon','public.commit_battle_intent_v3(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb,jsonb)','EXECUTE')::text || '|' ||
    has_function_privilege('authenticated','public.commit_battle_intent_v3(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb,jsonb)','EXECUTE')::text || '|' ||
    has_function_privilege('service_role','public.commit_battle_intent_v3(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb,jsonb)','EXECUTE')::text;")"
test "$privileges" = 'false|false|false|false|true'

# Reuse one test-owned character created by the earlier battle-session authority regression,
# but create a dedicated modern snapshot so command-start actor/team provenance is explicit.
seed="$(docker exec "$db_container" psql -U postgres -d postgres -AtF '|' -c "
  select p.user_id::text, p.character_id::text, p.combatant_id
  from app_private.battle_participants p
  join app_private.battle_sessions s on s.id = p.battle_session_id
  where p.participant_role = 'player'
    and p.user_id is not null
    and p.character_id is not null
  order by s.created_at asc
  limit 1;")"
test -n "$seed"
IFS='|' read -r user_id character_id player_combatant <<< "$seed"
test -n "$user_id"
test -n "$character_id"
test -n "$player_combatant"

battle_id="battle:csr0-privacy-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
opponent_combatant='recruit:csr0-privacy-probe'
initial_snapshot="$(jq -cn \
  --arg battle_id "$battle_id" \
  --arg player "$player_combatant" \
  --arg opponent "$opponent_combatant" \
  '{
    tactical: {
      battle: {
        battleId: $battle_id,
        rulesVersion: 1,
        contentVersion: 1,
        lifecycle: "active",
        turnNumber: 1,
        currentTurn: { combatantId: $player },
        combatants: [
          { id: $player, teamId: "players" },
          { id: $opponent, teamId: "opponents" }
        ]
      }
    }
  }')"
participants="$(jq -cn \
  --arg player "$player_combatant" \
  --arg opponent "$opponent_combatant" \
  --arg character_id "$character_id" \
  '[
    { combatant_id: $player, participant_role: "player", character_id: $character_id },
    { combatant_id: $opponent, participant_role: "opponent", character_id: null }
  ]')"

session_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select battle_session_id::text
  from public.create_battle_session_v1(
    'user:$user_id',
    '00000000-0000-4000-8000-00000000c100'::uuid,
    'csr0:privacy:create',
    '$user_id'::uuid,
    '$battle_id',
    1,
    1,
    '$initial_snapshot'::jsonb,
    '$participants'::jsonb
  );")"
test -n "$session_id"

# Version 1 predates any committed command and therefore has no privacy row. More generally,
# old pre-CSR history remains readable because absence of a journal row means legacy/public.
legacy_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*)
  from app_private.battle_privacy_journal
  where battle_session_id = '$session_id'::uuid and battle_version = 1;")"
test "$legacy_count" = '0'

next_snapshot="$(printf '%s' "$initial_snapshot" | jq -c '.tactical.battle.turnNumber = 2')"
events='[{"event":"csr0_privacy_probe"}]'

commit_v3() {
  local idempotency_key="$1"
  local fingerprint="$2"
  local expected_version="$3"
  local snapshot="$4"
  local privacy_json="$5"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select battle_session_id::text || '|' || battle_version::text || '|' || replayed::text
    from public.commit_battle_intent_v3(
      'user:$user_id',
      '$idempotency_key'::uuid,
      '$fingerprint',
      '$user_id'::uuid,
      '$session_id'::uuid,
      '$expected_version'::bigint,
      '$snapshot'::jsonb,
      '$events'::jsonb,
      $privacy_json
    );"
}

commit_key='00000000-0000-4000-8000-00000000c110'
first_commit="$(commit_v3 "$commit_key" 'csr0:privacy:commit' 1 "$next_snapshot" 'null::jsonb')"
replay_commit="$(commit_v3 "$commit_key" 'csr0:privacy:commit' 1 "$next_snapshot" 'null::jsonb')"
test "$(printf '%s' "$first_commit" | cut -d'|' -f2-3)" = '2|false'
test "$(printf '%s' "$replay_commit" | cut -d'|' -f2-3)" = '2|true'

journal_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*)
  from app_private.battle_privacy_journal
  where battle_session_id = '$session_id'::uuid and battle_version = 2;")"
test "$journal_count" = '1'

journal_payload="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select journal::text
  from app_private.battle_privacy_journal
  where battle_session_id = '$session_id'::uuid and battle_version = 2;")"
printf '%s' "$journal_payload" | jq -e \
  --arg player "$player_combatant" \
  '.schemaVersion == 1
   and .actorCombatantId == $player
   and .actorTeamId == "players"
   and .commandVisibility == {kind:"public"}
   and .eventVisibilityOverrides == []
   and .eventCount == 1' >/dev/null

# Invalid event-level visibility must roll back the inner v2 mutation as well as the journal.
invalid_privacy="$(jq -cn '{
  schemaVersion: 1,
  commandVisibility: {kind:"public"},
  eventVisibilityOverrides: [
    {eventIndex: 1, visibility: {kind:"team-only", teamId:"players"}}
  ]
}')"
third_snapshot="$(printf '%s' "$next_snapshot" | jq -c '.tactical.battle.turnNumber = 3')"
if commit_v3 \
  '00000000-0000-4000-8000-00000000c111' \
  'csr0:privacy:invalid-override' \
  2 \
  "$third_snapshot" \
  "'$invalid_privacy'::jsonb" \
  >/tmp/csr0-privacy-invalid.out 2>/tmp/csr0-privacy-invalid.err; then
  echo 'Expected invalid privacy visibility metadata to fail.' >&2
  exit 1
fi
grep -Fq 'BATTLE_PRIVACY_JOURNAL_INVALID' /tmp/csr0-privacy-invalid.err

atomic_counts="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    s.current_version::text || '|' ||
    (select count(*) from app_private.battle_snapshots snap where snap.battle_session_id = s.id)::text || '|' ||
    (select count(*) from app_private.battle_events e where e.battle_session_id = s.id)::text || '|' ||
    (select count(*) from app_private.battle_privacy_journal j where j.battle_session_id = s.id)::text
  from app_private.battle_sessions s
  where s.id = '$session_id'::uuid;")"
test "$atomic_counts" = '2|2|1|1'

# Existing player event reads stay journal-blind. CSR-0 adds no browser-facing provenance fields.
participant_leak_count="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)
  from public.get_battle_events_v3('$user_id'::uuid, '$session_id'::uuid, 100, null, null) e
  where to_jsonb(e) ?| array[
    'journal',
    'privacy_journal',
    'commandVisibility',
    'eventVisibilityOverrides'
  ];")"
test "$participant_leak_count" = '0'

participant_result_shape="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select pg_get_function_result(
    'public.get_battle_events_v3(uuid,uuid,integer,bigint,integer)'::regprocedure
  );")"
pvp_result_shape="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select pg_get_function_result(
    'public.list_pvp_battle_events_v2(uuid,uuid,integer,bigint,integer)'::regprocedure
  );")"
test "$participant_result_shape" = 'TABLE(battle_version bigint, event_index integer, event jsonb, created_at timestamp with time zone)'
test "$pvp_result_shape" = 'TABLE(battle_version bigint, event_index integer, event jsonb, created_at timestamp with time zone)'
