#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P52-event-participation-2026!'
email_one="p52-event-participant-one-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
email_two="p52-event-participant-two-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

signup_one="$(signup_test_user "$email_one" "$password")"
signup_two="$(signup_test_user "$email_two" "$password")"
user_one="$(printf '%s' "$signup_one" | jq -r '.user.id')"
user_two="$(printf '%s' "$signup_two" | jq -r '.user.id')"
test -n "$user_one"
test -n "$user_two"
test "$user_one" != 'null'
test "$user_two" != 'null'

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

character_one="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select id::text
  from public.create_character_v3(
    '$user_one'::uuid,
    0::smallint,
    '00000000-0000-4000-8000-000000005301'::uuid,
    'p52:event-participant-one',
    1,
    'Pella Eventer',
    'pellaeventer',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    12, 4, 7, 4, 3, 6
  );")"
test -n "$character_one"

version_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.event_templates (event_key, event_family, created_by)
  values ('event.p52-participation','community-objective','$user_one'::uuid);

  insert into app_private.event_definition_versions (
    event_key,
    definition_version,
    definition,
    published_by
  ) values (
    'event.p52-participation',
    1,
    jsonb_build_object(
      'schemaVersion',1,
      'eventKey','event.p52-participation',
      'templateKey','template.community-objective',
      'contentVersion',1,
      'title','P5.2 Participation Verification',
      'rewardPackageRefs',jsonb_build_array('reward.p52-participation')
    ),
    '$user_one'::uuid
  )
  returning id::text;")"
test -n "$version_id"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.event_publications (event_key, version_id, updated_by)
  values ('event.p52-participation','$version_id'::uuid,'$user_one'::uuid);
" >/dev/null

create_run() {
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    insert into app_private.event_runs (
      event_key,
      definition_version_id,
      run_mode,
      lifecycle_status,
      scope_type,
      current_phase_id,
      created_by
    ) values (
      'event.p52-participation',
      '$version_id'::uuid,
      'production',
      'live',
      'global',
      'mobilization',
      '$user_one'::uuid
    )
    returning id::text;"
}

initialize_run_state() {
  local run_id="$1"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
    insert into app_private.event_run_phases (
      run_id, phase_id, ordinal, phase_status, started_at
    ) values
      ('$run_id'::uuid, 'mobilization', 0, 'live', clock_timestamp()),
      ('$run_id'::uuid, 'future', 1, 'pending', null);

    insert into app_private.event_run_objectives (
      run_id,
      phase_id,
      objective_id,
      objective_status,
      progress,
      target
    ) values
      (
        '$run_id'::uuid,
        'mobilization',
        'community',
        'active',
        0,
        100
      ),
      (
        '$run_id'::uuid,
        'future',
        'future-community',
        'active',
        0,
        10
      );
  " >/dev/null
}

run_one="$(create_run)"
run_two="$(create_run)"
test -n "$run_one"
test -n "$run_two"
test "$run_one" != "$run_two"
initialize_run_state "$run_one"
initialize_run_state "$run_two"

privileges="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_table_privilege('authenticated','app_private.event_participants','SELECT')::text || '|' ||
    has_table_privilege('service_role','app_private.event_participants','SELECT')::text || '|' ||
    has_table_privilege('service_role','app_private.event_participants','INSERT')::text || '|' ||
    has_table_privilege('service_role','app_private.event_contributions','INSERT')::text || '|' ||
    has_table_privilege('service_role','app_private.event_reward_claim_reservations','INSERT')::text;")"
test "$privileges" = 'false|true|false|false|false'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  insert into app_private.event_participants (run_id, character_id, user_id)
  values ('$run_one'::uuid,'$character_one'::uuid,'$user_one'::uuid);"   >/tmp/p52-participant-direct-write.out 2>/tmp/p52-participant-direct-write.err; then
  echo 'Service role unexpectedly wrote directly to the Event participant ledger.' >&2
  exit 1
fi

record_contribution() {
  local run_id="$1"
  local idempotency_key="$2"
  local fingerprint="$3"
  local source_reference="$4"
  local amount="$5"
  local user_id="${6:-$user_one}"
  local character_id="${7:-$character_one}"
  local phase_id="${8:-mobilization}"
  local objective_id="${9:-community}"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      contribution_id::text || '|' ||
      participant_contribution_count::text || '|' ||
      participant_contribution_total::text || '|' ||
      objective_progress::text || '|' ||
      objective_status || '|' ||
      replayed::text || '|' ||
      source_deduplicated::text
    from public.record_event_contribution_v1(
      'source:ci',
      '$idempotency_key'::uuid,
      '$fingerprint',
      '$run_id'::uuid,
      '$user_id'::uuid,
      '$character_id'::uuid,
      '$phase_id',
      '$objective_id',
      'combat',
      '$source_reference',
      '$amount'::bigint,
      jsonb_build_object('source','ci','reference','$source_reference')
    );"
}

if record_contribution \
  "$run_one" \
  '00000000-0000-4000-8000-000000005320' \
  'p52:contribution:future-phase' \
  'battle.intent:future-phase' \
  1 \
  "$user_one" \
  "$character_one" \
  'future' \
  'future-community' >/tmp/p52-future-phase.out 2>/tmp/p52-future-phase.err; then
  echo 'Expected contribution to a non-live Event phase to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_CONTRIBUTION_PHASE_NOT_LIVE' /tmp/p52-future-phase.err

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  create or replace function app_private.delay_p52_event_contribution_for_test()
  returns trigger
  language plpgsql
  as \$\$
  begin
    if new.run_id = '$run_one'::uuid and new.source_reference = 'battle.intent:ci-1' then
      perform pg_sleep(2);
    end if;
    return new;
  end;
  \$\$;

  create trigger delay_p52_event_contribution_for_test
  before insert on app_private.event_contributions
  for each row execute function app_private.delay_p52_event_contribution_for_test();
" >/dev/null

contribution_key='00000000-0000-4000-8000-000000005302'
record_contribution   "$run_one" "$contribution_key" 'p52:contribution:one' 'battle.intent:ci-1' 40   > /tmp/p52-contribution-a.out 2>/tmp/p52-contribution-a.err &
contribution_a_pid=$!

record_contribution   "$run_one" "$contribution_key" 'p52:contribution:one' 'battle.intent:ci-1' 40   > /tmp/p52-contribution-b.out 2>/tmp/p52-contribution-b.err &
contribution_b_pid=$!

wait "$contribution_a_pid"
wait "$contribution_b_pid"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  drop trigger delay_p52_event_contribution_for_test on app_private.event_contributions;
  drop function app_private.delay_p52_event_contribution_for_test();
" >/dev/null

contribution_a="$(cat /tmp/p52-contribution-a.out)"
contribution_b="$(cat /tmp/p52-contribution-b.out)"
contribution_a_id="${contribution_a%%|*}"
contribution_b_id="${contribution_b%%|*}"
test -n "$contribution_a_id"
test "$contribution_a_id" = "$contribution_b_id"
test "$(printf '%s\n%s\n' "$contribution_a" "$contribution_b" | cut -d'|' -f6 | sort)" = "$(printf '%s\n%s\n' false true)"
test "$(printf '%s\n%s\n' "$contribution_a" "$contribution_b" | cut -d'|' -f7 | sort -u)" = 'false'

first_state="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    participant.contribution_count::text || '|' ||
    participant.contribution_total::text || '|' ||
    objective.progress::text || '|' ||
    objective.objective_status
  from app_private.event_participants as participant
  join app_private.event_run_objectives as objective
    on objective.run_id = participant.run_id
  where participant.run_id = '$run_one'::uuid
    and participant.character_id = '$character_one'::uuid
    and objective.phase_id = 'mobilization'
    and objective.objective_id = 'community';")"
test "$first_state" = '1|40|40|active'

source_dedup="$(record_contribution   "$run_one"   '00000000-0000-4000-8000-000000005303'   'p52:contribution:source-dedup'   'battle.intent:ci-1'   40)"
test "${source_dedup%%|*}" = "$contribution_a_id"
test "$(printf '%s' "$source_dedup" | cut -d'|' -f2-7)" = '1|40|40|active|false|true'

if record_contribution   "$run_one"   '00000000-0000-4000-8000-000000005304'   'p52:contribution:source-conflict'   'battle.intent:ci-1'   41 >/tmp/p52-source-conflict.out 2>/tmp/p52-source-conflict.err; then
  echo 'Expected conflicting authoritative contribution provenance to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_CONTRIBUTION_SOURCE_CONFLICT' /tmp/p52-source-conflict.err

if record_contribution   "$run_one"   '00000000-0000-4000-8000-000000005305'   'p52:contribution:cross-account'   'battle.intent:cross-account'   1   "$user_two"   "$character_one" >/tmp/p52-cross-account.out 2>/tmp/p52-cross-account.err; then
  echo 'Expected cross-account Event contribution to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_PARTICIPANT_CHARACTER_NOT_FOUND' /tmp/p52-cross-account.err

second_contribution="$(record_contribution   "$run_one"   '00000000-0000-4000-8000-000000005306'   'p52:contribution:two'   'battle.intent:ci-2'   60)"
test "$(printf '%s' "$second_contribution" | cut -d'|' -f2-7)" = '2|100|100|completed|false|false'

if record_contribution   "$run_one"   '00000000-0000-4000-8000-000000005307'   'p52:contribution:after-complete'   'battle.intent:ci-3'   1 >/tmp/p52-objective-complete.out 2>/tmp/p52-objective-complete.err; then
  echo 'Expected new contribution to a completed objective to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_OBJECTIVE_NOT_ACTIVE' /tmp/p52-objective-complete.err

contribution_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.event_contributions
  where run_id = '$run_one'::uuid;")"
test "$contribution_count" = '2'

reserve_claim() {
  local run_id="$1"
  local idempotency_key="$2"
  local fingerprint="$3"
  local reward_ref="$4"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select
      reservation_id::text || '|' ||
      reward_package_ref || '|' ||
      replayed::text || '|' ||
      claim_deduplicated::text
    from public.reserve_event_reward_claim_v1(
      'source:rewards',
      '$idempotency_key'::uuid,
      '$fingerprint',
      '$run_id'::uuid,
      '$user_one'::uuid,
      '$character_one'::uuid,
      '$reward_ref',
      jsonb_build_object('basis','participated','version',1)
    );"
}

if reserve_claim   "$run_one"   '00000000-0000-4000-8000-000000005308'   'p52:claim:before-end'   'reward.p52-participation' >/tmp/p52-claim-before-end.out 2>/tmp/p52-claim-before-end.err; then
  echo 'Expected reward claim reservation before Event end to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_REWARD_CLAIM_RUN_NOT_ENDED' /tmp/p52-claim-before-end.err

transition_one="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.transition_event_run_v1(
    '$run_one'::uuid,
    1,
    '00000000-0000-4000-8000-000000005309'::uuid,
    'resolving',
    'CI resolve participation run'
  );")"
test "$transition_one" = 'resolving|2'

transition_two="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select lifecycle_status || '|' || state_version::text
  from public.transition_event_run_v1(
    '$run_one'::uuid,
    2,
    '00000000-0000-4000-8000-000000005310'::uuid,
    'ended',
    'CI end participation run'
  );")"
test "$transition_two" = 'ended|3'

claim_key='00000000-0000-4000-8000-000000005311'
first_claim="$(reserve_claim "$run_one" "$claim_key" 'p52:claim:first' 'reward.p52-participation')"
replay_claim="$(reserve_claim "$run_one" "$claim_key" 'p52:claim:first' 'reward.p52-participation')"
first_reservation="${first_claim%%|*}"
replay_reservation="${replay_claim%%|*}"
test -n "$first_reservation"
test "$first_reservation" = "$replay_reservation"
test "$(printf '%s' "$first_claim" | cut -d'|' -f2-4)" = 'reward.p52-participation|false|false'
test "$(printf '%s' "$replay_claim" | cut -d'|' -f2-4)" = 'reward.p52-participation|true|false'

dedup_claim="$(reserve_claim   "$run_one"   '00000000-0000-4000-8000-000000005312'   'p52:claim:dedup'   'reward.p52-participation')"
test "${dedup_claim%%|*}" = "$first_reservation"
test "$(printf '%s' "$dedup_claim" | cut -d'|' -f2-4)" = 'reward.p52-participation|false|true'

if reserve_claim   "$run_one"   "$claim_key"   'p52:claim:conflict'   'reward.p52-participation' >/tmp/p52-claim-idempotency.out 2>/tmp/p52-claim-idempotency.err; then
  echo 'Expected conflicting Event claim idempotency fingerprint to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_REWARD_CLAIM_IDEMPOTENCY_CONFLICT' /tmp/p52-claim-idempotency.err

if reserve_claim   "$run_one"   '00000000-0000-4000-8000-000000005313'   'p52:claim:not-pinned'   'reward.not-pinned' >/tmp/p52-claim-not-pinned.out 2>/tmp/p52-claim-not-pinned.err; then
  echo 'Expected unpinned Event Reward Package claim to fail.' >&2
  exit 1
fi
grep -Fq 'EVENT_REWARD_PACKAGE_NOT_PINNED' /tmp/p52-claim-not-pinned.err

run_two_contribution="$(record_contribution   "$run_two"   '00000000-0000-4000-8000-000000005314'   'p52:run-two:contribution'   'battle.intent:ci-1'   100)"
run_two_contribution_id="${run_two_contribution%%|*}"
test -n "$run_two_contribution_id"
test "$run_two_contribution_id" != "$contribution_a_id"
test "$(printf '%s' "$run_two_contribution" | cut -d'|' -f2-7)" = '1|100|100|completed|false|false'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select * from public.transition_event_run_v1(
    '$run_two'::uuid,
    1,
    '00000000-0000-4000-8000-000000005315'::uuid,
    'resolving',
    'CI resolve recurrence run'
  );
  select * from public.transition_event_run_v1(
    '$run_two'::uuid,
    2,
    '00000000-0000-4000-8000-000000005316'::uuid,
    'ended',
    'CI end recurrence run'
  );" >/dev/null

run_two_claim="$(reserve_claim   "$run_two"   '00000000-0000-4000-8000-000000005317'   'p52:run-two:claim'   'reward.p52-participation')"
run_two_reservation="${run_two_claim%%|*}"
test -n "$run_two_reservation"
test "$run_two_reservation" != "$first_reservation"

ledger_counts="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    (select count(*) from app_private.event_participants
      where run_id in ('$run_one'::uuid,'$run_two'::uuid))::text || '|' ||
    (select count(*) from app_private.event_contributions
      where run_id in ('$run_one'::uuid,'$run_two'::uuid))::text || '|' ||
    (select count(*) from app_private.event_reward_claim_reservations
      where run_id in ('$run_one'::uuid,'$run_two'::uuid))::text;")"
test "$ledger_counts" = '2|3|2'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from app_private.event_participants;"   >/tmp/p52-browser-ledger.out 2>/tmp/p52-browser-ledger.err; then
  echo 'Authenticated browser unexpectedly read the private Event participant ledger.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.record_event_contribution_v1(
    'browser:forged',
    '00000000-0000-4000-8000-000000005318'::uuid,
    'p52:browser:forged',
    '$run_two'::uuid,
    '$user_one'::uuid,
    '$character_one'::uuid,
    'mobilization',
    'community',
    'combat',
    'battle.intent:forged',
    1,
    jsonb_build_object('source','browser')
  );" >/tmp/p52-browser-contribution.out 2>/tmp/p52-browser-contribution.err; then
  echo 'Authenticated browser unexpectedly committed an Event contribution.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.reserve_event_reward_claim_v1(
    'browser:forged',
    '00000000-0000-4000-8000-000000005319'::uuid,
    'p52:browser:claim',
    '$run_two'::uuid,
    '$user_one'::uuid,
    '$character_one'::uuid,
    'reward.p52-participation',
    jsonb_build_object('basis','forged')
  );" >/tmp/p52-browser-claim.out 2>/tmp/p52-browser-claim.err; then
  echo 'Authenticated browser unexpectedly reserved an Event reward claim.' >&2
  exit 1
fi

echo 'Phase 5 Event participant ledger and idempotent claim boundaries verified.'
