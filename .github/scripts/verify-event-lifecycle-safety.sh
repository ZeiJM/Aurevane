#!/usr/bin/env bash
set -euo pipefail
# Disposable native gate after the existing Event reward/operations fixtures.
# No synthetic grant executor: every award below calls execute_event_reward_claim_v1
# and its real grant_character_xp_v1 dependency. No daemon/production producer is implied.
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
query() { docker exec "$db_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "$1"; }
owner="$(query "select user_id from app_private.master_panel_role_assignments where role='game-owner' and enabled limit 1")"
character="$(query "select character_id from app_private.event_reward_claim_reservations where reward_package_ref='reward.p412-xp' order by reserved_at limit 1")"
user="$(query "select user_id from public.characters where id='$character'")"
version="$(query "select id from app_private.event_definition_versions where event_key='event.p412-reward' order by definition_version desc limit 1")"
test -n "$owner"; test -n "$character"; test -n "$user"; test -n "$version"
old_xp_ids="$(query "select array_agg(id)::text from app_private.character_xp_grants")"
old_xp="$(query "select md5(jsonb_agg(to_jsonb(g) order by id)::text) from app_private.character_xp_grants g where id=any('$old_xp_ids'::uuid[])")"
other_characters="$(query "select md5(coalesce(jsonb_agg(to_jsonb(c) order by id),'[]')::text) from public.characters c where id<>'$character'")"
receipt_dir="$(mktemp -d /tmp/task12-lifecycle.XXXXXX)"
trap 'cat "$receipt_dir"/*.log 2>/dev/null || true' EXIT

prepare_claim() {
  query "
    insert into app_private.event_runs(id,event_key,definition_version_id,run_mode,lifecycle_status,scope_type,current_phase_id,started_at,created_by)
    values('$1','event.p412-reward','$version','production','live','global','mobilization',clock_timestamp(),'$owner');
    insert into app_private.event_run_phases(run_id,phase_id,ordinal,phase_status,started_at) values('$1','mobilization',0,'live',clock_timestamp());
    insert into app_private.event_run_objectives(run_id,phase_id,objective_id,objective_status,target) values('$1','mobilization','community','active',1);
    set role service_role;
    select * from public.record_event_contribution_v1('system:task12-fixture',gen_random_uuid(),'contribution','$1','$user','$character','mobilization','community','test','source:$1',1,'{\"fixture\":true}');
    select * from public.transition_event_run_v1('$1',1,gen_random_uuid(),'resolving',null);
    select * from public.transition_event_run_v1('$1',2,gen_random_uuid(),'ended',null);
    select * from public.reserve_event_reward_claim_v1('system:task12-fixture',gen_random_uuid(),'reservation','$1','$user','$character','reward.p412-xp','{\"fixture\":true}');
  " >"$receipt_dir/setup-$1.log"
  query "select id from app_private.event_reward_claim_reservations where run_id='$1'"
}
stop_sql() { printf "%s" "set role service_role; select * from public.operate_event_run_v2('$owner',null::uuid,'$1',3,'$2','emergency-stop',null,true);"; }
claim_sql() { printf "%s" "set role service_role; select * from public.execute_event_reward_claim_v1('$1','$2','task12:claim','system:task12-fixture');"; }
wait_state() {
  local app="$1" condition="$2"
  for _ in $(seq 1 30); do
    if test "$(query "select count(*) from pg_stat_activity where application_name='$app' and ($condition)")" = 1; then return; fi
    sleep .1
  done
  echo "Missing actual database contention state: $app $condition" >&2; exit 1
}
# Both serialized outcomes: first holds its actual RPC locks until commit; second
# must wait on a PostgreSQL lock, not a JavaScript/mock completion status.
for order in claim-first emergency-first; do
  run="$(query 'select gen_random_uuid()')"
  claim="$(prepare_claim "$run")"
  ended_at="$(query "select ended_at from app_private.event_runs where id='$run'")"
  claim_key="$(query 'select gen_random_uuid()')"; stop_key="$(query 'select gen_random_uuid()')"
  if test "$order" = claim-first; then first="$(claim_sql "$claim" "$claim_key")"; second="$(stop_sql "$run" "$stop_key")";
  else first="$(stop_sql "$run" "$stop_key")"; second="$(claim_sql "$claim" "$claim_key")"; fi
  query "set application_name='task12-first'; begin; $first select pg_sleep(5); commit;" >"$receipt_dir/$order-first.log" 2>&1 & first_pid=$!
  wait_state task12-first "wait_event='PgSleep'"
  query "set application_name='task12-second'; $second" >"$receipt_dir/$order-second.log" 2>&1 & second_pid=$!
  wait_state task12-second "wait_event_type='Lock'"
  wait "$first_pid"
  if test "$order" = claim-first; then
    wait "$second_pid"
    test "$(query "select count(*) from app_private.event_reward_claim_executions where reservation_id='$claim'")" = 1
    awarded="$(query "select xp_grant_id from app_private.event_reward_claim_executions where reservation_id='$claim'")"
    before="$(query "select row_to_json(g)::text from app_private.character_xp_grants g where id='$awarded'")"
    # Repeated same-key and new-key receipts preserve the already-awarded outcome after stop.
    query "$(claim_sql "$claim" "$claim_key")" >"$receipt_dir/$order-repeat.log"
    query "$(claim_sql "$claim" "$(query 'select gen_random_uuid()')")" >"$receipt_dir/$order-dedup.log"
    test "$(query "select row_to_json(g)::text from app_private.character_xp_grants g where id='$awarded'")" = "$before"
  else
    if wait "$second_pid"; then echo 'Late claim unexpectedly awarded after emergency stop' >&2; exit 1; fi
    grep -Fq EVENT_REWARD_EXECUTION_RUN_NOT_TERMINAL "$receipt_dir/$order-second.log"
    test "$(query "select count(*) from app_private.event_reward_claim_executions where reservation_id='$claim'")" = 0
  fi
  test "$(query "select ended_at from app_private.event_runs where id='$run'")" = "$ended_at"
  # Idempotent repeated stop cannot replay transitions/rewards. Archive cannot reopen claims.
  query "$(stop_sql "$run" "$stop_key")" >"$receipt_dir/$order-stop-repeat.log"
  test "$(query "select state_version from app_private.event_runs where id='$run'")" = 4
  # The real cron sweep is also a late caller: emergency termination stays closed.
  query "select * from app_private.recover_due_event_runs_v1(100)" >"$receipt_dir/$order-late-recovery.log"
  test "$(query "select lifecycle_status||':'||state_version from app_private.event_runs where id='$run'")" = emergency-stopped:4
  query "set role service_role; select * from public.operate_event_run_v2('$owner',null::uuid,'$run',4,gen_random_uuid(),'archive',null,true);" >"$receipt_dir/$order-archive.log"
  if test "$order" = emergency-first; then
    if query "$(claim_sql "$claim" "$(query 'select gen_random_uuid()')")" >"$receipt_dir/archived-late.log" 2>&1; then exit 1; fi
    grep -Fq EVENT_REWARD_EXECUTION_RUN_NOT_TERMINAL "$receipt_dir/archived-late.log"
  fi
  test "$(query "select terminal_status from app_private.event_run_chronicle_entries where run_id='$run'")" = emergency-stopped
  query "select * from app_private.recover_due_event_runs_v1(100)" >"$receipt_dir/$order-archived-recovery.log"
  test "$(query "select lifecycle_status||':'||state_version from app_private.event_runs where id='$run'")" = archived:5
  echo "$order: real lock wait and settlement outcome verified"
done

# Roll back both cancellation and a real award in the same outer transaction.
# The run, all historic claims/XP, unrelated character facts and audit rows must be exact.
run="$(query 'select gen_random_uuid()')"; claim="$(prepare_claim "$run")"
state_sql="select md5(jsonb_build_object('runs',(select jsonb_agg(to_jsonb(r) order by id) from app_private.event_runs r),'claims',(select jsonb_agg(to_jsonb(c) order by reservation_id) from app_private.event_reward_claim_executions c),'xp',(select jsonb_agg(to_jsonb(g) order by id) from app_private.character_xp_grants g),'characters',(select jsonb_agg(to_jsonb(c) order by id) from public.characters c),'idempotency',(select jsonb_agg(to_jsonb(i) order by actor_key,command_name,idempotency_key) from app_private.idempotency_records i),'transitions',(select jsonb_agg(to_jsonb(t) order by id) from app_private.event_run_transitions t),'reservations',(select jsonb_agg(to_jsonb(r) order by id) from app_private.event_reward_claim_reservations r),'audits',(select jsonb_agg(to_jsonb(a) order by id) from app_private.event_operations_audit a))::text)"
before="$(query "$state_sql")"
query "begin; $(claim_sql "$claim" "$(query 'select gen_random_uuid()')") $(stop_sql "$run" "$(query 'select gen_random_uuid()')") rollback;" >"$receipt_dir/rollback.log"
test "$(query "$state_sql")" = "$before"
echo 'Event settlement rollback preserves every compared run/claim/XP/character/audit fact.'

test "$(query "select md5(jsonb_agg(to_jsonb(g) order by id)::text) from app_private.character_xp_grants g where id=any('$old_xp_ids'::uuid[])")" = "$old_xp"
test "$(query "select md5(coalesce(jsonb_agg(to_jsonb(c) order by id),'[]')::text) from public.characters c where id<>'$character'")" = "$other_characters"
echo 'All prior XP receipts and unrelated characters remain exact.'
