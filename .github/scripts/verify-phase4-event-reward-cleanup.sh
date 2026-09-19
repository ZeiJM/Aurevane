#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

owner_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select created_by::text
  from app_private.event_templates
  where event_key = 'event.p52-participation';")"
test -n "$owner_id"

reservation_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select id::text
  from app_private.event_reward_claim_reservations
  where reward_package_ref = 'reward.p52-participation'
  order by reserved_at
  limit 1;")"
test -n "$reservation_id"

character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select character_id::text
  from app_private.event_reward_claim_reservations
  where id = '$reservation_id'::uuid;")"
test -n "$character_id"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_reward_budget_policies (
    budget_ref, reward_type, max_per_claim, created_by
  ) values (
    'budget.p4-event-xp.ci','character-xp',100,'$owner_id'::uuid
  );

  insert into app_private.event_reward_packages (
    reward_package_ref, package_version, budget_ref, definition, created_by
  ) values (
    'reward.p52-participation',
    1,
    'budget.p4-event-xp.ci',
    jsonb_build_object(
      'schemaVersion',1,
      'rewardPackageRef','reward.p52-participation',
      'packageVersion',1,
      'budgetRef','budget.p4-event-xp.ci',
      'rewards',jsonb_build_array(
        jsonb_build_object('type','character-xp','amount',75)
      )
    ),
    '$owner_id'::uuid
  );
" >/dev/null

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_reward_packages (
    reward_package_ref, package_version, budget_ref, definition, created_by
  ) values (
    'reward.p4-over-budget.v1',
    1,
    'budget.p4-event-xp.ci',
    jsonb_build_object(
      'schemaVersion',1,
      'rewardPackageRef','reward.p4-over-budget.v1',
      'packageVersion',1,
      'budgetRef','budget.p4-event-xp.ci',
      'rewards',jsonb_build_array(
        jsonb_build_object('type','character-xp','amount',101)
      )
    ),
    '$owner_id'::uuid
  );" >/tmp/p4-reward-budget.out 2>/tmp/p4-reward-budget.err; then
  echo 'Expected over-budget Event Reward Package to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_REWARD_BUDGET_EXCEEDED' /tmp/p4-reward-budget.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_reward_packages (
    reward_package_ref, package_version, budget_ref, definition, created_by
  ) values (
    'reward.p4-item-unsupported.v1',
    1,
    'budget.p4-event-xp.ci',
    jsonb_build_object(
      'schemaVersion',1,
      'rewardPackageRef','reward.p4-item-unsupported.v1',
      'packageVersion',1,
      'budgetRef','budget.p4-event-xp.ci',
      'rewards',jsonb_build_array(
        jsonb_build_object('type','item','amount',1)
      )
    ),
    '$owner_id'::uuid
  );" >/tmp/p4-reward-unsupported.out 2>/tmp/p4-reward-unsupported.err; then
  echo 'Expected unsupported Event reward type to fail closed.' >&2
  exit 1
fi
grep -Fq 'EVENT_REWARD_OPERATION_UNSUPPORTED' /tmp/p4-reward-unsupported.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  insert into app_private.event_reward_packages (
    reward_package_ref, package_version, budget_ref, definition, created_by
  ) values (
    'reward.p4-forged.v1',
    1,
    'budget.p4-event-xp.ci',
    '{}'::jsonb,
    '$owner_id'::uuid
  );" >/tmp/p4-reward-direct-write.out 2>/tmp/p4-reward-direct-write.err; then
  echo 'Service role unexpectedly wrote an Event Reward Package directly.' >&2
  exit 1
fi
grep -Fq 'permission denied for table event_reward_packages' /tmp/p4-reward-direct-write.err

plan="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    reservation_id::text || '|' ||
    reward_package_ref || '|' ||
    (package_definition -> 'rewards' -> 0 ->> 'type') || '|' ||
    (package_definition -> 'rewards' -> 0 ->> 'amount')
  from public.prepare_event_reward_claim_execution_v1('$reservation_id'::uuid);")"
test "$plan" = "$reservation_id|reward.p52-participation|character-xp|75"

xp_result="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select grant_id::text || '|' || applied_amount::text
  from public.grant_character_xp_v1(
    '$character_id'::uuid,
    '00000000-0000-5000-8000-000000004201'::uuid,
    'p4:event-reward:ci',
    'system:event-reward-ci',
    'gameplay',
    'event-reward.ci',
    'event.reward.character-xp',
    75
  );")"
grant_id="${xp_result%%|*}"
applied_amount="${xp_result##*|}"
test -n "$grant_id"

first_execution="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select claimed_at::text || '|' || replayed::text
  from public.record_event_reward_claim_execution_v1(
    '$reservation_id'::uuid,
    0,
    'character-xp',
    '$grant_id'::uuid,
    '$applied_amount'::bigint
  );")"
test "$(printf '%s' "$first_execution" | cut -d'|' -f2)" = 'false'

replay_execution="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select claimed_at::text || '|' || replayed::text
  from public.record_event_reward_claim_execution_v1(
    '$reservation_id'::uuid,
    0,
    'character-xp',
    '$grant_id'::uuid,
    '$applied_amount'::bigint
  );")"
test "$(printf '%s' "$replay_execution" | cut -d'|' -f2)" = 'true'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.record_event_reward_claim_execution_v1(
    '$reservation_id'::uuid,
    0,
    'character-xp',
    '00000000-0000-4000-8000-000000004299'::uuid,
    '$applied_amount'::bigint
  );" >/tmp/p4-reward-receipt-conflict.out 2>/tmp/p4-reward-receipt-conflict.err; then
  echo 'Expected conflicting Event reward execution receipt to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_REWARD_EXECUTION_RECEIPT_CONFLICT' /tmp/p4-reward-receipt-conflict.err

claimed_plan="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    (claimed_at is not null)::text || '|' ||
    execution_receipt_id::text || '|' ||
    execution_applied_amount::text
  from public.prepare_event_reward_claim_execution_v1('$reservation_id'::uuid);")"
test "$claimed_plan" = "true|$grant_id|$applied_amount"

history_fk_count="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)::text
  from pg_constraint constraint_row
  where constraint_row.contype = 'f'
    and constraint_row.conrelid in (
      'app_private.event_participants'::regclass,
      'app_private.event_contributions'::regclass,
      'app_private.event_reward_claim_reservations'::regclass
    )
    and constraint_row.confrelid in (
      'public.characters'::regclass,
      'public.player_profiles'::regclass
    );")"
test "$history_fk_count" = '0'

cleanup_version_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_templates (event_key, event_family, created_by)
  values ('event.p4-cleanup-ci','regional-event','$owner_id'::uuid);

  insert into app_private.event_definition_versions (
    event_key, definition_version, definition, published_by
  ) values (
    'event.p4-cleanup-ci',
    1,
    jsonb_build_object(
      'schemaVersion',1,
      'eventKey','event.p4-cleanup-ci',
      'templateKey','template.p4-cleanup-ci',
      'contentVersion',1,
      'title','P4 Cleanup Verification',
      'rewardPackageRefs',jsonb_build_array(),
      'phases',jsonb_build_array(
        jsonb_build_object(
          'id','live-phase',
          'cleanupEffects',jsonb_build_array(
            jsonb_build_object(
              'type','world-pulse',
              'referenceKey','announcement.p4-cleanup-ci',
              'enabled',false
            )
          )
        )
      )
    ),
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$cleanup_version_id"

cleanup_run_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key, definition_version_id, run_mode, lifecycle_status,
    scope_type, current_phase_id, started_at, created_by
  ) values (
    'event.p4-cleanup-ci',
    '$cleanup_version_id'::uuid,
    'production',
    'live',
    'global',
    'live-phase',
    clock_timestamp(),
    '$owner_id'::uuid
  )
  returning id::text;")"
test -n "$cleanup_run_id"

resolving="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.transition_event_run_v1(
    '$cleanup_run_id'::uuid,
    1,
    '00000000-0000-4000-8000-000000004211'::uuid,
    'resolving',
    'CI begin cleanup'
  );")"
test "$resolving" = 'resolving|2'

cleanup_state="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    state.cleanup_status || '|' ||
    item.item_status || '|' ||
    item.effect_type || '|' ||
    item.reference_key
  from app_private.event_run_cleanup_state as state
  join app_private.event_run_cleanup_items as item
    on item.run_id = state.run_id
  where state.run_id = '$cleanup_run_id'::uuid;")"
test "$cleanup_state" = 'pending|pending|world-pulse|announcement.p4-cleanup-ci'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.transition_event_run_v1(
    '$cleanup_run_id'::uuid,
    2,
    '00000000-0000-4000-8000-000000004212'::uuid,
    'ended',
    'CI end before cleanup'
  );" >/tmp/p4-cleanup-incomplete.out 2>/tmp/p4-cleanup-incomplete.err; then
  echo 'Expected Event end before cleanup completion to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_RUN_CLEANUP_INCOMPLETE' /tmp/p4-cleanup-incomplete.err

cleanup_receipt="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select cleanup_status || '|' || item_status || '|' || replayed::text
  from public.record_event_cleanup_item_v1(
    '$cleanup_run_id'::uuid,
    'live-phase',
    0,
    '00000000-0000-4000-8000-000000004213'::uuid,
    jsonb_build_object('adapter','ci','result','disabled')
  );")"
test "$cleanup_receipt" = 'completed|completed|false'

cleanup_replay="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select cleanup_status || '|' || item_status || '|' || replayed::text
  from public.record_event_cleanup_item_v1(
    '$cleanup_run_id'::uuid,
    'live-phase',
    0,
    '00000000-0000-4000-8000-000000004213'::uuid,
    jsonb_build_object('adapter','ci','result','disabled')
  );")"
test "$cleanup_replay" = 'completed|completed|true'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.record_event_cleanup_item_v1(
    '$cleanup_run_id'::uuid,
    'live-phase',
    0,
    '00000000-0000-4000-8000-000000004214'::uuid,
    jsonb_build_object('adapter','ci','result','different')
  );" >/tmp/p4-cleanup-conflict.out 2>/tmp/p4-cleanup-conflict.err; then
  echo 'Expected conflicting Event cleanup receipt to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_CLEANUP_RECEIPT_CONFLICT' /tmp/p4-cleanup-conflict.err

ended="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.transition_event_run_v1(
    '$cleanup_run_id'::uuid,
    2,
    '00000000-0000-4000-8000-000000004215'::uuid,
    'ended',
    'CI end after cleanup'
  );")"
test "$ended" = 'ended|3'

archived="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.transition_event_run_v1(
    '$cleanup_run_id'::uuid,
    3,
    '00000000-0000-4000-8000-000000004216'::uuid,
    'archived',
    'CI archive after cleanup'
  );")"
test "$archived" = 'archived|4'

scheduled_run_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key, definition_version_id, run_mode, lifecycle_status,
    scope_type, current_phase_id, created_by
  ) values (
    'event.p4-cleanup-ci',
    '$cleanup_version_id'::uuid,
    'production',
    'scheduled',
    'global',
    'live-phase',
    '$owner_id'::uuid
  )
  returning id::text;")"

cancelled="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.transition_event_run_v1(
    '$scheduled_run_id'::uuid,
    1,
    '00000000-0000-4000-8000-000000004217'::uuid,
    'cancelled',
    'CI cancel before start'
  );")"
test "$cancelled" = 'cancelled|2'

scheduled_cleanup="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select cleanup_status || '|' ||
    (select count(*)::text from app_private.event_run_cleanup_items where run_id = '$scheduled_run_id'::uuid)
  from app_private.event_run_cleanup_state
  where run_id = '$scheduled_run_id'::uuid;")"
test "$scheduled_cleanup" = 'completed|0'

cancelled_archive="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.transition_event_run_v1(
    '$scheduled_run_id'::uuid,
    2,
    '00000000-0000-4000-8000-000000004218'::uuid,
    'archived',
    'CI archive cancelled run'
  );")"
test "$cancelled_archive" = 'archived|3'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  update app_private.event_run_cleanup_items
  set item_status = 'pending'
  where run_id = '$cleanup_run_id'::uuid;" >/tmp/p4-cleanup-direct-write.out 2>/tmp/p4-cleanup-direct-write.err; then
  echo 'Service role unexpectedly mutated Event cleanup state directly.' >&2
  exit 1
fi
grep -Fq 'permission denied for table event_run_cleanup_items' /tmp/p4-cleanup-direct-write.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.prepare_event_reward_claim_execution_v1('$reservation_id'::uuid);" >/tmp/p4-reward-browser.out 2>/tmp/p4-reward-browser.err; then
  echo 'Authenticated browser unexpectedly read Event reward execution state.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.record_event_cleanup_item_v1(
    '$cleanup_run_id'::uuid,
    'live-phase',
    0,
    '00000000-0000-4000-8000-000000004219'::uuid,
    jsonb_build_object('adapter','browser')
  );" >/tmp/p4-cleanup-browser.out 2>/tmp/p4-cleanup-browser.err; then
  echo 'Authenticated browser unexpectedly acknowledged Event cleanup.' >&2
  exit 1
fi

echo 'Phase 4 Event reward execution and cleanup invariants verified.'
