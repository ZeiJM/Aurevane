#!/usr/bin/env bash
set -euo pipefail
# Disposable local Supabase only. Never accepts a remote connection URL.
source .github/scripts/auth-test-helpers.sh
load_test_auth
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
email="support-action-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}@example.com"
signup="$(signup_test_user "$email" 'Support-action-test-2026!')"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
confirm_test_user "$user_id"
character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
 set role service_role;
 select id::text from public.create_character_v3(
 '$user_id'::uuid, 0::smallint, gen_random_uuid(), 'support:create:character', 1,
 'Support Tester', 'supporttester', 'androgynous', 'they_them',
 'portrait.starter.wayfarer-01', 'appearance.starter.roadworn', 'vanguard', 12, 4, 7, 4, 3, 6);")"
docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
begin;
set role service_role;
do \$test\$
declare
 v_user uuid := '$user_id';
 v_character uuid := '$character_id';
 v_choice text;
 v_version bigint := 1;
 v_key uuid;
 v_row record;
 v_before jsonb;
begin
 if (public.get_character_active_build_v4(v_user,v_character)->>'support_action_id') is distinct from 'basic.recover' then raise exception 'HP Recovery default failed'; end if;
 if public.get_character_active_build_v4(gen_random_uuid(),v_character) is not null then raise exception 'foreign read allowed'; end if;
 v_before := public.get_character_committed_build_snapshot_v2(v_user,v_character)->'disciplineSkills';
 foreach v_choice in array array['basic.recover','basic.pilfer','basic.fleetstep','basic.invocation','basic.recover.mp'] loop
   v_key := gen_random_uuid();
   select * into v_row from public.save_character_support_action_v1(v_user,v_character,v_version,v_choice,v_key,'support:'||v_choice);
   v_version := v_version + 1;
   if v_row.build_version is distinct from v_version or v_row.replayed then raise exception 'save failed'; end if;
   select * into v_row from public.save_character_support_action_v1(v_user,v_character,v_version-1,v_choice,v_key,'support:'||v_choice);
   if v_row.build_version is distinct from v_version or not v_row.replayed then raise exception 'replay failed'; end if;
   if public.get_character_committed_build_snapshot_v2(v_user,v_character)->>'supportActionId' is distinct from v_choice then raise exception 'snapshot did not pin choice'; end if;
   if public.get_character_committed_build_snapshot_v2(v_user,v_character)->'disciplineSkills' is distinct from v_before then raise exception 'support changed Discipline slots'; end if;
 end loop;
 begin
   perform public.save_character_support_action_v1(v_user,v_character,v_version,'basic.recover',v_key,'support:conflict');
   raise exception 'conflicting replay allowed';
 exception when raise_exception then if sqlerrm <> 'CHARACTER_SUPPORT_ACTION_IDEMPOTENCY_CONFLICT' then raise; end if; end;
 begin
   perform public.save_character_support_action_v1(v_user,v_character,1,'basic.recover',gen_random_uuid(),'support:stale');
   raise exception 'stale save allowed';
 exception when raise_exception then if sqlerrm <> 'CHARACTER_BUILD_VERSION_CONFLICT' then raise; end if; end;
 begin
   perform public.save_character_support_action_v1(gen_random_uuid(),v_character,v_version,'basic.recover',gen_random_uuid(),'support:foreign');
   raise exception 'foreign save allowed';
 exception when raise_exception then if sqlerrm <> 'CHARACTER_BUILD_NOT_FOUND' then raise; end if; end;
 foreach v_choice in array array['basic.guard','basic.attack','',null] loop
   begin
     perform public.save_character_support_action_v1(v_user,v_character,v_version,v_choice,gen_random_uuid(),'support:invalid');
     raise exception 'invalid action allowed';
   exception when invalid_parameter_value then if sqlerrm <> 'SUPPORT_ACTION_INVALID' then raise; end if; end;
 end loop;
 perform public.save_character_build_loadout_v1(v_user,v_character,1::smallint,'Recovery',v_version,gen_random_uuid(),'support:loadout');
 if (select support_action_id from public.get_character_saved_build_loadouts_v2(v_user,v_character) where slot_index=1) is distinct from 'basic.recover.mp' then raise exception 'loadout omitted support'; end if;
 perform public.save_character_support_action_v1(v_user,v_character,v_version,'basic.recover',gen_random_uuid(),'support:reset');
 v_version := v_version + 1;
 v_key := gen_random_uuid();
 select * into v_row from public.activate_character_build_loadout_v1(v_user,v_character,1::smallint,v_version,v_key,'support:activate');
 v_version := v_version + 1;
 if v_row.build_version is distinct from v_version or v_row.replayed then raise exception 'activation version failed'; end if;
 if public.get_character_active_build_v4(v_user,v_character)->>'support_action_id' is distinct from 'basic.recover.mp' then raise exception 'activation did not restore support'; end if;
 select * into v_row from public.activate_character_build_loadout_v1(v_user,v_character,1::smallint,v_version-1,v_key,'support:activate');
 if not v_row.replayed or v_row.build_version is distinct from v_version then raise exception 'activation replay failed'; end if;
end;
\$test\$;
reset role;
do \$test\$
begin
 if exists (
   select 1 from (values ('anon'),('authenticated')) forbidden(role_name)
   cross join (values
     ('public.save_character_support_action_v1(uuid,uuid,bigint,text,uuid,text)'),
     ('public.get_character_active_build_v4(uuid,uuid)'),
     ('public.get_character_saved_build_loadouts_v2(uuid,uuid)')
   ) rpc(signature)
   where has_function_privilege(forbidden.role_name,rpc.signature,'execute')
 ) then raise exception 'support RPC privilege leak'; end if;
 if exists (
   select 1 from (values ('anon'),('authenticated')) forbidden(role_name)
   cross join (values
     ('app_private.character_support_action_idempotency'),
     ('app_private.character_support_action_change_audit')
   ) private_table(table_name)
   where has_table_privilege(forbidden.role_name,private_table.table_name,'SELECT,INSERT,UPDATE,DELETE')
 ) then raise exception 'support private table privilege leak'; end if;
 begin
   update app_private.character_active_builds set support_action_id='basic.attack' where character_id='$character_id';
   raise exception 'invalid persisted choice allowed';
 exception when check_violation then null; end;
end;
\$test\$;
rollback;
SQL
printf 'Support Action ownership, defaults, idempotency, versions, snapshots, loadouts and privileges passed.\n'

# Race two independent writers against the same version. The row lock must admit exactly
# one mutation and reject the other as stale; retrying its intent must preserve both fields.
race_dir="$(mktemp -d)"
gate_app="support-gate-$$"
skills_app="support-skills-$$"
support_app="support-writer-$$"
gate_pid=''; skills_pid=''; support_pid=''
sql() { docker exec "$db_container" psql -X -Atq -v ON_ERROR_STOP=1 -U postgres -d postgres -c "$1"; }
cleanup() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    mkdir -p /tmp/aurevane-support-race-failure
    sql "select application_name,state,wait_event_type,wait_event,pg_blocking_pids(pid),query from pg_stat_activity where application_name in ('$gate_app','$skills_app','$support_app');" >"$race_dir/activity.log" 2>&1 || true
  fi
  sql "select pg_terminate_backend(pid) from pg_stat_activity where application_name in ('$gate_app','$skills_app','$support_app');" >/dev/null || true
  for pid in "$gate_pid" "$skills_pid" "$support_pid"; do if [ -n "$pid" ]; then wait "$pid" 2>/dev/null || true; fi; done
  if [ "$status" -ne 0 ]; then
    for log in "$race_dir"/*.log "$race_dir"/*.status; do
      if [ -f "$log" ]; then cp "$log" /tmp/aurevane-support-race-failure/; cat "$log" >&2; fi
    done
  fi
  sql 'drop trigger if exists support_skill_race_gate on app_private.character_skill_loadout_change_audit; drop schema if exists support_skill_race cascade;' >/dev/null || true
  rm -rf "$race_dir"
  exit "$status"
}
trap cleanup EXIT
support_sql="set role service_role; select * from public.save_character_support_action_v1('$user_id','$character_id',1,'basic.recover',gen_random_uuid(),'support:race');"
skills_sql="set role service_role; select * from public.save_character_discipline_skill_loadout_v1('$user_id','$character_id',1,jsonb_build_array((select jsonb_build_object('skillId',skill_id,'contentVersion',skill_content_version,'sourceDisciplineId',source_discipline_id) from public.get_character_learned_skills_v1('$user_id','$character_id') where skill_id='vanguard.forceful-strike')),gen_random_uuid(),'skills:race');"
run_race_save() {
  local label="$1" sql="$2" result=0
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "set statement_timeout='15s'; $sql" >"$race_dir/$label.log" 2>&1 || result=$?
  printf '%s' "$result" >"$race_dir/$label.status"
}
run_race_save support "$support_sql" &
support_pid=$!
run_race_save skills "$skills_sql" &
skills_pid=$!
wait "$support_pid"
wait "$skills_pid"
if [ "$(cat "$race_dir/support.status")" = 0 ]; then
  test "$(cat "$race_dir/skills.status")" != 0
  grep -Fq 'CHARACTER_BUILD_VERSION_CONFLICT' "$race_dir/skills.log"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "${skills_sql/,1,/,2,}" >/dev/null
else
  test "$(cat "$race_dir/skills.status")" = 0
  grep -Fq 'CHARACTER_BUILD_VERSION_CONFLICT' "$race_dir/support.log"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "${support_sql/,1,/,2,}" >/dev/null
fi
final="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
 set role service_role;
 select (snapshot->>'buildVersion') || '|' || (snapshot->>'supportActionId') || '|' || (snapshot->'disciplineSkills'->0->>'skillId')
 from (select public.get_character_committed_build_snapshot_v2('$user_id','$character_id') snapshot) current;")"
test "$final" = '3|basic.recover|vanguard.forceful-strike'
printf 'Concurrent Support Action and Discipline Skill saves preserved both intents.\n'

# Force the previously unsafe interleaving: Skills owns build but has not inserted
# its character-FK audit; Support must now wait at account seed0 without owning the
# character row. Releasing the audit gate must finish Skills and make Support stale.
docker exec -i "$db_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres < .github/scripts/support-discipline-race-fixture.sql
wait_for() {
  local query="$1" label="$2"
  for ((attempt=0;attempt<100;attempt++)); do
    if [ "$(sql "$query")" = t ]; then return; fi
    sleep 0.1
  done
  echo "Did not observe $label" >&2; return 1
}
docker exec -e PGAPPNAME="$gate_app" "$db_container" psql -X -Atq -v ON_ERROR_STOP=1 -U postgres -d postgres -c "begin; select pg_advisory_xact_lock(hashtextextended('$gate_app',0)); select pg_sleep(45); rollback;" >"$race_dir/gate.log" 2>&1 &
gate_pid=$!
wait_for "select exists(select 1 from pg_stat_activity where application_name='$gate_app' and wait_event='PgSleep');" 'audit gate holder'
skill_key="$(sql 'select gen_random_uuid();')"
support_key="$(sql 'select gen_random_uuid();')"
paused_skills="set role service_role; select * from public.save_character_discipline_skill_loadout_v1('$user_id','$character_id',3,'[]'::jsonb,'$skill_key','skills:before-audit');"
blocked_support="set role service_role; select * from public.save_character_support_action_v1('$user_id','$character_id',3,'basic.recover.mp','$support_key','support:before-audit');"
run_named() {
  local label="$1" app="$2" statement="$3" result=0
  docker exec -e PGAPPNAME="$app" "$db_container" psql -X -Atq -v ON_ERROR_STOP=1 -U postgres -d postgres -c "set statement_timeout='20s'; set deadlock_timeout='500ms'; $statement" >"$race_dir/$label.log" 2>&1 || result=$?
  printf '%s' "$result" >"$race_dir/$label.status"
}
run_named audit-skills "$skills_app" "set aurevane.support_race_gate='$gate_app'; $paused_skills" &
skills_pid=$!
wait_for "select exists(select 1 from pg_stat_activity w join pg_stat_activity h on h.application_name='$gate_app' where w.application_name='$skills_app' and h.pid=any(pg_blocking_pids(w.pid)));" 'actual Discipline writer before audit FK'
run_named audit-support "$support_app" "$blocked_support" &
support_pid=$!
wait_for "select exists(select 1 from pg_stat_activity w join pg_stat_activity h on h.application_name='$skills_app' where w.application_name='$support_app' and h.pid=any(pg_blocking_pids(w.pid)) and w.wait_event_type='Lock' and w.wait_event='advisory');" 'Support waiting on the outer account lock'
# The blocked Support writer cannot already own the incompatible character lock.
sql "begin; select id from public.characters where id='$character_id' for key share nowait; rollback;" >"$race_dir/character-key-share.log" 2>&1
sql "select pg_terminate_backend(pid) from pg_stat_activity where application_name='$gate_app';" >/dev/null
wait "$gate_pid" || true; gate_pid=''
wait "$skills_pid"; skills_pid=''
wait "$support_pid"; support_pid=''
test "$(cat "$race_dir/audit-skills.status")" = 0
test "$(cat "$race_dir/audit-support.status")" != 0
grep -Fq 'CHARACTER_BUILD_VERSION_CONFLICT' "$race_dir/audit-support.log"
if grep -Eq 'deadlock detected|statement timeout' "$race_dir/audit-skills.log" "$race_dir/audit-support.log"; then exit 1; fi
sql "${blocked_support/,3,/,4,}" >"$race_dir/support-retry.log"
test "$(sql "set role service_role; select build_version||'|'||replayed from public.save_character_discipline_skill_loadout_v1('$user_id','$character_id',3,'[]'::jsonb,'$skill_key','skills:before-audit');")" = '4|true'
test "$(sql "set role service_role; select build_version||'|'||replayed from public.save_character_support_action_v1('$user_id','$character_id',4,'basic.recover.mp','$support_key','support:before-audit');")" = '5|true'
test "$(sql "select build_version||'|'||support_action_id||'|'||(select count(*) from app_private.character_build_discipline_skills where character_id='$character_id') from app_private.character_active_builds where character_id='$character_id';")" = '5|basic.recover.mp|0'
test "$(sql "select revision||'|'||(selected_support->>'actionId') from app_private.character_item_inventory where character_id='$character_id';")" = '2|basic.recover.mp'
printf 'PASS deterministic Discipline-before-audit / Support account lock, stale retry and exact replay.\n'
