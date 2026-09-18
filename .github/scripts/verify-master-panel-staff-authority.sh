#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P51-master-staff-2026!'
owner_email="p51-owner-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
staff_email="p51-staff-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
other_email="p51-other-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

owner_signup="$(signup_test_user "$owner_email" "$password")"
staff_signup="$(signup_test_user "$staff_email" "$password")"
other_signup="$(signup_test_user "$other_email" "$password")"

owner_id="$(printf '%s' "$owner_signup" | jq -r '.user.id')"
staff_id="$(printf '%s' "$staff_signup" | jq -r '.user.id')"
other_id="$(printf '%s' "$other_signup" | jq -r '.user.id')"

for user_id in "$owner_id" "$staff_id" "$other_id"; do
  test -n "$user_id"
  test "$user_id" != 'null'
  confirm_test_user "$user_id"
done

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.master_panel_role_assignments (
    user_id,
    role,
    enabled,
    granted_by,
    note
  ) values (
    '$owner_id'::uuid,
    'game-owner',
    true,
    '$owner_id'::uuid,
    'CI trusted owner bootstrap'
  );

  insert into app_private.master_panel_access_versions (user_id, access_version)
  values ('$owner_id'::uuid, 1);
" >/dev/null

owner_access="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select access_version::text || '|' || array_to_string(roles, ',')
  from public.read_master_panel_access_v1('$owner_id'::uuid);")"
test "$owner_access" = '1|game-owner'

grant_moderator="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.grant_master_panel_role_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'moderator',
    'CI moderator grant'
  )::text;")"
test "$grant_moderator" = '1'

grant_content="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.grant_master_panel_role_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'content-staff',
    'CI content grant'
  )::text;")"
test "$grant_content" = '2'

staff_access="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select access_version::text || '|' || array_to_string(roles, ',')
  from public.read_master_panel_access_v1('$staff_id'::uuid);")"
test "$staff_access" = '2|moderator,content-staff'

repeat_grant="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.grant_master_panel_role_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'content-staff',
    'CI idempotent grant'
  )::text;")"
test "$repeat_grant" = '2'

audit_after_grants="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)::text
  from app_private.master_panel_access_audit
  where actor_user_id = '$owner_id'::uuid
    and target_user_id = '$staff_id'::uuid
    and action = 'role.granted';")"
test "$audit_after_grants" = '2'

revoke_moderator="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.revoke_master_panel_role_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'moderator',
    'CI moderator revoke'
  )::text;")"
test "$revoke_moderator" = '3'

staff_after_revoke="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select access_version::text || '|' || array_to_string(roles, ',')
  from public.read_master_panel_access_v1('$staff_id'::uuid);")"
test "$staff_after_revoke" = '3|content-staff'

idempotent_revoke="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.revoke_master_panel_role_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'event-staff',
    'CI idempotent revoke'
  )::text;")"
test "$idempotent_revoke" = '3'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.master_panel_role_assignments (
    user_id,
    role,
    enabled,
    granted_by,
    note
  ) values (
    '$other_id'::uuid,
    'game-owner',
    true,
    '$owner_id'::uuid,
    'CI duplicate owner probe'
  );" >/tmp/p51-owner-unique.out 2>/tmp/p51-owner-unique.err; then
  echo 'Expected a second enabled Game Owner to fail.' >&2
  exit 1
fi
grep -Fq 'master_panel_single_enabled_game_owner_uq' /tmp/p51-owner-unique.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.grant_master_panel_role_v1(
    '$staff_id'::uuid,
    '$other_id'::uuid,
    'event-staff',
    'CI delegated escalation probe'
  );" >/tmp/p51-staff-escalation.out 2>/tmp/p51-staff-escalation.err; then
  echo 'Expected delegated staff role management to fail.' >&2
  exit 1
fi
grep -Fq 'MASTER_PANEL_OWNER_REQUIRED' /tmp/p51-staff-escalation.err

missing_target='00000000-0000-4000-8000-000000005199'
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.revoke_master_panel_role_v1(
    '$owner_id'::uuid,
    '$missing_target'::uuid,
    'content-staff',
    'CI missing account probe'
  );" >/tmp/p51-missing-target.out 2>/tmp/p51-missing-target.err; then
  echo 'Expected revocation for a missing account to fail.' >&2
  exit 1
fi
grep -Fq 'MASTER_PANEL_TARGET_NOT_FOUND' /tmp/p51-missing-target.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.read_master_panel_access_v1('$staff_id'::uuid);" >/tmp/p51-browser-read.out 2>/tmp/p51-browser-read.err; then
  echo 'Authenticated browser role unexpectedly read Master Panel authority.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select public.grant_master_panel_role_v1(
    '$owner_id'::uuid,
    '$other_id'::uuid,
    'event-staff',
    'CI browser grant probe'
  );" >/tmp/p51-browser-grant.out 2>/tmp/p51-browser-grant.err; then
  echo 'Authenticated browser role unexpectedly granted Master Panel authority.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from app_private.master_panel_role_assignments;" >/tmp/p51-browser-private.out 2>/tmp/p51-browser-private.err; then
  echo 'Authenticated browser role unexpectedly read private Master Panel authority state.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from app_private.master_panel_role_assignments;" >/tmp/p51-service-private.out 2>/tmp/p51-service-private.err; then
  echo 'Service role unexpectedly bypassed Master Panel RPC boundaries with direct table access.' >&2
  exit 1
fi

revoke_content="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.revoke_master_panel_role_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'content-staff',
    'CI content revoke'
  )::text;")"
test "$revoke_content" = '4'

remaining_access="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text
  from public.read_master_panel_access_v1('$staff_id'::uuid);")"
test "$remaining_access" = '0'

staff_version="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select access_version::text
  from app_private.master_panel_access_versions
  where user_id = '$staff_id'::uuid;")"
test "$staff_version" = '4'

audit_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)::text || '|' ||
    count(*) filter (where action = 'role.granted')::text || '|' ||
    count(*) filter (where action = 'role.revoked')::text
  from app_private.master_panel_access_audit
  where actor_user_id = '$owner_id'::uuid
    and target_user_id = '$staff_id'::uuid;")"
test "$audit_snapshot" = '4|2|2'
