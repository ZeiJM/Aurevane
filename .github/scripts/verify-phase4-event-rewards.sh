#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P412-event-reward-2026!'
email="p412-event-reward-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
signup="$(signup_test_user "$email" "$password")"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$user_id"
test "$user_id" != 'null'
confirm_test_user "$user_id"

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

assert_error_contains() {
  local pattern="$1"
  local file="$2"
  local label="$3"

  if ! grep -Fq "$pattern" "$file"; then
    echo "Expected $label error containing: $pattern" >&2
    cat "$file" >&2 || true
    exit 1
  fi
}

wait_for_reward_process() {
  local pid="$1"
  local label="$2"
  local error_file="$3"

  if ! wait "$pid"; then
    echo "$label Event reward execution failed." >&2
    cat "$error_file" >&2 || true
    exit 1
  fi
}

character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select id::text
  from public.create_character_v3(
    '$user_id'::uuid,
    0::smallint,
    '00000000-0000-4000-8000-000000004121'::uuid,
    'p412:event-reward-character',
    1,
    'Pella Rewarder',
    'pellarewarder',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    12, 4, 7, 4, 3, 6
  );")"
test -n "$character_id"

version_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_templates (event_key, event_family, created_by)
  values ('event.p412-reward','community-objective','$user_id'::uuid);

  insert into app_private.event_definition_versions (
    event_key,
    definition_version,
    definition,
    published_by
  ) values (
    'event.p412-reward',
    1,
    jsonb_build_object(
      'schemaVersion',1,
      'eventKey','event.p412-reward',
      'templateKey','template.community-objective',
      'contentVersion',1,
      'title','P4.12 Reward Verification',
      'rewardPackageRefs',jsonb_build_array(
        'reward.p412-xp',
        'reward.p412-missing'
      )
    ),
    '$user_id'::uuid
  )
  returning id::text;")"
test -n "$version_id"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_publications (event_key, version_id, updated_by)
  values ('event.p412-reward','$version_id'::uuid,'$user_id'::uuid);

  insert into app_private.event_reward_budget_policies (
    budget_ref,
    reward_kind,
    max_per_claim,
    approved_by
  ) values (
    'budget.p412-xp-standard',
    'character-xp',
    100,
    '$user_id'::uuid
  );

  insert into app_private.event_reward_packages (
    reward_package_ref,
    package_version,
    budget_ref,
    reward_kind,
    amount,
    published_by
  ) values (
    'reward.p412-xp',
    1,
    'budget.p412-xp-standard',
    'character-xp',
    25,
    '$user_id'::uuid
  );
" >/dev/null

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.event_reward_packages
  set amount = 50
  where reward_package_ref = 'reward.p412-xp';" >/tmp/p412-package-update.out 2>/tmp/p412-package-update.err; then
  echo 'Expected immutable Event Reward Package update to fail.' >&2
  exit 1
fi
assert_error_contains 'EVENT_REWARD_PACKAGE_IMMUTABLE' /tmp/p412-package-update.err 'immutable package update'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_reward_packages (
    reward_package_ref,
    package_version,
    budget_ref,
    reward_kind,
    amount,
    published_by
  ) values (
    'reward.p412-over-budget',
    1,
    'budget.p412-xp-standard',
    'character-xp',
    101,
    '$user_id'::uuid
  );" >/tmp/p412-package-budget.out 2>/tmp/p412-package-budget.err; then
  echo 'Expected over-budget Event Reward Package to fail.' >&2
  exit 1
fi
assert_error_contains 'EVENT_REWARD_BUDGET_EXCEEDED' /tmp/p412-package-budget.err 'over-budget package publication'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  insert into app_private.event_reward_packages (
    reward_package_ref,
    package_version,
    budget_ref,
    reward_kind,
    amount,
    published_by
  ) values (
    'reward.p412-forged',
    1,
    'budget.p412-xp-standard',
    'character-xp',
    99,
    '$user_id'::uuid
  );" >/tmp/p412-package-direct.out 2>/tmp/p412-package-direct.err; then
  echo 'Service role unexpectedly published an Event Reward Package directly.' >&2
  exit 1
fi
assert_error_contains 'permission denied for table event_reward_packages' /tmp/p412-package-direct.err 'direct service-role package publication'

run_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_runs (
    event_key,
    definition_version_id,
    run_mode,
    lifecycle_status,
    scope_type,
    current_phase_id,
    created_by
  ) values (
    'event.p412-reward',
    '$version_id'::uuid,
    'production',
    'live',
    'global',
    'mobilization',
    '$user_id'::uuid
  )
  returning id::text;")"
test -n "$run_id"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_run_phases (
    run_id, phase_id, ordinal, phase_status, started_at
  ) values (
    '$run_id'::uuid, 'mobilization', 0, 'live', clock_timestamp()
  );

  insert into app_private.event_run_objectives (
    run_id,
    phase_id,
    objective_id,
    objective_status,
    progress,
    target
  ) values (
    '$run_id'::uuid,
    'mobilization',
    'community',
    'active',
    0,
    1
  );
" >/dev/null

contribution="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select contribution_id::text
  from public.record_event_contribution_v1(
    'source:p412-reward',
    '00000000-0000-4000-8000-000000004122'::uuid,
    'p412:reward:contribution',
    '$run_id'::uuid,
    '$user_id'::uuid,
    '$character_id'::uuid,
    'mobilization',
    'community',
    'combat',
    'battle.intent:p412-reward',
    1,
    jsonb_build_object('source','ci','purpose','reward')
  );")"
test -n "$contribution"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.transition_event_run_v1(
    '$run_id'::uuid,
    1,
    '00000000-0000-4000-8000-000000004123'::uuid,
    'resolving',
    'P4.12 reward resolve'
  );
  select * from public.transition_event_run_v1(
    '$run_id'::uuid,
    2,
    '00000000-0000-4000-8000-000000004124'::uuid,
    'ended',
    'P4.12 reward end'
  );
" >/dev/null

reservation_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select reservation_id::text
  from public.reserve_event_reward_claim_v1(
    'source:p412-rewards',
    '00000000-0000-4000-8000-000000004125'::uuid,
    'p412:reward:reserve',
    '$run_id'::uuid,
    '$user_id'::uuid,
    '$character_id'::uuid,
    'reward.p412-xp',
    jsonb_build_object('basis','participated','version',1)
  );")"
test -n "$reservation_id"

missing_reservation_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select reservation_id::text
  from public.reserve_event_reward_claim_v1(
    'source:p412-rewards',
    '00000000-0000-4000-8000-000000004126'::uuid,
    'p412:reward:reserve-missing',
    '$run_id'::uuid,
    '$user_id'::uuid,
    '$character_id'::uuid,
    'reward.p412-missing',
    jsonb_build_object('basis','participated','version',1)
  );")"
test -n "$missing_reservation_id"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  insert into app_private.event_reward_claim_executions (
    reservation_id,
    run_id,
    character_id,
    reward_package_ref,
    xp_grant_id,
    requested_amount,
    applied_amount
  ) values (
    '$reservation_id'::uuid,
    '$run_id'::uuid,
    '$character_id'::uuid,
    'reward.p412-xp',
    gen_random_uuid(),
    25,
    25
  );" >/tmp/p412-execution-direct.out 2>/tmp/p412-execution-direct.err; then
  echo 'Service role unexpectedly forged an Event reward execution receipt.' >&2
  exit 1
fi
assert_error_contains 'permission denied for table event_reward_claim_executions' /tmp/p412-execution-direct.err 'direct service-role execution receipt'

execute_reward() {
  local idempotency_key="$1"
  local fingerprint="$2"
  local reservation="${3:-$reservation_id}"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      reservation_id::text || '|' ||
      reward_package_ref || '|' ||
      xp_grant_id::text || '|' ||
      requested_amount::text || '|' ||
      applied_amount::text || '|' ||
      replayed::text || '|' ||
      claim_deduplicated::text
    from public.execute_event_reward_claim_v1(
      '$reservation'::uuid,
      '$idempotency_key'::uuid,
      '$fingerprint',
      'service:p412-event-rewards'
    );"
}

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  create or replace function app_private.delay_p412_event_reward_execution_for_test()
  returns trigger
  language plpgsql
  as \$\$
  begin
    if new.reservation_id = '$reservation_id'::uuid then
      perform pg_sleep(2);
    end if;
    return new;
  end;
  \$\$;

  create trigger delay_p412_event_reward_execution_for_test
  before insert on app_private.event_reward_claim_executions
  for each row execute function app_private.delay_p412_event_reward_execution_for_test();
" >/dev/null

execute_reward \
  '00000000-0000-4000-8000-000000004127' \
  'p412:reward:execute-a' \
  > /tmp/p412-reward-a.out 2>/tmp/p412-reward-a.err &
reward_a_pid=$!

execute_reward \
  '00000000-0000-4000-8000-000000004128' \
  'p412:reward:execute-b' \
  > /tmp/p412-reward-b.out 2>/tmp/p412-reward-b.err &
reward_b_pid=$!

wait_for_reward_process "$reward_a_pid" "First concurrent" /tmp/p412-reward-a.err
wait_for_reward_process "$reward_b_pid" "Second concurrent" /tmp/p412-reward-b.err

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  drop trigger delay_p412_event_reward_execution_for_test
    on app_private.event_reward_claim_executions;
  drop function app_private.delay_p412_event_reward_execution_for_test();
" >/dev/null

reward_a="$(cat /tmp/p412-reward-a.out)"
reward_b="$(cat /tmp/p412-reward-b.out)"
reward_a_xp="$(printf '%s' "$reward_a" | cut -d'|' -f3)"
reward_b_xp="$(printf '%s' "$reward_b" | cut -d'|' -f3)"
reward_a_claim_deduplicated="$(printf '%s' "$reward_a" | cut -d'|' -f7)"
test -n "$reward_a_xp"
test "$reward_a_xp" = "$reward_b_xp"
test "$(printf '%s\n%s\n' "$reward_a" "$reward_b" | cut -d'|' -f4-5 | sort -u)" = '25|25'
test "$(printf '%s\n%s\n' "$reward_a" "$reward_b" | cut -d'|' -f6 | sort -u)" = 'false'
test "$(printf '%s\n%s\n' "$reward_a" "$reward_b" | cut -d'|' -f7 | sort)" = "$(printf '%s\n%s\n' false true)"

replay="$(execute_reward \
  '00000000-0000-4000-8000-000000004127' \
  'p412:reward:execute-a')"
test "$(printf '%s' "$replay" | cut -d'|' -f3)" = "$reward_a_xp"
test "$(printf '%s' "$replay" | cut -d'|' -f6)" = 'true'
test "$(printf '%s' "$replay" | cut -d'|' -f7)" = "$reward_a_claim_deduplicated"

if execute_reward \
  '00000000-0000-4000-8000-000000004127' \
  'p412:reward:conflict' >/tmp/p412-reward-conflict.out 2>/tmp/p412-reward-conflict.err; then
  echo 'Expected conflicting Event reward execution idempotency fingerprint to fail.' >&2
  exit 1
fi
assert_error_contains 'EVENT_REWARD_EXECUTION_IDEMPOTENCY_CONFLICT' /tmp/p412-reward-conflict.err 'conflicting execution idempotency'

execution_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.event_reward_claim_executions
  where reservation_id = '$reservation_id'::uuid;")"
test "$execution_count" = '1'

xp_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.character_xp_grants
  where id = '$reward_a_xp'::uuid
    and character_id = '$character_id'::uuid
    and source_kind = 'gameplay'
    and reason_tag = 'event.reward'
    and requested_amount = 25
    and applied_amount = 25;")"
test "$xp_count" = '1'

if execute_reward \
  '00000000-0000-4000-8000-000000004129' \
  'p412:reward:missing' \
  "$missing_reservation_id" >/tmp/p412-missing-package.out 2>/tmp/p412-missing-package.err; then
  echo 'Expected missing Event Reward Package execution to fail closed.' >&2
  exit 1
fi
assert_error_contains 'EVENT_REWARD_PACKAGE_UNAVAILABLE' /tmp/p412-missing-package.err 'missing reward package execution'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.execute_event_reward_claim_v1(
    '$reservation_id'::uuid,
    '00000000-0000-4000-8000-000000004130'::uuid,
    'p412:browser:forged',
    'browser:forged'
  );" >/tmp/p412-browser-execution.out 2>/tmp/p412-browser-execution.err; then
  echo 'Authenticated browser unexpectedly executed an Event reward claim.' >&2
  exit 1
fi

echo 'Phase 4 Event Reward Package execution verified through the authoritative Character XP grant service.'
