#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

owner_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select user_id::text
  from app_private.master_panel_role_assignments
  where role = 'game-owner' and enabled = true
  limit 1;")"
test -n "$owner_id"

staff_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select target_user_id::text
  from app_private.master_panel_access_audit
  where actor_user_id = '$owner_id'::uuid
  order by created_at, id
  limit 1;")"
test -n "$staff_id"
test "$staff_id" != "$owner_id"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.grant_master_panel_role_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'event-staff',
    'P4.13 Event Builder verification'
  );
" >/dev/null

staff_access="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select array_to_string(roles, ',')
  from public.read_master_panel_access_v1('$staff_id'::uuid);")"
test "$staff_access" = 'event-staff'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_reward_budget_policies (
    budget_ref, reward_kind, max_per_claim, approved_by
  ) values (
    'budget.p413-ci','character-xp',100,'$owner_id'::uuid
  )
  on conflict (budget_ref) do nothing;

  insert into app_private.event_reward_packages (
    reward_package_ref, package_version, budget_ref, reward_kind, amount, published_by
  ) values (
    'reward.p413-ci',1,'budget.p413-ci','character-xp',25,'$owner_id'::uuid
  )
  on conflict (reward_package_ref) do nothing;
" >/dev/null

definition_sql() {
  local event_key="$1"
  local scope_type="$2"
  local scope_key="$3"
  local reward_ref="$4"
  if [ "$scope_type" = 'global' ]; then
    printf "%s" "jsonb_build_object(
      'schemaVersion',1,
      'eventKey','$event_key',
      'templateKey','template.p413-ci',
      'contentVersion',1,
      'title','P4.13 Builder Verification',
      'summary','Typed Event Builder verification fixture.',
      'internalNotes','CI only.',
      'family','regional-event',
      'scope',jsonb_build_object('type','global'),
      'phases',jsonb_build_array(
        jsonb_build_object(
          'id','mobilization',
          'name','Mobilization',
          'objectives',jsonb_build_array(
            jsonb_build_object(
              'id','community',
              'type','community-threshold',
              'referenceKey','objective.p413-community',
              'target',10
            )
          ),
          'effects',jsonb_build_array(
            jsonb_build_object(
              'type','world-pulse',
              'referenceKey','announcement.p413-live',
              'enabled',true
            )
          ),
          'cleanupEffects',jsonb_build_array(
            jsonb_build_object(
              'type','world-pulse',
              'referenceKey','announcement.p413-live',
              'enabled',false
            )
          ),
          'transition',jsonb_build_object(
            'type','objective-threshold',
            'objectiveId','community'
          )
        )
      ),
      'rewardPackageRefs',jsonb_build_array('$reward_ref'),
      'aftermathRefs',jsonb_build_array('aftermath.p413-ci')
    )"
  else
    printf "%s" "jsonb_build_object(
      'schemaVersion',1,
      'eventKey','$event_key',
      'templateKey','template.p413-ci',
      'contentVersion',1,
      'title','P4.13 Builder Verification',
      'summary','Typed Event Builder verification fixture.',
      'internalNotes','CI only.',
      'family','regional-event',
      'scope',jsonb_build_object('type','$scope_type','key','$scope_key'),
      'phases',jsonb_build_array(
        jsonb_build_object(
          'id','mobilization',
          'name','Mobilization',
          'objectives',jsonb_build_array(
            jsonb_build_object(
              'id','community',
              'type','community-threshold',
              'referenceKey','objective.p413-community',
              'target',10
            )
          ),
          'effects',jsonb_build_array(
            jsonb_build_object(
              'type','world-pulse',
              'referenceKey','announcement.p413-live',
              'enabled',true
            )
          ),
          'cleanupEffects',jsonb_build_array(
            jsonb_build_object(
              'type','world-pulse',
              'referenceKey','announcement.p413-live',
              'enabled',false
            )
          ),
          'transition',jsonb_build_object(
            'type','objective-threshold',
            'objectiveId','community'
          )
        )
      ),
      'rewardPackageRefs',jsonb_build_array('$reward_ref'),
      'aftermathRefs',jsonb_build_array('aftermath.p413-ci')
    )"
  fi
}

regional_definition="$(definition_sql 'event.p413-ci' 'region' 'region.frostmere' 'reward.p413-ci')"

draft_one="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select event_key || '|' || draft_version::text
  from public.save_event_definition_draft_v1(
    '$staff_id'::uuid,
    'event.p413-ci',
    $regional_definition,
    null,
    null
  );")"
test "$draft_one" = 'event.p413-ci|1'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.save_event_definition_draft_v1(
    '$staff_id'::uuid,
    'event.p413-ci',
    $regional_definition,
    null,
    null
  );" >/tmp/p413-stale-draft.out 2>/tmp/p413-stale-draft.err; then
  echo 'Expected stale Event draft save to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_DRAFT_VERSION_CONFLICT' /tmp/p413-stale-draft.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.publish_event_definition_v2(
    '$staff_id'::uuid,
    'event.p413-ci',
    $regional_definition,
    null,
    '00000000-0000-4000-8000-000000004301'::uuid,
    'P4.13 capability denial publication',
    true
  );" >/tmp/p413-publish-cap.out 2>/tmp/p413-publish-cap.err; then
  echo 'Expected Event Staff publication without production capability to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_PRODUCTION_PUBLISH_CAPABILITY_REQUIRED' /tmp/p413-publish-cap.err

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.grant_master_panel_capability_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'events.production_publish',
    'P4.13 production publication verification'
  );
" >/dev/null

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.publish_event_definition_v2(
    '$staff_id'::uuid,
    'event.p413-ci',
    $regional_definition,
    null,
    '00000000-0000-4000-8000-000000004302'::uuid,
    'P4.13 missing confirmation verification',
    false
  );" >/tmp/p413-confirmation.out 2>/tmp/p413-confirmation.err; then
  echo 'Expected unconfirmed Event publication to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_ACTION_CONFIRMATION_REQUIRED' /tmp/p413-confirmation.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.publish_event_definition_v2(
    '$staff_id'::uuid,
    'event.p413-ci',
    $regional_definition,
    null,
    '00000000-0000-4000-8000-000000004303'::uuid,
    'x',
    true
  );" >/tmp/p413-reason.out 2>/tmp/p413-reason.err; then
  echo 'Expected Event publication without a valid reason to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_ACTION_REASON_REQUIRED' /tmp/p413-reason.err

missing_reward_definition="$(definition_sql 'event.p413-missing-reward' 'region' 'region.frostmere' 'reward.p413-missing')"
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.publish_event_definition_v2(
    '$staff_id'::uuid,
    'event.p413-missing-reward',
    $missing_reward_definition,
    null,
    '00000000-0000-4000-8000-000000004304'::uuid,
    'P4.13 missing reward publication',
    true
  );" >/tmp/p413-reward-dependency.out 2>/tmp/p413-reward-dependency.err; then
  echo 'Expected publication with a missing Reward Package to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_REWARD_PACKAGE_DEPENDENCY_MISSING' /tmp/p413-reward-dependency.err

published="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select event_key || '|' || definition_version::text
  from public.publish_event_definition_v2(
    '$staff_id'::uuid,
    'event.p413-ci',
    $regional_definition,
    null,
    '00000000-0000-4000-8000-000000004305'::uuid,
    'P4.13 verified regional publication',
    true
  );")"
test "$published" = 'event.p413-ci|1'

published_replay="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select event_key || '|' || definition_version::text
  from public.publish_event_definition_v2(
    '$staff_id'::uuid,
    'event.p413-ci',
    $regional_definition,
    null,
    '00000000-0000-4000-8000-000000004305'::uuid,
    'P4.13 verified regional publication',
    true
  );")"
test "$published_replay" = "$published"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.publish_event_definition_v2(
    '$staff_id'::uuid,
    'event.p413-ci',
    $regional_definition || jsonb_build_object('title','Different request'),
    null,
    '00000000-0000-4000-8000-000000004305'::uuid,
    'P4.13 verified regional publication',
    true
  );" >/tmp/p413-publish-replay-conflict.out 2>/tmp/p413-publish-replay-conflict.err; then
  echo 'Expected reused publication correlation key with changed definition to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_AUTHORING_IDEMPOTENCY_CONFLICT' /tmp/p413-publish-replay-conflict.err

forbidden_definition="$regional_definition || jsonb_build_object('script','select * from secrets')"
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.save_event_definition_draft_v1(
    '$staff_id'::uuid,
    'event.p413-ci',
    $forbidden_definition,
    1,
    2
  );" >/tmp/p413-forbidden.out 2>/tmp/p413-forbidden.err; then
  echo 'Expected arbitrary script key in Event definition to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_DEFINITION_INVALID' /tmp/p413-forbidden.err

schedule_start="$(date -u -d '+2 hours' '+%Y-%m-%dT%H:%M:%SZ')"
schedule_end="$(date -u -d '+4 hours' '+%Y-%m-%dT%H:%M:%SZ')"

scheduled="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select run_id::text || '|' || state_version::text || '|' || replayed::text
  from public.schedule_event_run_v2(
    '$staff_id'::uuid,
    'event.p413-ci',
    '00000000-0000-4000-8000-000000004311'::uuid,
    'p413:schedule:one',
    '$schedule_start'::timestamptz,
    '$schedule_end'::timestamptz,
    'P4.13 verified schedule',
    true
  );")"
scheduled_run_id="${scheduled%%|*}"
test -n "$scheduled_run_id"
test "$(printf '%s' "$scheduled" | cut -d'|' -f2-3)" = '1|false'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.schedule_event_run_v2(
    '$staff_id'::uuid,
    'event.p413-ci',
    '00000000-0000-4000-8000-000000004312'::uuid,
    'p413:schedule:overlap',
    '$schedule_start'::timestamptz,
    '$schedule_end'::timestamptz,
    'P4.13 overlapping schedule verification',
    true
  );" >/tmp/p413-scope-conflict.out 2>/tmp/p413-scope-conflict.err; then
  echo 'Expected overlapping Event schedule in the same scope to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_SCHEDULE_SCOPE_CONFLICT' /tmp/p413-scope-conflict.err

cancelled="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.cancel_scheduled_event_run_v2(
    '$staff_id'::uuid,
    '$scheduled_run_id'::uuid,
    1,
    '00000000-0000-4000-8000-000000004313'::uuid,
    'P4.13 unschedule verification',
    true
  );")"
test "$cancelled" = 'cancelled|2'

audit_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    count(*)::text || '|' ||
    string_agg(action, ',' order by occurred_at, action)
  from app_private.event_authoring_audit
  where actor_user_id = '$staff_id'::uuid;")"
test "$audit_snapshot" = '3|publish,schedule,unschedule'

# Different Event definitions targeting the same scope must serialize their overlap check.
# A delay before the run insert makes the race deterministic: without the scope lock both
# sessions can pass the conflict check before either row becomes visible.
race_a_definition="$(definition_sql 'event.p413-race-a' 'region' 'region.frostmere' 'reward.p413-ci')"
race_b_definition="$(definition_sql 'event.p413-race-b' 'region' 'region.frostmere' 'reward.p413-ci')"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.publish_event_definition_v2(
    '$owner_id'::uuid,
    'event.p413-race-a',
    $race_a_definition,
    null,
    '00000000-0000-4000-8000-000000004314'::uuid,
    'P4.13 concurrent scope fixture A',
    true
  );
  select * from public.publish_event_definition_v2(
    '$owner_id'::uuid,
    'event.p413-race-b',
    $race_b_definition,
    null,
    '00000000-0000-4000-8000-000000004315'::uuid,
    'P4.13 concurrent scope fixture B',
    true
  );
" >/dev/null

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  create or replace function app_private.delay_p413_schedule_insert_for_test()
  returns trigger
  language plpgsql
  as \$\$
  begin
    if new.event_key in ('event.p413-race-a','event.p413-race-b') then
      perform pg_sleep(2);
    end if;
    return new;
  end;
  \$\$;

  create trigger delay_p413_schedule_insert_for_test
  before insert on app_private.event_runs
  for each row execute function app_private.delay_p413_schedule_insert_for_test();
" >/dev/null

schedule_scope_race() {
  local event_key="$1"
  local idempotency_key="$2"
  local fingerprint="$3"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select run_id::text || '|' || state_version::text || '|' || replayed::text
    from public.schedule_event_run_v2(
      '$owner_id'::uuid,
      '$event_key',
      '$idempotency_key'::uuid,
      '$fingerprint',
      '$schedule_start'::timestamptz,
      '$schedule_end'::timestamptz,
      'P4.13 concurrent same-scope schedule verification',
      true
    );"
}

schedule_scope_race \
  'event.p413-race-a' \
  '00000000-0000-4000-8000-000000004316' \
  'p413:schedule:race-a' \
  >/tmp/p413-schedule-race-a.out 2>/tmp/p413-schedule-race-a.err &
race_a_pid=$!

schedule_scope_race \
  'event.p413-race-b' \
  '00000000-0000-4000-8000-000000004317' \
  'p413:schedule:race-b' \
  >/tmp/p413-schedule-race-b.out 2>/tmp/p413-schedule-race-b.err &
race_b_pid=$!

set +e
wait "$race_a_pid"
race_a_status=$?
wait "$race_b_pid"
race_b_status=$?
set -e

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  drop trigger delay_p413_schedule_insert_for_test on app_private.event_runs;
  drop function app_private.delay_p413_schedule_insert_for_test();
" >/dev/null

if [ "$race_a_status" -eq 0 ] && [ "$race_b_status" -ne 0 ]; then
  race_winner="$(cat /tmp/p413-schedule-race-a.out)"
  race_error_file=/tmp/p413-schedule-race-b.err
elif [ "$race_b_status" -eq 0 ] && [ "$race_a_status" -ne 0 ]; then
  race_winner="$(cat /tmp/p413-schedule-race-b.out)"
  race_error_file=/tmp/p413-schedule-race-a.err
else
  echo 'Expected exactly one concurrent same-scope Event schedule to succeed.' >&2
  cat /tmp/p413-schedule-race-a.err >&2 || true
  cat /tmp/p413-schedule-race-b.err >&2 || true
  exit 1
fi

grep -Fq 'EVENT_SCHEDULE_SCOPE_CONFLICT' "$race_error_file"
race_run_id="$(printf '%s' "$race_winner" | cut -d'|' -f1)"
test -n "$race_run_id"
test "$(printf '%s' "$race_winner" | cut -d'|' -f2-3)" = '1|false'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.cancel_scheduled_event_run_v2(
    '$owner_id'::uuid,
    '$race_run_id'::uuid,
    1,
    '00000000-0000-4000-8000-000000004318'::uuid,
    'P4.13 concurrent scope fixture cleanup',
    true
  );
" >/dev/null

v1_privileges="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    has_function_privilege(
      'service_role',
      'public.publish_event_definition_v1(uuid,text,jsonb,integer)',
      'EXECUTE'
    )::text || '|' ||
    has_function_privilege(
      'service_role',
      'public.schedule_event_run_v1(uuid,text,uuid,text,timestamptz,timestamptz)',
      'EXECUTE'
    )::text || '|' ||
    has_function_privilege(
      'service_role',
      'public.cancel_scheduled_event_run_v1(uuid,uuid,bigint,uuid,text)',
      'EXECUTE'
    )::text;")"
test "$v1_privileges" = 'false|false|false'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  insert into app_private.event_authoring_audit (
    action, correlation_key, actor_user_id, event_key, reason, result
  ) values (
    'publish',
    '00000000-0000-4000-8000-000000004399'::uuid,
    '$staff_id'::uuid,
    'event.p413-forged',
    'forged audit',
    jsonb_build_object('forged',true)
  );" >/tmp/p413-audit-write.out 2>/tmp/p413-audit-write.err; then
  echo 'Service role unexpectedly forged Event authoring audit history.' >&2
  exit 1
fi
grep -Fq 'permission denied for table event_authoring_audit' /tmp/p413-audit-write.err

global_definition="$(definition_sql 'event.p413-global' 'global' '' 'reward.p413-ci')"
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.publish_event_definition_v2(
    '$staff_id'::uuid,
    'event.p413-global',
    $global_definition,
    null,
    '00000000-0000-4000-8000-000000004309'::uuid,
    'P4.13 global scope denial publication',
    true
  );" >/tmp/p413-global-cap.out 2>/tmp/p413-global-cap.err; then
  echo 'Expected global Event publication without global-scope capability to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_GLOBAL_SCOPE_CAPABILITY_REQUIRED' /tmp/p413-global-cap.err

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.grant_master_panel_capability_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'events.global_scope',
    'P4.13 global scope verification'
  );
" >/dev/null

global_published="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select event_key || '|' || definition_version::text
  from public.publish_event_definition_v2(
    '$staff_id'::uuid,
    'event.p413-global',
    $global_definition,
    null,
    '00000000-0000-4000-8000-000000004310'::uuid,
    'P4.13 verified global publication',
    true
  );")"
test "$global_published" = 'event.p413-global|1'

audit_total="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)::text
  from app_private.event_authoring_audit
  where actor_user_id = '$staff_id'::uuid;")"
test "$audit_total" = '4'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.revoke_master_panel_capability_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'events.production_publish',
    'P4.13 replay reauthorization verification'
  );
" >/dev/null

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.publish_event_definition_v2(
    '$staff_id'::uuid,
    'event.p413-global',
    $global_definition,
    null,
    '00000000-0000-4000-8000-000000004310'::uuid,
    'P4.13 verified global publication',
    true
  );" >/tmp/p413-revoked-replay.out 2>/tmp/p413-revoked-replay.err; then
  echo 'Revoked Event Staff unexpectedly replayed a privileged publication receipt.' >&2
  exit 1
fi
grep -Fq 'EVENT_PRODUCTION_PUBLISH_CAPABILITY_REQUIRED' /tmp/p413-revoked-replay.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.save_event_definition_draft_v1(
    '$staff_id'::uuid,
    'event.browser-forged',
    jsonb_build_object('schemaVersion',1,'eventKey','event.browser-forged'),
    null,
    null
  );" >/tmp/p413-browser.out 2>/tmp/p413-browser.err; then
  echo 'Authenticated browser unexpectedly invoked Event Builder persistence.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from app_private.event_definition_drafts;" >/tmp/p413-direct-table.out 2>/tmp/p413-direct-table.err; then
  echo 'Service role unexpectedly read Event Builder private drafts directly.' >&2
  exit 1
fi

echo 'Phase 4 Event Builder database authority and conflict verification passed.'
