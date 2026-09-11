#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P4-essence-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

email="p4-essence-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
signup="$(signup_test_user "$email" "$password")"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$user_id"
test "$user_id" != 'null'
confirm_test_user "$user_id"

character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select id::text
  from public.create_character_v3(
    '$user_id'::uuid,
    0::smallint,
    '00000000-0000-4000-8000-000000004001'::uuid,
    'p4:character:essencetester',
    1,
    'P4 Essence Tester',
    'p4essencetester',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'ironfist',
    13, 4, 5, 8, 2, 4
  );")"
test -n "$character_id"

# The real creation RPC must trigger all eight unlocks without a tester entitlement.
initial_skills="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text || '|' || count(*) filter (where source_discipline_id = 'ironfist')::text
  from public.get_character_learned_skills_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$initial_skills" = '8|8'

pure="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select snapshot -> 'extensions' -> 'essence' ->> 'essenceId'
  from (select public.get_character_committed_build_snapshot_v2('$user_id'::uuid, '$character_id'::uuid) as snapshot) resolved;")"
test "$pure" = 'essence.ironfist.hundredfold-rush'

# Re-running provisioning must retain the eight durable facts without duplication.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_active_builds set primary_discipline_id = 'ironfist' where character_id = '$character_id'::uuid;" >/dev/null
replayed="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*) from app_private.character_skill_unlocks where character_id = '$character_id'::uuid;")"
test "$replayed" = '8'

coverage="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select (select count(*) from app_private.essence_definitions where enabled)::text || '|' ||
    (select count(*) from app_private.resonance_definitions where enabled)::text || '|' ||
    has_function_privilege('authenticated', 'app_private.provision_active_discipline_skills_v1()', 'EXECUTE')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.character_skill_unlocks', 'INSERT')::text;")"
test "$coverage" = '16|120|false|false'
echo 'Phase 4 normal Ironfist provisioning, pure snapshot, idempotency and browser denial PASS.'
