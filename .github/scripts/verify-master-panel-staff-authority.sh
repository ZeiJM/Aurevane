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

# Exercise real character creation (including an alternate linked character).
create_staff_character() {
  local slot="$1"
  local key="$2"
  local name="$3"
  local name_key="$4"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select id::text from public.create_character_v3(
      '$staff_id'::uuid, '$slot'::smallint, '$key'::uuid, '$name_key', 1,
      '$name', '$name_key', 'androgynous', 'they_them',
      'portrait.starter.wayfarer-01', 'appearance.starter.roadworn',
      'ironfist', 13, 4, 5, 8, 2, 4
    );"
}
character_id="$(create_staff_character 0 '00000000-0000-4000-8000-000000005101' 'P51 Selected Staff' 'p51selectedstaff')"
alternate_id="$(create_staff_character 1 '00000000-0000-4000-8000-000000005102' 'P51 Alternate Staff' 'p51alternatestaff')"
test -n "$character_id"
test -n "$alternate_id"

# Retain an ambiguous migrated account grant as explicit denial/binding evidence.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  insert into app_private.master_panel_role_assignments(user_id,role,granted_by,note)
  values ('$staff_id'::uuid,'content-staff','$owner_id'::uuid,'CI legacy binding probe');
" >/dev/null

# The same assertion SQL is executed locally against real predecessor migrations by PGlite.
docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c "begin;
      select set_config('task8.owner','$owner_id',true),
        set_config('task8.staff','$staff_id',true),
        set_config('task8.other','$other_id',true),
        set_config('task8.character','$character_id',true),
        set_config('task8.alternate','$alternate_id',true),
        set_config('task8.character_name','P51 Selected Staff',true);" \
  -f - -c 'commit;' < .github/scripts/verify-master-panel-staff-authority.sql

echo 'Selected-character Staff authority, legacy denial, Owner and private ACL verification passed.'
