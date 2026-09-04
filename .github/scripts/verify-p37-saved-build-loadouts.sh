#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P37-loadouts-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

email="p37-loadouts-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
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
    '00000000-0000-4000-8000-000000003701'::uuid,
    'p37:character:loadouttester',
    1,
    'P37 Loadout Tester',
    'p37loadouttester',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    7, 6, 5, 6, 5, 7
  );")"
test -n "$character_id"

pure_saved="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select slot_index::text || '|' || name || '|' || source_build_version::text || '|' || replayed::text
  from public.save_character_build_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1::smallint,
    'Pure Vanguard',
    1,
    '00000000-0000-4000-8000-000000003711'::uuid,
    'sha256:p37-save-pure'
  );")"
test "$pure_saved" = '1|Pure Vanguard|1|false'

mastery="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select discipline_id || '|' || replayed::text
  from public.record_character_discipline_mastery_v1(
    '$character_id'::uuid,
    'lifebinder',
    'system',
    'p37.database-proof'
  );")"
test "$mastery" = 'lifebinder|false'

mixed_change="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || secondary_discipline_id
  from public.change_character_disciplines_v2(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1,
    false,
    'vanguard',
    true,
    'lifebinder',
    '00000000-0000-4000-8000-000000003712'::uuid,
    'sha256:p37-mixed'
  );")"
test "$mixed_change" = '2|lifebinder'

mixed_saved="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select slot_index::text || '|' || name || '|' || source_build_version::text || '|' || replayed::text
  from public.save_character_build_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2::smallint,
    'Mercy Edge',
    2,
    '00000000-0000-4000-8000-000000003713'::uuid,
    'sha256:p37-save-mixed'
  );")"
test "$mixed_saved" = '2|Mercy Edge|2|false'

set +e
locked_output="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select *
  from public.activate_character_build_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1::smallint,
    2,
    '00000000-0000-4000-8000-000000003714'::uuid,
    'sha256:p37-activate-pure-locked'
  );" 2>&1)"
locked_status=$?
set -e
test "$locked_status" -ne 0
printf '%s' "$locked_output" | grep -q 'SECONDARY_ATTUNEMENT_LOCKED'

unchanged_locked="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select build_version::text || '|' || coalesce(secondary_discipline_id, '')
  from app_private.character_active_builds
  where character_id = '$character_id'::uuid;")"
test "$unchanged_locked" = '2|lifebinder'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_active_builds
  set secondary_attunement_locked_until = clock_timestamp() - interval '1 second'
  where character_id = '$character_id'::uuid;" >/dev/null

pure_activated="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || replayed::text
  from public.activate_character_build_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1::smallint,
    2,
    '00000000-0000-4000-8000-000000003715'::uuid,
    'sha256:p37-activate-pure'
  );")"
test "$pure_activated" = '3|false'

pure_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    coalesce(snapshot -> 'secondary' ->> 'disciplineId', '') || '|' ||
    (snapshot -> 'extensions' -> 'essence' ->> 'essenceId') || '|' ||
    coalesce(snapshot -> 'extensions' ->> 'resonance', '')
  from (
    select public.get_character_committed_build_snapshot_v2('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$pure_snapshot" = '|essence.vanguard.unbroken-strike|'

# Corrupt the private saved target to prove activation is transactional: the Discipline change
# happens first inside the RPC, but the invalid Skill save must roll the entire statement back.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_saved_build_loadouts
  set discipline_skills = '[{\"skillId\":\"lifebinder.mending-light\",\"contentVersion\":1,\"sourceDisciplineId\":\"lifebinder\"}]'::jsonb
  where character_id = '$character_id'::uuid and slot_index = 2;" >/dev/null

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_active_builds
  set secondary_attunement_locked_until = clock_timestamp() - interval '1 second'
  where character_id = '$character_id'::uuid;" >/dev/null

set +e
atomic_output="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select *
  from public.activate_character_build_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2::smallint,
    3,
    '00000000-0000-4000-8000-000000003716'::uuid,
    'sha256:p37-activate-invalid'
  );" 2>&1)"
atomic_status=$?
set -e
test "$atomic_status" -ne 0
printf '%s' "$atomic_output" | grep -q 'DISCIPLINE_SKILL_NOT_LEARNED'

atomic_unchanged="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select build_version::text || '|' || coalesce(secondary_discipline_id, '')
  from app_private.character_active_builds
  where character_id = '$character_id'::uuid;")"
test "$atomic_unchanged" = '3|'

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_saved_build_loadouts
  set discipline_skills = '[]'::jsonb
  where character_id = '$character_id'::uuid and slot_index = 2;" >/dev/null

mixed_activated="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || replayed::text
  from public.activate_character_build_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2::smallint,
    3,
    '00000000-0000-4000-8000-000000003717'::uuid,
    'sha256:p37-activate-mixed'
  );")"
test "$mixed_activated" = '4|false'

mixed_replay="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || replayed::text
  from public.activate_character_build_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2::smallint,
    3,
    '00000000-0000-4000-8000-000000003717'::uuid,
    'sha256:p37-activate-mixed'
  );")"
test "$mixed_replay" = '4|true'

mixed_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    (snapshot -> 'secondary' ->> 'disciplineId') || '|' ||
    coalesce(snapshot -> 'extensions' ->> 'essence', '') || '|' ||
    (snapshot -> 'extensions' -> 'resonance' ->> 'resonanceId')
  from (
    select public.get_character_committed_build_snapshot_v2('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$mixed_snapshot" = 'lifebinder||resonance.lifebinder-vanguard.mercys-edge'

privileges="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    has_table_privilege('authenticated', 'app_private.character_saved_build_loadouts', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.character_saved_build_loadouts', 'UPDATE')::text || '|' ||
    has_function_privilege(
      'authenticated',
      'public.save_character_build_loadout_v1(uuid,uuid,smallint,text,bigint,uuid,text)',
      'EXECUTE'
    )::text || '|' ||
    has_function_privilege(
      'authenticated',
      'public.activate_character_build_loadout_v1(uuid,uuid,smallint,bigint,uuid,text)',
      'EXECUTE'
    )::text;")"
test "$privileges" = 'false|false|false|false'

echo 'P3.7 saved build loadout authority verified.'
