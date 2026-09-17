#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

history_rpc="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select (to_regprocedure('public.get_battle_history_privacy_v1(uuid,uuid,bigint[])') is not null)::text;")"
test "$history_rpc" = 'true'

history_privileges="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_function_privilege('anon','public.get_battle_history_privacy_v1(uuid,uuid,bigint[])','EXECUTE')::text || '|' ||
    has_function_privilege('authenticated','public.get_battle_history_privacy_v1(uuid,uuid,bigint[])','EXECUTE')::text || '|' ||
    has_function_privilege('service_role','public.get_battle_history_privacy_v1(uuid,uuid,bigint[])','EXECUTE')::text;")"
test "$history_privileges" = 'false|false|true'

# The existing CSR-0 regression created one committed version with a journal and deliberately
# left version 1 without a row. CSR-3 must return only the requested private row while deriving
# the participant entitlement from persisted authority.
participant_row="$(docker exec "$db_container" psql -U postgres -d postgres -AtF '|' -c "
  select s.id::text, p.user_id::text, p.combatant_id
  from app_private.battle_sessions s
  join app_private.battle_participants p on p.battle_session_id = s.id
  where s.battle_id = 'battle:csr0-privacy-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}'
    and p.user_id is not null
  limit 1;")"
test -n "$participant_row"
IFS='|' read -r participant_session participant_user participant_combatant <<< "$participant_row"
test -n "$participant_session"
test -n "$participant_user"
test -n "$participant_combatant"

participant_authority="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -AtF '|' -c "
  set role service_role;
  select
    viewer_kind,
    array_to_string(controlled_combatant_ids, ','),
    jsonb_array_length(journals)::text,
    coalesce(journals -> 0 ->> 'battleVersion', '')
  from public.get_battle_history_privacy_v1(
    '$participant_user'::uuid,
    '$participant_session'::uuid,
    array[1, 2]::bigint[]
  );")"
test "$participant_authority" = "participant|$participant_combatant|1|2"

# Browser roles never receive direct access to private history provenance.
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select *
  from public.get_battle_history_privacy_v1(
    '$participant_user'::uuid,
    '$participant_session'::uuid,
    array[1, 2]::bigint[]
  );" >/tmp/csr3-browser-history-privacy.out 2>/tmp/csr3-browser-history-privacy.err; then
  echo 'Authenticated browser role unexpectedly executed CSR-3 private history authority.' >&2
  exit 1
fi
grep -Eqi 'permission denied|not allowed' /tmp/csr3-browser-history-privacy.err

# The earlier spectator-join regression leaves one active spectator presence row. CSR-3 treats
# that viewer as explicitly unprivileged and allows the existing generic event page RPC to serve
# raw history only to the server, preserving its browser-facing result shape.
spectator_email="pvp-spectator-join-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
spectator_row="$(docker exec "$db_container" psql -U postgres -d postgres -AtF '|' -c "
  select u.id::text, active.battle_session_id::text
  from auth.users u
  join app_private.pvp_active_spectating active on active.user_id = u.id
  where u.email = '$spectator_email'
  order by active.updated_at desc
  limit 1;")"
test -n "$spectator_row"
IFS='|' read -r spectator_user spectator_session <<< "$spectator_row"
test -n "$spectator_user"
test -n "$spectator_session"

spectator_authority="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -AtF '|' -c "
  set role service_role;
  select viewer_kind, cardinality(controlled_combatant_ids)::text
  from public.get_battle_history_privacy_v1(
    '$spectator_user'::uuid,
    '$spectator_session'::uuid,
    array[1]::bigint[]
  );")"
test "$spectator_authority" = 'spectator|0'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)
  from public.get_battle_events_v3(
    '$spectator_user'::uuid,
    '$spectator_session'::uuid,
    1,
    null,
    null
  );" >/dev/null

participant_result_shape="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select pg_get_function_result(
    'public.get_battle_events_v3(uuid,uuid,integer,bigint,integer)'::regprocedure
  );")"
test "$participant_result_shape" = 'TABLE(battle_version bigint, event_index integer, event jsonb, created_at timestamp with time zone)'

echo 'CSR-3 battle history privacy authority checks passed.'
