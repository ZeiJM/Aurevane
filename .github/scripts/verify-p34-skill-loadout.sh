#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P34-skill-loadout-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

signup="$(signup_test_user "p34-skills-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com" "$password")"
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
    '00000000-0000-4000-8000-000000003401'::uuid,
    'p34:character:skilltester',
    1,
    'P34 Skill Tester',
    'p34skilltester',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    7, 6, 5, 6, 5, 7
  );")"
test -n "$character_id"

initial="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select schema_version::text || '|' || build_version::text || '|' || primary_discipline_id || '|' || coalesce(secondary_discipline_id, '')
  from public.get_character_active_build_v2('$user_id'::uuid, '$character_id'::uuid);")"
test "$initial" = '2|1|vanguard|'

privileges="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    has_table_privilege('authenticated', 'app_private.character_skill_unlocks', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.character_build_discipline_skills', 'SELECT')::text || '|' ||
    has_function_privilege(
      'authenticated',
      'public.save_character_discipline_skill_loadout_v1(uuid,uuid,bigint,jsonb,uuid,text)',
      'EXECUTE'
    )::text;")"
test "$privileges" = 'false|false|false'

# A normal Vanguard character must receive the authored eight-Technique catalog without a test kit.
initial_skills="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text || '|' || count(*) filter (where source_discipline_id = 'vanguard')::text
  from public.get_character_learned_skills_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$initial_skills" = '8|8'

replayed="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select skill_id || '|' || replayed::text
  from public.record_character_skill_unlock_v1(
    '$character_id'::uuid,
    'vanguard.forceful-strike',
    2,
    'vanguard',
    'system',
    'p34.database-proof'
  );")"
test "$replayed" = 'vanguard.forceful-strike|true'

pure_payload='[{"skillId":"vanguard.forceful-strike","contentVersion":2,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.cleave","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.guard-break","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.brace","contentVersion":1,"sourceDisciplineId":"vanguard"}]'
pure_save="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || replayed::text
  from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1,
    '$pure_payload'::jsonb,
    '00000000-0000-4000-8000-000000003402'::uuid,
    'sha256:p34-pure-save'
  );")"
test "$pure_save" = '2|false'

pure_replay="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || replayed::text
  from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1,
    '$pure_payload'::jsonb,
    '00000000-0000-4000-8000-000000003402'::uuid,
    'sha256:p34-pure-save'
  );")"
test "$pure_replay" = '2|true'

mastery="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select discipline_id || '|' || replayed::text
  from public.record_character_discipline_mastery_v1(
    '$character_id'::uuid,
    'lifebinder',
    'system',
    'p34.database-proof'
  );")"
test "$mastery" = 'lifebinder|false'

mixed_change="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || primary_discipline_id || '|' || secondary_discipline_id
  from public.change_character_disciplines_v2(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2,
    false,
    'vanguard',
    true,
    'lifebinder',
    '00000000-0000-4000-8000-000000003403'::uuid,
    'sha256:p34-mixed'
  );")"
test "$mixed_change" = '3|vanguard|lifebinder'

# Activating Lifebinder must automatically add all eight of its Techniques as well.
mixed_skills="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text || '|' ||
         count(*) filter (where source_discipline_id = 'vanguard')::text || '|' ||
         count(*) filter (where source_discipline_id = 'lifebinder')::text
  from public.get_character_learned_skills_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$mixed_skills" = '16|8|8'

pruned_after_mix="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text
  from public.get_character_discipline_skill_loadout_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$pruned_after_mix" = '2'

mixed_payload='[{"skillId":"vanguard.forceful-strike","contentVersion":2,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.cleave","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.brace","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"lifebinder.vital-sever","contentVersion":1,"sourceDisciplineId":"lifebinder"}]'
mixed_save="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || replayed::text
  from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    3,
    '$mixed_payload'::jsonb,
    '00000000-0000-4000-8000-000000003404'::uuid,
    'sha256:p34-mixed-save'
  );")"
test "$mixed_save" = '4|false'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    4,
    '$pure_payload'::jsonb,
    '00000000-0000-4000-8000-000000003405'::uuid,
    'sha256:p34-illegal-four-zero'
  );" >/tmp/p34-four-zero.out 2>/tmp/p34-four-zero.err; then
  echo 'Expected a full mixed 4-0 loadout to fail.' >&2
  exit 1
fi
grep -Fq 'DISCIPLINE_SKILL_SOURCE_CAPACITY_EXCEEDED' /tmp/p34-four-zero.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    3,
    '$mixed_payload'::jsonb,
    '00000000-0000-4000-8000-000000003406'::uuid,
    'sha256:p34-stale'
  );" >/tmp/p34-stale.out 2>/tmp/p34-stale.err; then
  echo 'Expected stale build version to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_BUILD_VERSION_CONFLICT' /tmp/p34-stale.err

# Removing the Secondary keeps learned facts durable but prunes its equipped Technique.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_active_builds
  set secondary_attunement_locked_until = clock_timestamp() - interval '1 second'
  where character_id = '$character_id'::uuid;" >/dev/null

pure_again="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || coalesce(secondary_discipline_id, '')
  from public.change_character_disciplines_v2(
    '$user_id'::uuid,
    '$character_id'::uuid,
    4,
    false,
    'vanguard',
    true,
    null,
    '00000000-0000-4000-8000-000000003407'::uuid,
    'sha256:p34-pure-again'
  );")"
test "$pure_again" = '5|'

post_remove="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text || '|' || count(*) filter (where source_discipline_id <> 'vanguard')::text
  from public.get_character_discipline_skill_loadout_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$post_remove" = '3|0'

echo 'P3.4 Skill loadout authority verified.'