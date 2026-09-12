#!/usr/bin/env bash
set -euo pipefail
# Called only by the disposable local Supabase publication verifier after its rollback.
db_container="$1"
user_id="$2"
test -n "$db_container"
test -n "$user_id"
publication_tmp="$(mktemp -d)"
save_app="p4-save-$user_id"
activation_app="p4-activate-$user_id"
character_id=''
save_pid=''
activation_pid=''
cleanup() {
  result=$?
  trap - EXIT
  # Stop only these fixture sessions, including any transaction left on assertion failure.
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    select pg_terminate_backend(pid) from pg_stat_activity
    where application_name in ('$save_app','$activation_app') and pid <> pg_backend_pid();" >/dev/null || true
  if [ -n "$save_pid" ]; then wait "$save_pid" 2>/dev/null || true; fi
  if [ -n "$activation_pid" ]; then wait "$activation_pid" 2>/dev/null || true; fi
  if [ "$result" -ne 0 ]; then cat "$publication_tmp"/*.log >&2 2>/dev/null || true; fi
  if [ -n "$character_id" ]; then
    docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "delete from public.characters where id='$character_id'::uuid and user_id='$user_id'::uuid;" >/dev/null || true
  fi
  rm -rf "$publication_tmp"
  exit "$result"
}
trap cleanup EXIT

# Canonical Shadehand base (3,7,3,8,6,4) plus all five creation points in focus Finesse.
character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select id from public.create_character_v3('$user_id'::uuid,0::smallint,gen_random_uuid(),'p4:publication:race',1,'P4 Race','p4publicationrace','androgynous','they_them','portrait.starter.wayfarer-01','appearance.starter.roadworn','shadehand',3,12,3,8,6,4);")"
test -n "$character_id"
# Initial committed build version 2 contains the release-affected v1 Skill.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select * from public.save_character_discipline_skill_loadout_v1('$user_id'::uuid,'$character_id'::uuid,1,
    '[{\"skillId\":\"shadehand.smoke-vial\",\"contentVersion\":1,\"sourceDisciplineId\":\"shadehand\"}]'::jsonb,
    gen_random_uuid(),'p4:publication:race-initial');" >/dev/null

# Session A pauses immediately after taking the same row lock as the normal save.
mkfifo "$publication_tmp/save-input"
exec {save_input}<>"$publication_tmp/save-input"
docker exec -i -e PGAPPNAME="$save_app" "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  <"$publication_tmp/save-input" >"$publication_tmp/save.log" 2>&1 &
save_pid=$!
cat >&"$save_input" <<SQL
begin;
set local statement_timeout='30s';
set local deadlock_timeout='100ms';
select character_id from app_private.character_active_builds where character_id='$character_id'::uuid for update;
SQL

wait_for_query() {
  local query="$1"
  local description="$2"
  for ((attempt=0; attempt<100; attempt++)); do
    if [ "$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "$query")" = 't' ]; then return; fi
    sleep 0.1
  done
  echo "Timed out waiting for $description" >&2
  return 1
}
wait_for_query "select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.application_name='$save_app' and a.state='idle in transaction' and l.relation='app_private.character_active_builds'::regclass and l.mode='RowShareLock' and l.granted);" 'normal save row lock'

# Session B attempts publication while A holds its row. Publication itself rolls
# back after asserting its result, retaining pre-activation state for later CI gates.
docker exec -i -e PGAPPNAME="$activation_app" "$db_container" psql -v ON_ERROR_STOP=1 -v character_id="$character_id" -U postgres -d postgres \
  >"$publication_tmp/activation.log" 2>&1 <<'SQL' &
begin;
set local statement_timeout='30s';
set local deadlock_timeout='100ms';
select set_config('p4.race_character', :'character_id', true);
set local role service_role;
select public.activate_phase4_combat_interactions_v2();
reset role;
do $$
declare c uuid := current_setting('p4.race_character')::uuid;
begin
  assert (select build_version=4 from app_private.character_active_builds where character_id=c), 'Save and publication each advance once';
  assert (select count(*)=2 from app_private.character_build_discipline_skills where character_id=c), 'Concurrent saved selection retained';
  assert (select skill_content_version=2 from app_private.character_build_discipline_skills where character_id=c and skill_id='shadehand.smoke-vial'), 'Selected release version coherent';
  assert (select skill_content_version=2 from app_private.character_skill_unlocks where character_id=c and skill_id='shadehand.smoke-vial'), 'Learned release version coherent';
  assert (select skill_content_version=1 from app_private.character_build_discipline_skills where character_id=c and skill_id='shadehand.backstab'), 'Unchanged concurrent selection retained';
  assert (select count(*)=1 from app_private.character_skill_loadout_change_audit where character_id=c and request_fingerprint='p4:publication:race-save' and build_version_before=2 and build_version_after=3), 'Normal save audit committed once';
  assert (select count(*)=1 from app_private.character_skill_loadout_change_audit where character_id=c and request_fingerprint='publication:phase4-combat-interactions-v2' and build_version_before=3 and build_version_after=4 and jsonb_array_length(before_skills)=2 and before_skills #>> '{0,contentVersion}'='1' and after_skills #>> '{0,contentVersion}'='2'), 'Publication audited the completed save';
end;
$$;
rollback;
SQL
activation_pid=$!
# Observe a real wait before allowing A to proceed, not a timing guess. With the
# previous lock mode B waits on A's row while holding dependent table locks; A's
# following real save then deadlocks and either process exits nonzero.
wait_for_query "select exists(select 1 from pg_stat_activity a join pg_stat_activity holder on holder.application_name='$save_app' where a.application_name='$activation_app' and a.wait_event_type='Lock' and holder.pid=any(pg_blocking_pids(a.pid)));" 'publication blocked by the held build row'
cat >&"$save_input" <<SQL
set local role service_role;
select * from public.save_character_discipline_skill_loadout_v1('$user_id'::uuid,'$character_id'::uuid,2,
  '[{"skillId":"shadehand.smoke-vial","contentVersion":1,"sourceDisciplineId":"shadehand"},{"skillId":"shadehand.backstab","contentVersion":1,"sourceDisciplineId":"shadehand"}]'::jsonb,
  gen_random_uuid(),'p4:publication:race-save');
commit;
\quit
SQL
exec {save_input}>&-
wait "$save_pid"
save_pid=''
wait "$activation_pid"
activation_pid=''
# B rolled back publication; the successful ordinary save remains at version 3.
test "$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "select build_version=3 and (select activated_at is null from app_private.phase4_combat_publication) from app_private.character_active_builds where character_id='$character_id'::uuid;")" = 't'
echo 'Phase 4 two-session publication/save race: both completed, coherent versions and audits PASS.'

# Mastery claims lock characters before provision_mastery_skills_v1. Hold that
# parent row in A; B must reject safely before acquiring child write locks.
mkfifo "$publication_tmp/parent-input"
exec {parent_input}<>"$publication_tmp/parent-input"
docker exec -i -e PGAPPNAME="$save_app" "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  <"$publication_tmp/parent-input" >"$publication_tmp/parent-holder.log" 2>&1 &
save_pid=$!
cat >&"$parent_input" <<SQL
begin;
set local statement_timeout='30s';
select id from public.characters where id='$character_id'::uuid for update;
SQL
wait_for_query "select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.application_name='$save_app' and a.state='idle in transaction' and l.relation='public.characters'::regclass and l.mode='RowShareLock' and l.granted);" 'Mastery character parent row lock'

docker exec -i -e PGAPPNAME="$activation_app" "$db_container" psql -v ON_ERROR_STOP=1 -v character_id="$character_id" -U postgres -d postgres \
  >"$publication_tmp/parent-busy.log" 2>&1 <<'SQL'
begin;
set local statement_timeout='5s';
select set_config('p4.race_character', :'character_id', true);
do $$
declare
 c uuid := current_setting('p4.race_character')::uuid;
 before_receipt jsonb;
 before_catalog jsonb;
 before_build jsonb;
 before_learned jsonb;
 before_selected jsonb;
 before_audits jsonb;
 busy_message text;
begin
 select to_jsonb(receipt) into before_receipt from app_private.phase4_combat_publication receipt;
 select jsonb_agg(to_jsonb(catalog) order by skill_id) into before_catalog from app_private.phase4_skill_catalog catalog;
 select to_jsonb(build) into before_build from app_private.character_active_builds build where character_id=c;
 select jsonb_agg(to_jsonb(learned) order by skill_id) into before_learned from app_private.character_skill_unlocks learned where character_id=c;
 select jsonb_agg(to_jsonb(selected) order by slot_index) into before_selected from app_private.character_build_discipline_skills selected where character_id=c;
 select jsonb_agg(to_jsonb(audit) order by id) into before_audits from app_private.character_skill_loadout_change_audit audit where character_id=c;
 begin
   set local role service_role;
   perform public.activate_phase4_combat_interactions_v2();
   raise exception 'Parent-locked publication must return retryable busy';
 exception when lock_not_available then
   get stacked diagnostics busy_message = message_text;
   assert busy_message='PHASE4_COMBAT_PUBLICATION_BUSY', 'Specific retryable activation error';
 end;
 reset role;
 assert (select to_jsonb(receipt)=before_receipt from app_private.phase4_combat_publication receipt), 'Busy leaves release receipt unchanged';
 assert (select jsonb_agg(to_jsonb(catalog) order by skill_id)=before_catalog from app_private.phase4_skill_catalog catalog), 'Busy leaves catalog unchanged';
 assert (select to_jsonb(build)=before_build from app_private.character_active_builds build where character_id=c), 'Busy leaves current build unchanged';
 assert (select jsonb_agg(to_jsonb(learned) order by skill_id)=before_learned from app_private.character_skill_unlocks learned where character_id=c), 'Busy leaves learned versions unchanged';
 assert (select jsonb_agg(to_jsonb(selected) order by slot_index)=before_selected from app_private.character_build_discipline_skills selected where character_id=c), 'Busy leaves selected versions unchanged';
 assert (select jsonb_agg(to_jsonb(audit) order by id) is not distinct from before_audits from app_private.character_skill_loadout_change_audit audit where character_id=c), 'Busy leaves audits unchanged';
end;
$$;
rollback;
SQL

# Only after the exact busy result, A completes the existing real provisioning
# function and commits. This is the parent-lock -> learned-write order in claims.
cat >&"$parent_input" <<SQL
select app_private.provision_mastery_skills_v1('$character_id'::uuid);
commit;
\quit
SQL
exec {parent_input}>&-
wait "$save_pid"
save_pid=''

docker exec -i -e PGAPPNAME="$activation_app" "$db_container" psql -v ON_ERROR_STOP=1 -v character_id="$character_id" -U postgres -d postgres \
  >"$publication_tmp/parent-retry.log" 2>&1 <<'SQL'
begin;
set local statement_timeout='10s';
select set_config('p4.race_character', :'character_id', true);
set local role service_role;
select public.activate_phase4_combat_interactions_v2();
reset role;
do $$
declare c uuid := current_setting('p4.race_character')::uuid;
begin
 assert (select activated_at is not null from app_private.phase4_combat_publication), 'Retry activates release';
 assert (select build_version=4 from app_private.character_active_builds where character_id=c), 'Retry advances build once';
 assert (select count(*)=8 from app_private.character_skill_unlocks where character_id=c), 'Real provisioning completed without duplication';
 assert (select skill_content_version=2 from app_private.character_skill_unlocks where character_id=c and skill_id='shadehand.smoke-vial'), 'Retry upgrades learned version';
 assert (select skill_content_version=2 from app_private.character_build_discipline_skills where character_id=c and skill_id='shadehand.smoke-vial'), 'Retry upgrades selected version';
 assert (select count(*)=1 from app_private.character_skill_loadout_change_audit where character_id=c and request_fingerprint='publication:phase4-combat-interactions-v2' and build_version_before=3 and build_version_after=4), 'Exactly one publication audit after retry';
end;
$$;
rollback;
SQL
echo 'Phase 4 parent-row publication race: retryable busy, unchanged state, real provisioning and successful retry PASS.'
