#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

session_row="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select id::text || '|' || owner_user_id::text || '|' || current_version::text
  from app_private.battle_sessions
  where battle_id = 'battle:p2-4-db-regression';")"

session_id="${session_row%%|*}"
rest="${session_row#*|}"
owner_user_id="${rest%%|*}"
current_version="${session_row##*|}"

test -n "$session_id"
test -n "$owner_user_id"
test "$current_version" = '2'

snapshot_two="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select current_snapshot::text
  from app_private.battle_sessions
  where id = '$session_id'::uuid;")"
snapshot_three="$(printf '%s' "$snapshot_two" | jq -c '.tactical.battle.turnNumber = 3')"

commit_concurrent() {
  local idempotency_key="$1"
  local fingerprint="$2"
  local event_name="$3"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select battle_session_id::text || '|' || battle_version::text || '|' || replayed::text
    from public.commit_battle_intent_v1(
      'user:$owner_user_id',
      '$idempotency_key'::uuid,
      '$fingerprint',
      '$owner_user_id'::uuid,
      '$session_id'::uuid,
      2,
      '$snapshot_three'::jsonb,
      '[{\"event\":\"$event_name\"}]'::jsonb
    );"
}

key_a='00000000-0000-4000-8000-000000002430'
key_b='00000000-0000-4000-8000-000000002431'
fingerprint_a='p24:battle:concurrent:a'
fingerprint_b='p24:battle:concurrent:b'

(
  set +e
  commit_concurrent "$key_a" "$fingerprint_a" 'concurrent_a' \
    >/tmp/p24-concurrent-a.out 2>/tmp/p24-concurrent-a.err
  printf '%s' "$?" >/tmp/p24-concurrent-a.status
) &
pid_a=$!

(
  set +e
  commit_concurrent "$key_b" "$fingerprint_b" 'concurrent_b' \
    >/tmp/p24-concurrent-b.out 2>/tmp/p24-concurrent-b.err
  printf '%s' "$?" >/tmp/p24-concurrent-b.status
) &
pid_b=$!

wait "$pid_a" || true
wait "$pid_b" || true

status_a="$(cat /tmp/p24-concurrent-a.status)"
status_b="$(cat /tmp/p24-concurrent-b.status)"

if [ "$status_a" = '0' ] && [ "$status_b" = '0' ]; then
  echo 'Both concurrent battle intents committed; expected one stale loser.' >&2
  exit 1
fi
if [ "$status_a" != '0' ] && [ "$status_b" != '0' ]; then
  echo 'Both concurrent battle intents failed; expected one authoritative winner.' >&2
  cat /tmp/p24-concurrent-a.err >&2 || true
  cat /tmp/p24-concurrent-b.err >&2 || true
  exit 1
fi

if [ "$status_a" = '0' ]; then
  winner_key="$key_a"
  winner_fingerprint="$fingerprint_a"
  winner_event='concurrent_a'
  winner_out="$(cat /tmp/p24-concurrent-a.out)"
  loser_err='/tmp/p24-concurrent-b.err'
else
  winner_key="$key_b"
  winner_fingerprint="$fingerprint_b"
  winner_event='concurrent_b'
  winner_out="$(cat /tmp/p24-concurrent-b.out)"
  loser_err='/tmp/p24-concurrent-a.err'
fi

test "$(printf '%s' "$winner_out" | cut -d'|' -f1)" = "$session_id"
test "$(printf '%s' "$winner_out" | cut -d'|' -f2)" = '3'
test "$(printf '%s' "$winner_out" | cut -d'|' -f3)" = 'false'
grep -Fq 'BATTLE_VERSION_STALE:3' "$loser_err"

replay="$(commit_concurrent "$winner_key" "$winner_fingerprint" "$winner_event")"
test "$(printf '%s' "$replay" | cut -d'|' -f1)" = "$session_id"
test "$(printf '%s' "$replay" | cut -d'|' -f2)" = '3'
test "$(printf '%s' "$replay" | cut -d'|' -f3)" = 'true'

state_summary="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    s.current_version::text || '|' ||
    (select count(*) from app_private.battle_snapshots snap where snap.battle_session_id = s.id)::text || '|' ||
    (select count(*) from app_private.battle_events e where e.battle_session_id = s.id)::text || '|' ||
    (s.current_snapshot = head.snapshot)::text
  from app_private.battle_sessions s
  join app_private.battle_snapshots head
    on head.battle_session_id = s.id and head.battle_version = s.current_version
  where s.id = '$session_id'::uuid;")"
test "$state_summary" = '3|3|2|true'

snapshot_versions="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select string_agg(battle_version::text, ',' order by battle_version)
  from app_private.battle_snapshots
  where battle_session_id = '$session_id'::uuid;")"
test "$snapshot_versions" = '1,2,3'

event_history="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select string_agg(
    battle_version::text || ':' || (event ->> 'event'),
    ','
    order by battle_version, event_index
  )
  from app_private.battle_events
  where battle_session_id = '$session_id'::uuid;")"
test "$event_history" = "2:turn_ended,3:$winner_event"
