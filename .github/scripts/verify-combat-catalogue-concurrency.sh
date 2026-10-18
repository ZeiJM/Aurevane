#!/usr/bin/env bash
set -euo pipefail
# Disposable local Supabase only. Run last: committed fixture history/policy is
# intentionally retained until the CI stack is destroyed, just like real history.
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
sql() { docker exec "$db_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "$1"; }
# The earlier staff-authority verifier bootstraps the sole trusted CI Owner.
# Reuse it rather than violating the real single-enabled-Owner constraint.
owner_id="$(sql "select user_id from app_private.master_panel_role_assignments where role='game-owner' and enabled;")"
[[ "$owner_id" =~ ^[0-9a-f-]{36}$ ]]
race_tmp="$(mktemp -d)"
holder_app="catalogue-holder-$owner_id"
writer_app="catalogue-writer-$owner_id"
holder_pid=''
writer_pid=''
cleanup() {
  result=$?
  trap - EXIT
  sql "select pg_terminate_backend(pid) from pg_stat_activity where application_name in ('$holder_app','$writer_app') and pid<>pg_backend_pid();" >/dev/null || true
  if [ -n "$holder_pid" ]; then wait "$holder_pid" 2>/dev/null || true; fi
  if [ -n "$writer_pid" ]; then wait "$writer_pid" 2>/dev/null || true; fi
  if [ "$result" -ne 0 ]; then cat "$race_tmp"/*.log >&2 2>/dev/null || true; fi
  rm -rf "$race_tmp"
  exit "$result"
}
trap cleanup EXIT

# Snapshot all persisted combat authoring state, including immutable history and
# drafts. A losing writer must not even delete an existing draft.
state_expression="jsonb_build_object(
  'catalogue',public.read_combat_content_catalogue_v1(),
  'versions',(select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from app_private.combat_content_versions v),
  'drafts',(select coalesce(jsonb_agg(to_jsonb(d) order by content_key),'[]') from app_private.combat_content_drafts d),
  'timing',(select jsonb_agg(to_jsonb(t) order by version) from app_private.combat_effect_timing_policy_versions t))::text"
wait_for_query() {
  for ((attempt=0; attempt<100; attempt++)); do
    if [ "$(sql "$1")" = 't' ]; then return; fi
    sleep 0.1
  done
  echo "Timed out waiting for $2" >&2
  return 1
}

# SQL arguments below are fixed test statements, not input from content/users.
race() {
  local label="$1" holder_sql="$2" writer_sql="$3" finish="${4:-commit}"
  local catalogue_token before_state writer_result expected_state
  catalogue_token="$(sql "select public.read_combat_content_catalogue_v1()->>'token';")"
  before_state="$(sql "select $state_expression;")"
  mkfifo "$race_tmp/$label-input"
  exec {holder_input}<>"$race_tmp/$label-input"
  docker exec -i -e PGAPPNAME="$holder_app" "$db_container" psql -X -Atq -v ON_ERROR_STOP=1 -v actor="$owner_id" -v token="$catalogue_token" -U postgres -d postgres \
    <"$race_tmp/$label-input" >"$race_tmp/$label-holder.log" 2>&1 &
  holder_pid=$!
  cat >&"$holder_input" <<SQL
begin;
set local statement_timeout='30s';
set local role service_role;
$holder_sql
reset role;
select 'EXPECTED:' || $state_expression;
SQL
  wait_for_query "select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.application_name='$holder_app' and a.state='idle in transaction' and l.locktype='advisory' and l.granted);" "$label holder's real RPC lock"
  docker exec -i -e PGAPPNAME="$writer_app" "$db_container" psql -X -Atq -v ON_ERROR_STOP=1 -v actor="$owner_id" -v token="$catalogue_token" -U postgres -d postgres \
    >"$race_tmp/$label-writer.log" 2>&1 <<SQL &
begin;
set local statement_timeout='30s';
set local role service_role;
$writer_sql
rollback;
SQL
  writer_pid=$!
  wait_for_query "select exists(select 1 from pg_stat_activity a join pg_stat_activity h on h.application_name='$holder_app' where a.application_name='$writer_app' and a.wait_event_type='Lock' and h.pid=any(pg_blocking_pids(a.pid)));" "$label writer blocked by catalogue holder"
  printf '%s;\n\\quit\n' "$finish" >&"$holder_input"
  exec {holder_input}>&-
  wait "$holder_pid"
  holder_pid=''
  writer_result=0
  wait "$writer_pid" || writer_result=$?
  writer_pid=''
  if [ "$finish" = commit ]; then
    test "$writer_result" -ne 0
    rg -q 'COMBAT_CONTENT_CATALOGUE_CONFLICT' "$race_tmp/$label-writer.log"
    expected_state="$(sed -n 's/^EXPECTED://p' "$race_tmp/$label-holder.log")"
    test -n "$expected_state"
    test "$(sql "select $state_expression;")" = "$expected_state"
  else
    test "$writer_result" -eq 0
    test "$(sql "select $state_expression;")" = "$before_state"
  fi
  echo "Catalogue two-session $label: observed lock wait, $finish, correct token result and complete persisted state PASS."
}

publish="select * from public.publish_combat_content_v3(:'actor','ci.catalogue-race','skill','{\"id\":\"ci.catalogue-race\"}',1,:'token',5);"
timing="select public.publish_combat_effect_timing_policy_v2(:'actor',(public.read_combat_content_catalogue_v1()->'policy'->>'version')::integer,'{\"slow\":\"instant\"}',:'token');"
race content-versus-timing "$publish" "$timing"
test "$(sql "select content_version from app_private.combat_content_versions where content_key='ci.catalogue-race';")" = 6
race timing-versus-content "$timing" "select * from public.publish_combat_content_v3(:'actor','ci.catalogue-loser','skill','{\"id\":\"ci.catalogue-loser\"}',1,:'token',5);"
race history-versus-content "select public.set_combat_content_publication_v2(:'actor','ci.catalogue-race','skill',null,:'token');" "$publish"
race rollback-releases-token "$publish" "$timing" rollback

echo 'Combat catalogue physical PostgreSQL races: v3 floor, content/timing/history cross-writer CAS, rollback and zero partial losing writes PASS.'
