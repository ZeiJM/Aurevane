#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='PV1F-character-deletion-2026!'
email="pv1f-delete-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

signup_response="$(signup_test_user "$email" "$password")"
user_id="$(printf '%s' "$signup_response" | jq -r '.user.id')"
test -n "$user_id"
test "$user_id" != 'null'

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

psql_service() {
  local sql="$1"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "set role service_role; $sql"
}

create_character() {
  local slot="$1"
  local idempotency_key="$2"
  local fingerprint="$3"
  local name="$4"
  local name_key="$5"

  psql_service "
    select id::text
    from public.create_character_v2(
      '$user_id'::uuid,
      '$slot'::smallint,
      '$idempotency_key'::uuid,
      '$fingerprint',
      1,
      '$name',
      '$name_key',
      'androgynous',
      'they_them',
      'portrait.starter.wayfarer-01',
      'appearance.starter.roadworn',
      'vanguard',
      6, 6, 6, 6
    );"
}

request_deletion() {
  local character_id="$1"
  local character_name="$2"
  psql_service "
    select requested_at::text || '|' || delete_after::text
    from public.request_character_deletion_v1(
      '$user_id'::uuid,
      '$character_id'::uuid,
      'DELETE $character_name'
    );"
}

age_deletion_past_deadline() {
  local character_id="$1"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    with boundary as (
      select clock_timestamp() - interval '25 hours' as requested_at
    )
    update app_private.character_deletion_requests request
    set
      requested_at = boundary.requested_at,
      delete_after = boundary.requested_at + interval '24 hours'
    from boundary
    where request.character_id = '$character_id'::uuid
      and request.user_id = '$user_id'::uuid;"
}

first_name='Deletion Probe'
first_id="$(create_character \
  0 \
  '00000000-0000-4000-8000-000000001101' \
  'pv1f-delete:first' \
  "$first_name" \
  'deletionprobe')"
test -n "$first_id"

if psql_service "
  select *
  from public.request_character_deletion_v1(
    '$user_id'::uuid,
    '$first_id'::uuid,
    'DELETE WRONG NAME'
  );" >/tmp/pv1f-delete-phrase.out 2>/tmp/pv1f-delete-phrase.err; then
  echo 'Expected character deletion phrase mismatch to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_DELETE_CONFIRMATION_MISMATCH' /tmp/pv1f-delete-phrase.err

first_request="$(request_deletion "$first_id" "$first_name")"
replayed_request="$(request_deletion "$first_id" "$first_name")"
test -n "$first_request"
test "$first_request" = "$replayed_request"

delay_seconds="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select extract(epoch from (delete_after - requested_at))::bigint
  from app_private.character_deletion_requests
  where character_id = '$first_id'::uuid;")"
test "$delay_seconds" = '86400'

pending_projection="$(psql_service "
  select id::text || '|' || (deletion_requested_at is not null)::text || '|' || (deletion_execute_after is not null)::text
  from public.get_character_slots_v1('$user_id'::uuid)
  where id = '$first_id'::uuid;")"
test "$pending_projection" = "$first_id|true|true"

if create_character \
  0 \
  '00000000-0000-4000-8000-000000001102' \
  'pv1f-delete:occupied' \
  'Premature Replacement' \
  'prematurereplacement' \
  >/tmp/pv1f-delete-slot.out 2>/tmp/pv1f-delete-slot.err; then
  echo 'Expected pending deletion slot to remain occupied.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_SLOT_OCCUPIED' /tmp/pv1f-delete-slot.err

cancelled="$(psql_service "
  select public.cancel_character_deletion_v1('$user_id'::uuid, '$first_id'::uuid)::text;")"
test "$cancelled" = 'true'

test "$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.character_deletion_requests where character_id = '$first_id'::uuid;")" = '0'
test "$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from public.characters where id = '$first_id'::uuid;")" = '1'

request_deletion "$first_id" "$first_name" >/dev/null
age_deletion_past_deadline "$first_id"

late_cancel="$(psql_service "
  select public.cancel_character_deletion_v1('$user_id'::uuid, '$first_id'::uuid)::text;")"
test "$late_cancel" = 'false'
test "$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from public.characters where id = '$first_id'::uuid;")" = '0'
test "$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.character_deletion_requests where character_id = '$first_id'::uuid;")" = '0'

replacement_id="$(create_character \
  0 \
  '00000000-0000-4000-8000-000000001103' \
  'pv1f-delete:replacement' \
  'Replacement Probe' \
  'replacementprobe')"
test -n "$replacement_id"
test "$replacement_id" != "$first_id"

lazy_name='Lazy Finalization Probe'
lazy_id="$(create_character \
  1 \
  '00000000-0000-4000-8000-000000001104' \
  'pv1f-delete:lazy' \
  "$lazy_name" \
  'lazyfinalizationprobe')"
test -n "$lazy_id"
request_deletion "$lazy_id" "$lazy_name" >/dev/null
age_deletion_past_deadline "$lazy_id"

lazy_slot_count="$(psql_service "
  select count(*)
  from public.get_character_slots_v1('$user_id'::uuid)
  where id = '$lazy_id'::uuid;")"
test "$lazy_slot_count" = '0'
test "$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from public.characters where id = '$lazy_id'::uuid;")" = '0'

lazy_replacement_id="$(create_character \
  1 \
  '00000000-0000-4000-8000-000000001105' \
  'pv1f-delete:lazy-replacement' \
  'Lazy Replacement Probe' \
  'lazyreplacementprobe')"
test -n "$lazy_replacement_id"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.request_character_deletion_v1(
    '$user_id'::uuid,
    '$replacement_id'::uuid,
    'DELETE Replacement Probe'
  );"; then
  echo 'Authenticated browser role unexpectedly executed deletion request RPC.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select public.cancel_character_deletion_v1(
    '$user_id'::uuid,
    '$replacement_id'::uuid
  );"; then
  echo 'Authenticated browser role unexpectedly executed deletion cancellation RPC.' >&2
  exit 1
fi

account_email="pv1f-account-delete-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
account_password='PV1F-account-deletion-2026!'
account_signup="$(signup_test_user "$account_email" "$account_password")"
account_user_id="$(printf '%s' "$account_signup" | jq -r '.user.id')"
test -n "$account_user_id"
test "$account_user_id" != 'null'

account_request="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select requested_at::text || '|' || delete_after::text
  from public.request_account_deletion_v1('$account_user_id'::uuid);")"
test -n "$account_request"

account_delay="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select extract(epoch from (delete_after - requested_at))::bigint
  from app_private.account_deletion_requests
  where user_id = '$account_user_id'::uuid;")"
test "$account_delay" = '86400'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.request_account_deletion_v1('$account_user_id'::uuid);"; then
  echo 'Authenticated browser role unexpectedly executed whole-account deletion request RPC.' >&2
  exit 1
fi

account_cancelled="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.cancel_account_deletion_v1('$account_user_id'::uuid)::text;")"
test "$account_cancelled" = 'true'

test "$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.account_deletion_requests where user_id = '$account_user_id'::uuid;")" = '0'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select * from public.request_account_deletion_v1('$account_user_id'::uuid);" >/dev/null

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  insert into app_private.idempotency_records (
    actor_key, command_name, idempotency_key, request_fingerprint, result
  ) values (
    'user:$account_user_id',
    'account.delete.probe',
    '00000000-0000-4000-8000-000000001199'::uuid,
    'account-delete-probe',
    '{}'::jsonb
  );

  with boundary as (
    select clock_timestamp() - interval '25 hours' as requested_at
  )
  update app_private.account_deletion_requests request
  set
    requested_at = boundary.requested_at,
    delete_after = boundary.requested_at + interval '24 hours'
  from boundary
  where request.user_id = '$account_user_id'::uuid;

  select app_private.finalize_due_account_deletions_v1();" >/dev/null

test "$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from auth.users where id = '$account_user_id'::uuid;")" = '0'
test "$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from public.player_profiles where user_id = '$account_user_id'::uuid;")" = '0'
test "$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.account_deletion_requests where user_id = '$account_user_id'::uuid;")" = '0'
test "$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select count(*) from app_private.idempotency_records where actor_key = 'user:$account_user_id';")" = '0'

cron_schedule="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select schedule from cron.job where jobname = 'aurevane-finalize-account-deletions';")"
test "$cron_schedule" = '* * * * *'

echo 'PV-1F character and whole-account deletion lifecycles verified.'
