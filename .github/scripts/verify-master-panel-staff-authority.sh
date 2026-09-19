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
  select access_version::text || '|' ||
    array_to_string(roles, ',') || '|' ||
    array_to_string(special_capabilities, ',')
  from public.read_master_panel_access_v1('$owner_id'::uuid);")"
test "$owner_access" = '1|game-owner|'

resolved_staff="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select user_id::text || '|' || email
  from public.resolve_master_panel_account_v1('$owner_id'::uuid, '$staff_email');")"
test "$resolved_staff" = "$staff_id|$staff_email"

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.grant_master_panel_capability_v1(
    '$owner_id'::uuid,
    '$other_id'::uuid,
    'events.global_scope',
    'CI roleless capability probe'
  );" >/tmp/p51-roleless-capability.out 2>/tmp/p51-roleless-capability.err; then
  echo 'Expected a capability grant without a delegated staff role to fail.' >&2
  exit 1
fi
grep -Fq 'MASTER_PANEL_STAFF_ROLE_REQUIRED' /tmp/p51-roleless-capability.err

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
  select access_version::text || '|' ||
    array_to_string(roles, ',') || '|' ||
    array_to_string(special_capabilities, ',')
  from public.read_master_panel_access_v1('$staff_id'::uuid);")"
test "$staff_access" = '2|moderator,content-staff|'

staff_list="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select user_id::text || '|' || email || '|' || access_version::text
  from public.list_master_panel_staff_v1('$owner_id'::uuid)
  where user_id = '$staff_id'::uuid;")"
test "$staff_list" = "$staff_id|$staff_email|2"

grant_capability="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.grant_master_panel_capability_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'events.global_scope',
    'CI global event scope'
  )::text;")"
test "$grant_capability" = '3'

repeat_capability="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.grant_master_panel_capability_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'events.global_scope',
    'CI idempotent capability grant'
  )::text;")"
test "$repeat_capability" = '3'

staff_with_capability="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select access_version::text || '|' ||
    array_to_string(roles, ',') || '|' ||
    array_to_string(special_capabilities, ',')
  from public.read_master_panel_access_v1('$staff_id'::uuid);")"
test "$staff_with_capability" = '3|moderator,content-staff|events.global_scope'

repeat_grant="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.grant_master_panel_role_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'content-staff',
    'CI idempotent grant'
  )::text;")"
test "$repeat_grant" = '3'

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

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.grant_master_panel_capability_v1(
    '$staff_id'::uuid,
    '$other_id'::uuid,
    'events.global_scope',
    'CI delegated capability escalation probe'
  );" >/tmp/p51-capability-escalation.out 2>/tmp/p51-capability-escalation.err; then
  echo 'Expected delegated staff capability management to fail.' >&2
  exit 1
fi
grep -Fq 'MASTER_PANEL_OWNER_REQUIRED' /tmp/p51-capability-escalation.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.grant_master_panel_capability_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'staff.manage',
    'CI protected root capability probe'
  );" >/tmp/p51-root-capability.out 2>/tmp/p51-root-capability.err; then
  echo 'Expected root capability delegation to fail.' >&2
  exit 1
fi
grep -Fq 'MASTER_PANEL_ROOT_CAPABILITY_PROTECTED' /tmp/p51-root-capability.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.list_master_panel_staff_v1('$owner_id'::uuid);" >/tmp/p51-browser-list.out 2>/tmp/p51-browser-list.err; then
  echo 'Authenticated browser role unexpectedly listed Master Panel staff.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select public.grant_master_panel_capability_v1(
    '$owner_id'::uuid,
    '$other_id'::uuid,
    'events.global_scope',
    'CI browser capability grant probe'
  );" >/tmp/p51-browser-capability.out 2>/tmp/p51-browser-capability.err; then
  echo 'Authenticated browser role unexpectedly granted a special capability.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from app_private.master_panel_capability_grants;" >/tmp/p51-service-capability-table.out 2>/tmp/p51-service-capability-table.err; then
  echo 'Service role unexpectedly bypassed capability RPC boundaries with direct table access.' >&2
  exit 1
fi

revoke_moderator="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.revoke_master_panel_role_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'moderator',
    'CI moderator revoke'
  )::text;")"
test "$revoke_moderator" = '4'

staff_after_role_revoke="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select access_version::text || '|' ||
    array_to_string(roles, ',') || '|' ||
    array_to_string(special_capabilities, ',')
  from public.read_master_panel_access_v1('$staff_id'::uuid);")"
test "$staff_after_role_revoke" = '4|content-staff|events.global_scope'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.revoke_master_panel_role_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'content-staff',
    'CI last role with capability probe'
  );" >/tmp/p51-last-role-capability.out 2>/tmp/p51-last-role-capability.err; then
  echo 'Expected last delegated role removal with an active special capability to fail.' >&2
  exit 1
fi
grep -Fq 'MASTER_PANEL_ROLE_REQUIRED_FOR_CAPABILITY' /tmp/p51-last-role-capability.err

revoke_capability="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.revoke_master_panel_capability_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'events.global_scope',
    'CI global event scope revoke'
  )::text;")"
test "$revoke_capability" = '5'

revoke_content="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select public.revoke_master_panel_role_v1(
    '$owner_id'::uuid,
    '$staff_id'::uuid,
    'content-staff',
    'CI content revoke'
  )::text;")"
test "$revoke_content" = '6'

remaining_access="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text
  from public.read_master_panel_access_v1('$staff_id'::uuid);")"
test "$remaining_access" = '0'

staff_version="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select access_version::text
  from app_private.master_panel_access_versions
  where user_id = '$staff_id'::uuid;")"
test "$staff_version" = '6'

audit_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)::text || '|' ||
    count(*) filter (where action = 'role.granted')::text || '|' ||
    count(*) filter (where action = 'role.revoked')::text || '|' ||
    count(*) filter (where action = 'capability.granted')::text || '|' ||
    count(*) filter (where action = 'capability.revoked')::text
  from app_private.master_panel_access_audit
  where actor_user_id = '$owner_id'::uuid
    and target_user_id = '$staff_id'::uuid;")"
test "$audit_snapshot" = '6|2|2|1|1'
