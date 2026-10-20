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
  'records',(select coalesce(jsonb_agg(to_jsonb(r) order by content_key),'[]') from app_private.combat_content_records r),
  'requests',(select coalesce(jsonb_agg(to_jsonb(r) order by actor_user_id,request_id),'[]') from app_private.combat_content_record_requests r),
  'links',(select coalesce(jsonb_agg(to_jsonb(l) order by parent_key,child_key),'[]') from app_private.combat_content_links l),
  'attribution',(select coalesce(jsonb_agg(to_jsonb(a) order by version_id),'[]') from app_private.combat_content_attribution a),
  'characters',(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.characters c),
  'earned',(select coalesce(jsonb_agg(to_jsonb(u) order by character_id,skill_id),'[]') from app_private.character_skill_unlocks u),
  'equipped',(select coalesce(jsonb_agg(to_jsonb(e) order by character_id,slot_index),'[]') from app_private.character_build_discipline_skills e),
  'saved',(select coalesce(jsonb_agg(to_jsonb(s) order by character_id,slot_index),'[]') from app_private.character_saved_build_loadouts s),
  'builds',(select coalesce(jsonb_agg(to_jsonb(b) order by character_id),'[]') from app_private.character_active_builds b),
  'phase4',(select coalesce(jsonb_agg(to_jsonb(c) order by skill_id),'[]') from app_private.phase4_skill_catalog c),
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
  local expected_error="${5-COMBAT_CONTENT_CATALOGUE_CONFLICT}" schedule="${6:-blocking}"
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
\\set VERBOSITY verbose
set local statement_timeout='3s';
set local role service_role;
$writer_sql
rollback;
SQL
  writer_pid=$!
  writer_result=0
  if [ "$schedule" = blocking ]; then
    wait_for_query "select exists(select 1 from pg_stat_activity a join pg_stat_activity h on h.application_name='$holder_app' where a.application_name='$writer_app' and a.wait_event_type='Lock' and h.pid=any(pg_blocking_pids(a.pid)));" "$label writer blocked by catalogue holder"
  else
    # The writer must finish while the holder still owns its real RPC lock.
    # A blocking implementation times out and fails the exact error/result check.
    wait "$writer_pid" || writer_result=$?
    writer_pid=''
    test "$(sql "select exists(select 1 from pg_stat_activity where application_name='$holder_app' and state='idle in transaction');")" = t
  fi
  printf '%s;\n\\quit\n' "$finish" >&"$holder_input"
  exec {holder_input}>&-
  wait "$holder_pid"
  holder_pid=''
  if [ -n "$writer_pid" ]; then wait "$writer_pid" || writer_result=$?; fi
  writer_pid=''
  if [ "$finish" = commit ]; then
    if [ -n "$expected_error" ]; then
      test "$writer_result" -ne 0
      grep -Fq "$expected_error" "$race_tmp/$label-writer.log"
      if [ "$expected_error" = COMBAT_CONTENT_ADMISSION_RETRY ]; then grep -Fq '40001:' "$race_tmp/$label-writer.log"; fi
    else
      test "$writer_result" -eq 0
    fi
    expected_state="$(sed -n 's/^EXPECTED://p' "$race_tmp/$label-holder.log")"
    test -n "$expected_state"
    test "$(sql "select $state_expression;")" = "$expected_state"
  else
    test "$writer_result" -eq 0
    test "$(sql "select $state_expression;")" = "$before_state"
  fi
  echo "Catalogue two-session $label: observed $schedule schedule, $finish, exact result and complete persisted state PASS."
}

sql "set role service_role; select public.write_combat_content_record_v1('$owner_id',null,k,jsonb_build_object('action','create','requestId',gen_random_uuid(),'contentKind','skill','definition',jsonb_build_object('id',k))) from unnest(array['ci.catalogue-race','ci.catalogue-loser']) k;" >/dev/null
publish="select public.publish_saved_combat_content_v1(:'actor',null,'ci.catalogue-race',1,null,:'token',5);"
timing="select public.publish_combat_effect_timing_policy_v2(:'actor',(public.read_combat_content_catalogue_v1()->'policy'->>'version')::integer,'{\"slow\":\"instant\"}',:'token');"
race content-versus-timing "$publish" "$timing"
test "$(sql "select content_version from app_private.combat_content_versions where content_key='ci.catalogue-race';")" = 6
race timing-versus-content "$timing" "select public.publish_saved_combat_content_v1(:'actor',null,'ci.catalogue-loser',1,null,:'token',5);"
race history-versus-content "select public.write_combat_content_record_v1(:'actor',null,'ci.catalogue-race','{\"action\":\"restore\",\"expectedRevision\":2,\"sourceVersion\":6}');" "select public.publish_saved_combat_content_v1(:'actor',null,'ci.catalogue-loser',1,null,:'token',5);"
publish="select public.publish_saved_combat_content_v1(:'actor',null,'ci.catalogue-race',2,6,:'token',1);"
race rollback-releases-token "$publish" "$timing" rollback

# Use an isolated confirmed account and a physical character fixture. The actual
# earned-Skill RPC runs under service_role; no guard or authorizer is replaced.
admission_user="$(sql "insert into auth.users(id,email,email_confirmed_at) values(gen_random_uuid(),'content-admission-native@example.test',now()) returning id;")"
admission_character="$(sql "insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at) values(gen_random_uuid(),'$admission_user',0,1,'Content Admission','content-admission-native','androgynous','they_them','portrait.starter.wayfarer-01','appearance.starter.roadworn','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now()) returning id;")"
[[ "$admission_character" =~ ^[0-9a-f-]{36}$ ]]
sql "set role service_role; select public.write_combat_content_record_v1('$owner_id',null,k,jsonb_build_object('action','create','requestId',gen_random_uuid(),'contentKind','skill','definition',jsonb_build_object('id',k,'sourceDisciplineId','vanguard'))) from unnest(array['ci.admission-first','ci.archive-first','ci.shared-first','ci.shared-second']) k;" >/dev/null
grant_skill() { printf "select * from public.record_character_skill_unlock_v1('%s','%s',1,'vanguard','owner','native-content-admission');" "$admission_character" "$1"; }
archive_skill() { printf "select public.write_combat_content_record_v1(:'actor',null,'%s','{\"action\":\"archive\",\"expectedRevision\":1}');" "$1"; }
race admission-before-archive "$(grant_skill ci.admission-first)" "$(archive_skill ci.admission-first)" commit COMBAT_CONTENT_DEPENDENCIES
# Take the player row first, as real admission callers do. The subsequent trigger
# must try its shared lock without waiting, avoiding catalogue/player inversion.
race archive-before-admission "$(archive_skill ci.archive-first)" "reset role; select id from public.characters where id='$admission_character' for update; update public.characters set xp=xp+1 where id='$admission_character'; set local role service_role; $(grant_skill ci.archive-first)" commit COMBAT_CONTENT_ADMISSION_RETRY immediate
race independent-shared-admission "$(grant_skill ci.shared-first)" "$(grant_skill ci.shared-second)" rollback '' immediate

echo 'Combat catalogue physical PostgreSQL races: saved revision and floor, content/timing/restore cross-writer CAS, rollback and zero partial losing writes PASS.'
echo 'Content archive/admission physical PostgreSQL races: admission-first dependency, archive-first immediate 40001, shared admissions and complete player/content rollback PASS.'
