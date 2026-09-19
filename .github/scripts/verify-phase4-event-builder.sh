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
  order by occurred_at, id
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
  select * from public.publish_event_definition_v1(
    '$staff_id'::uuid,
    'event.p413-ci',
    $regional_definition,
    null
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

missing_reward_definition="$(definition_sql 'event.p413-missing-reward' 'region' 'region.frostmere' 'reward.p413-missing')"
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.publish_event_definition_v1(
    '$staff_id'::uuid,
    'event.p413-missing-reward',
    $missing_reward_definition,
    null
  );" >/tmp/p413-reward-dependency.out 2>/tmp/p413-reward-dependency.err; then
  echo 'Expected publication with a missing Reward Package to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_REWARD_PACKAGE_DEPENDENCY_MISSING' /tmp/p413-reward-dependency.err

published="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select event_key || '|' || definition_version::text
  from public.publish_event_definition_v1(
    '$staff_id'::uuid,
    'event.p413-ci',
    $regional_definition,
    null
  );")"
test "$published" = 'event.p413-ci|1'

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
  from public.schedule_event_run_v1(
    '$staff_id'::uuid,
    'event.p413-ci',
    '00000000-0000-4000-8000-000000004301'::uuid,
    'p413:schedule:one',
    '$schedule_start'::timestamptz,
    '$schedule_end'::timestamptz
  );")"
scheduled_run_id="${scheduled%%|*}"
test -n "$scheduled_run_id"
test "$(printf '%s' "$scheduled" | cut -d'|' -f2-3)" = '1|false'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.schedule_event_run_v1(
    '$staff_id'::uuid,
    'event.p413-ci',
    '00000000-0000-4000-8000-000000004302'::uuid,
    'p413:schedule:overlap',
    '$schedule_start'::timestamptz,
    '$schedule_end'::timestamptz
  );" >/tmp/p413-scope-conflict.out 2>/tmp/p413-scope-conflict.err; then
  echo 'Expected overlapping Event schedule in the same scope to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_SCHEDULE_SCOPE_CONFLICT' /tmp/p413-scope-conflict.err

cancelled="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.cancel_scheduled_event_run_v1(
    '$staff_id'::uuid,
    '$scheduled_run_id'::uuid,
    1,
    '00000000-0000-4000-8000-000000004303'::uuid,
    'P4.13 unschedule verification'
  );")"
test "$cancelled" = 'cancelled|2'

global_definition="$(definition_sql 'event.p413-global' 'global' '' 'reward.p413-ci')"
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.publish_event_definition_v1(
    '$staff_id'::uuid,
    'event.p413-global',
    $global_definition,
    null
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
  from public.publish_event_definition_v1(
    '$staff_id'::uuid,
    'event.p413-global',
    $global_definition,
    null
  );")"
test "$global_published" = 'event.p413-global|1'

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
