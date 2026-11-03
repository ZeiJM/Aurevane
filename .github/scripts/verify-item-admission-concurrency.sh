#!/usr/bin/env bash
set -euo pipefail
# Disposable local Supabase only. Two actual PostgreSQL backends, deterministic
# holder RPC completion, observed pg_blocking_pids, and bounded lock waits.
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
sql() { docker exec "$db_container" psql -X -Atq -v ON_ERROR_STOP=1 -U postgres -d postgres -c "$1"; }
race_tmp="$(mktemp -d)"
holder_app="item-race-holder-$$"
writer_app="item-race-writer-$$"
holder_pid=''; writer_pid=''
cleanup() {
  local status=$?
  trap - EXIT
  sql "select pg_terminate_backend(pid) from pg_stat_activity where application_name in ('$holder_app','$writer_app') and pid<>pg_backend_pid();" >/dev/null || true
  if [ -n "$holder_pid" ]; then wait "$holder_pid" 2>/dev/null || true; fi
  if [ -n "$writer_pid" ]; then wait "$writer_pid" 2>/dev/null || true; fi
  if [ "$status" -ne 0 ]; then
    mkdir -p /tmp/aurevane-item-race-failure
    for log in "$race_tmp"/*.log; do test ! -f "$log" || cp "$log" /tmp/aurevane-item-race-failure/; done
    tail -30 "$race_tmp"/*.log >&2 || true
  fi
  rm -rf "$race_tmp"
  exit "$status"
}
trap cleanup EXIT
docker exec -i "$db_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres < .github/scripts/item-admission-race-fixtures.sql
wait_holder() {
 for ((attempt=0;attempt<100;attempt++)); do
  if [ "$(sql "select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.application_name='$holder_app' and a.state='idle in transaction' and l.locktype='advisory' and l.granted);")" = t ]; then return; fi
  sleep 0.1
 done
 echo 'Holder RPC did not finish with its actual authority lock' >&2; return 1
}
race() {
 local label="$1" mode="$2" holder="$3" writer="$4" expected="${5:-}"
 sql "select item_race.setup('$label','$mode');" >/dev/null
 mkfifo "$race_tmp/$label.input"
 exec {holder_input}<>"$race_tmp/$label.input"
 docker exec -i -e PGAPPNAME="$holder_app" "$db_container" psql -X -Atq -v ON_ERROR_STOP=1 -U postgres -d postgres <"$race_tmp/$label.input" >"$race_tmp/$label-holder.log" 2>&1 &
 holder_pid=$!
 printf "begin; set local statement_timeout='20s'; set local role service_role; select item_race.%s;\n" "$holder" >&"$holder_input"
 wait_holder
 (
  set +e
  docker exec -i -e PGAPPNAME="$writer_app" "$db_container" psql -X -Atq -v ON_ERROR_STOP=1 -U postgres -d postgres >"$race_tmp/$label-writer.log" 2>&1 <<SQL
begin;
set local statement_timeout='15s';
set local deadlock_timeout='500ms';
set local role service_role;
select item_race.$writer;
commit;
SQL
  printf '%s' "$?" >"$race_tmp/$label.status"
 ) &
 writer_pid=$!
 local observed=false
 for ((attempt=0;attempt<100;attempt++)); do
  if [ -f "$race_tmp/$label.status" ]; then observed=true; break; fi
  if [ "$(sql "select exists(select 1 from pg_stat_activity w join pg_stat_activity h on h.application_name='$holder_app' where w.application_name='$writer_app' and h.pid=any(pg_blocking_pids(w.pid)));")" = t ]; then observed=true; break; fi
  sleep 0.1
 done
 test "$observed" = true
 # Holder is still open when the loser either returns RETRY or demonstrably waits.
 test "$(sql "select exists(select 1 from pg_stat_activity where application_name='$holder_app' and state='idle in transaction');")" = t
 printf 'commit;\n\\quit\n' >&"$holder_input"
 exec {holder_input}>&-
 wait "$holder_pid"; holder_pid=''
 wait "$writer_pid"; writer_pid=''
 if [ -n "$expected" ]; then
  test "$(cat "$race_tmp/$label.status")" -ne 0
  grep -Eq "$expected" "$race_tmp/$label-writer.log"
 else
  test "$(cat "$race_tmp/$label.status")" = 0
 fi
 if grep -Eq 'deadlock detected|statement timeout' "$race_tmp/$label-writer.log"; then exit 1; fi
 printf 'PASS %s\n' "$label"
}
for mode in pve pvp world; do
 label="$mode-equip-first"
 race "$label" "$mode" "equip('$label')" "admit('$label')" 'ITEM_STALE_REVISION|ITEM_ADMISSION_RETRY|COMBAT_CONTENT_ADMISSION_RETRY'
 test "$(sql "select count(*) from app_private.battle_sessions where battle_id='items-race:$label';")" = 0
 test "$(sql "select item_race.read_item('$label')->>'revision';")" = 3
 label="$mode-admit-first"
 race "$label" "$mode" "admit('$label')" "equip('$label')" 'ITEM_BATTLE_ACTIVE'
 test "$(sql "select count(*) from app_private.battle_sessions where battle_id='items-race:$label';")" = 1
 test "$(sql "select item_race.read_item('$label')->>'revision';")" = 2
 test "$(sql "select s.current_snapshot#>'{buildAuthority,combatants,0,extensions,equipmentSkills,0}'=c.initial_snapshot#>'{buildAuthority,combatants,0,extensions,equipmentSkills,0}' from item_race.contexts c join app_private.battle_sessions s on s.battle_id='items-race:'||c.label where c.label='$label';")" = t
 # Exact PvE/PvP retries preserve one receipt; World intentionally rechecks its version.
 if [ "$mode" != world ]; then sql "select item_race.admit('$label');" >/dev/null; fi
done
race grant-replay grant "grant_item('grant-replay','first')" "grant_item('grant-replay','first')"
test "$(sql "select item_race.read_item('grant-replay')->>'revision';")" = 1
test "$(sql "select jsonb_array_length(item_race.read_item('grant-replay')->'stacks');")" = 1
race grant-stale grant "grant_item('grant-stale','first')" "grant_item('grant-stale','other')" ITEM_STALE_REVISION
test "$(sql "select jsonb_array_length(item_race.read_item('grant-stale')->'stacks');")" = 1
race read-first loadout "read_item('read-first')" "activate('read-first')"
race activate-read loadout "activate('activate-read')" "read_item('activate-read')"
race write-first loadout "grant_item('write-first','next')" "activate('write-first')"
race activate-write loadout "activate('activate-write')" "grant_item('activate-write','next')" ITEM_STALE_REVISION
for label in read-first activate-read write-first activate-write; do
 test "$(sql "select item_race.read_item('$label')#>>'{selectedSupport,actionId}';")" = basic.recover
 test "$(sql "select b.support_action_id from item_race.contexts c join app_private.character_active_builds b on b.character_id=c.character_id where c.label='$label';")" = basic.recover
 test "$(sql "select item_race.activate('$label')->>'replayed';")" = true
done
race starter-replay grant "prepare_starter('starter-replay')" "prepare_starter('starter-replay')"
test "$(sql "select item_race.read_item('starter-replay')->>'revision';")" = 1
test "$(sql "select jsonb_array_length(item_race.read_item('starter-replay')->'stacks');")" = 1
test "$(sql "select jsonb_array_length(item_race.read_item('starter-replay')->'grants');")" = 1
for lifecycle in archive disable; do
 label="starter-$lifecycle-first"
 race "$label" grant "${lifecycle}_starter('$label')" "prepare_starter('$label')"
 test "$(sql "select item_race.read_item('$label')->>'revision';")" = 0
 test "$(sql "select jsonb_array_length(item_race.read_item('$label')->'grants');")" = 0
 test "$(sql "select item_race.prepare_starter('$label')->>'starterNotice';")" = starter-items-unavailable
 label="starter-first-$lifecycle"
 race "$label" grant "prepare_starter('$label')" "${lifecycle}_starter('$label')"
 test "$(sql "select item_race.read_item('$label')->>'revision';")" = 1
 test "$(sql "select jsonb_array_length(item_race.read_item('$label')->'stacks');")" = 1
 test "$(sql "select jsonb_array_length(item_race.read_item('$label')->'grants');")" = 1
 test "$(sql "select item_race.prepare_starter('$label') ? 'starterNotice';")" = f
done
printf 'PASS 17 native Item admission, starter initialization/catalogue and nested loadout races\n'
