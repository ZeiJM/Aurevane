#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P38-buildcraft-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

email="p38-buildcraft-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
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
    '00000000-0000-4000-8000-000000003801'::uuid,
    'p38:character:buildcraft',
    1,
    'P38 Buildcraft Tester',
    'p38buildcrafttester',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    7, 6, 5, 6, 5, 7
  );")"
test -n "$character_id"

record_unlock() {
  local skill_id="$1"
  local content_version="$2"
  local source_discipline_id="$3"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select skill_id || '|' || replayed::text
    from public.record_character_skill_unlock_v1(
      '$character_id'::uuid,
      '$skill_id',
      $content_version,
      '$source_discipline_id',
      'support',
      'pv2-buildcraft-test-kit:v1'
    );"
}

vanguard_skills=(
  'vanguard.forceful-strike|2'
  'vanguard.cleave|1'
  'vanguard.guard-break|1'
  'vanguard.brace|1'
  'vanguard.rally|1'
  'vanguard.shield-bash|1'
  'vanguard.second-wind|1'
  'vanguard.sweeping-strike|1'
)

lifebinder_skills=(
  'lifebinder.mending-light|1'
  'lifebinder.mend|1'
  'lifebinder.barrier|1'
  'lifebinder.renew|1'
  'lifebinder.sanctuary|1'
  'lifebinder.fortifying-light|1'
)

for entry in "${vanguard_skills[@]}"; do
  IFS='|' read -r skill_id version <<<"$entry"
  result="$(record_unlock "$skill_id" "$version" 'vanguard')"
  test "$result" = "$skill_id|false"
done

for entry in "${lifebinder_skills[@]}"; do
  IFS='|' read -r skill_id version <<<"$entry"
  result="$(record_unlock "$skill_id" "$version" 'lifebinder')"
  test "$result" = "$skill_id|false"
done

learned_count="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text
  from public.get_character_learned_skills_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$learned_count" = '14'

pure_payload='[{"skillId":"vanguard.forceful-strike","contentVersion":2,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.cleave","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.guard-break","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.brace","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.rally","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.shield-bash","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.second-wind","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.sweeping-strike","contentVersion":1,"sourceDisciplineId":"vanguard"}]'

pure_save="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || replayed::text
  from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1,
    '$pure_payload'::jsonb,
    '00000000-0000-4000-8000-000000003802'::uuid,
    'sha256:p38-pure-eight'
  );")"
test "$pure_save" = '2|false'

pure_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    jsonb_array_length(snapshot -> 'disciplineSkills')::text || '|' ||
    coalesce(snapshot -> 'secondary' ->> 'disciplineId', '') || '|' ||
    coalesce(snapshot -> 'extensions' ->> 'resonance', '') || '|' ||
    (snapshot -> 'extensions' -> 'essence' ->> 'essenceId')
  from (
    select public.get_character_committed_build_snapshot_v2('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$pure_snapshot" = '8|||essence.vanguard.unbroken-strike'

mastery="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select discipline_id || '|' || replayed::text
  from public.record_character_discipline_mastery_v1(
    '$character_id'::uuid,
    'lifebinder',
    'support',
    'pv2-buildcraft-test-kit:v1'
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
    '00000000-0000-4000-8000-000000003803'::uuid,
    'sha256:p38-mixed-pair'
  );")"
test "$mixed_change" = '3|vanguard|lifebinder'

pruned_to_six="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text
  from public.get_character_discipline_skill_loadout_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$pruned_to_six" = '6'

mixed_payload='[{"skillId":"vanguard.forceful-strike","contentVersion":2,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.brace","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"vanguard.cleave","contentVersion":1,"sourceDisciplineId":"vanguard"},{"skillId":"lifebinder.mending-light","contentVersion":1,"sourceDisciplineId":"lifebinder"},{"skillId":"lifebinder.barrier","contentVersion":1,"sourceDisciplineId":"lifebinder"},{"skillId":"lifebinder.renew","contentVersion":1,"sourceDisciplineId":"lifebinder"}]'

mixed_save="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || replayed::text
  from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    3,
    '$mixed_payload'::jsonb,
    '00000000-0000-4000-8000-000000003804'::uuid,
    'sha256:p38-mixed-six'
  );")"
test "$mixed_save" = '4|false'

mixed_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    jsonb_array_length(snapshot -> 'disciplineSkills')::text || '|' ||
    (snapshot -> 'secondary' ->> 'disciplineId') || '|' ||
    (snapshot -> 'extensions' -> 'resonance' ->> 'resonanceId') || '|' ||
    coalesce(snapshot -> 'extensions' ->> 'essence', '') || '|' ||
    (select count(distinct skill ->> 'sourceDisciplineId')
       from jsonb_array_elements(snapshot -> 'disciplineSkills') skill)::text
  from (
    select public.get_character_committed_build_snapshot_v2('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$mixed_snapshot" = '6|lifebinder|resonance.lifebinder-vanguard.mercys-edge||2'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    4,
    '$pure_payload'::jsonb,
    '00000000-0000-4000-8000-000000003805'::uuid,
    'sha256:p38-illegal-mixed-eight'
  );" >/tmp/p38-over6.out 2>/tmp/p38-over6.err; then
  echo 'Expected the mixed build to reject the eight-Skill pure loadout.' >&2
  exit 1
fi
grep -Fq 'DISCIPLINE_SKILL_CAPACITY_EXCEEDED' /tmp/p38-over6.err

echo 'P3.8 representative pure/mixed buildcraft database authority verified.'
