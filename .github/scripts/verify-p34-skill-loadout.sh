#!/usr/bin/env bash
set -euo pipefail

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P34-skill-loadout-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

create_test_user() {
  local email="$1"
  local signup user_id
  signup="$(signup_test_user "$email" "$password")"
  user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
  test -n "$user_id"
  test "$user_id" != 'null'
  confirm_test_user "$user_id"
  printf '%s' "$user_id"
}

create_test_character() {
  local user_id="$1"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
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
    );"
}

record_unlock() {
  local character_id="$1"
  local skill_id="$2"
  local content_version="$3"
  local source_discipline_id="$4"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select skill_id || '|' || skill_content_version::text || '|' || source_discipline_id || '|' || replayed::text
    from public.record_character_skill_unlock_v1(
      '$character_id'::uuid,
      '$skill_id',
      $content_version,
      '$source_discipline_id',
      'system',
      'p34.database-proof'
    );"
}

email="p34-skills-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
user_id="$(create_test_user "$email")"
character_id="$(create_test_character "$user_id")"
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

vanguard_unlock="$(record_unlock "$character_id" 'vanguard.forceful-strike' 2 'vanguard')"
test "$vanguard_unlock" = 'vanguard.forceful-strike|2|vanguard|false'
lifebinder_unlock="$(record_unlock "$character_id" 'lifebinder.mending-light' 1 'lifebinder')"
test "$lifebinder_unlock" = 'lifebinder.mending-light|1|lifebinder|false'

learned="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text || '|' || string_agg(skill_id, ',' order by skill_id)
  from public.get_character_learned_skills_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$learned" = '2|lifebinder.mending-light,vanguard.forceful-strike'

pure_payload='[{"skillId":"vanguard.forceful-strike","contentVersion":2,"sourceDisciplineId":"vanguard"}]'
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

post_pure="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select schema_version::text || '|' || build_version::text
  from public.get_character_active_build_v2('$user_id'::uuid, '$character_id'::uuid);")"
test "$post_pure" = '3|2'

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

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2,
    '$pure_payload'::jsonb,
    '00000000-0000-4000-8000-000000003402'::uuid,
    'sha256:p34-conflicting-reuse'
  );" >/tmp/p34-idempotency.out 2>/tmp/p34-idempotency.err; then
  echo 'Expected Skill-loadout idempotency conflict.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_SKILL_LOADOUT_IDEMPOTENCY_CONFLICT' /tmp/p34-idempotency.err

lifebinder_payload='[{"skillId":"lifebinder.mending-light","contentVersion":1,"sourceDisciplineId":"lifebinder"}]'
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2,
    '$lifebinder_payload'::jsonb,
    '00000000-0000-4000-8000-000000003403'::uuid,
    'sha256:p34-inactive-source'
  );" >/tmp/p34-inactive.out 2>/tmp/p34-inactive.err; then
  echo 'Expected inactive Secondary Skill source to fail on pure build.' >&2
  exit 1
fi
grep -Fq 'DISCIPLINE_SKILL_SOURCE_INACTIVE' /tmp/p34-inactive.err

for index in $(seq 1 9); do
  unlock="$(record_unlock "$character_id" "vanguard.capacity-$index" 1 'vanguard')"
  test "$unlock" = "vanguard.capacity-$index|1|vanguard|false"
done

over_eight_payload="$(python - <<'PY'
import json
print(json.dumps([
    {"skillId": f"vanguard.capacity-{index}", "contentVersion": 1, "sourceDisciplineId": "vanguard"}
    for index in range(1, 10)
], separators=(',', ':')))
PY
)"
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2,
    '$over_eight_payload'::jsonb,
    '00000000-0000-4000-8000-000000003404'::uuid,
    'sha256:p34-over-eight'
  );" >/tmp/p34-over8.out 2>/tmp/p34-over8.err; then
  echo 'Expected pure build capacity >8 to fail.' >&2
  exit 1
fi
grep -Fq 'DISCIPLINE_SKILL_CAPACITY_EXCEEDED' /tmp/p34-over8.err

mastery="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select discipline_id || '|' || mastered_definition_version::text || '|' || replayed::text
  from public.record_character_discipline_mastery_v1(
    '$character_id'::uuid,
    'lifebinder',
    'system',
    'p34.database-proof'
  );")"
test "$mastery" = 'lifebinder|1|false'

mixed_change="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || primary_discipline_id || '|' || secondary_discipline_id || '|' || replayed::text
  from public.change_character_disciplines_v2(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2,
    false,
    'vanguard',
    true,
    'lifebinder',
    '00000000-0000-4000-8000-000000003405'::uuid,
    'sha256:p34-mixed'
  );")"
test "$mixed_change" = '3|vanguard|lifebinder|false'

preserved_after_mix="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text || '|' || string_agg(skill_id, ',' order by slot_index)
  from public.get_character_discipline_skill_loadout_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$preserved_after_mix" = '1|vanguard.forceful-strike'

mixed_payload='[{"skillId":"vanguard.forceful-strike","contentVersion":2,"sourceDisciplineId":"vanguard"},{"skillId":"lifebinder.mending-light","contentVersion":1,"sourceDisciplineId":"lifebinder"}]'
mixed_save="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || replayed::text
  from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    3,
    '$mixed_payload'::jsonb,
    '00000000-0000-4000-8000-000000003406'::uuid,
    'sha256:p34-mixed-save'
  );")"
test "$mixed_save" = '4|false'

over_six_payload="$(python - <<'PY'
import json
skills = [
    {"skillId": "vanguard.forceful-strike", "contentVersion": 2, "sourceDisciplineId": "vanguard"},
]
skills.extend(
    {"skillId": f"vanguard.capacity-{index}", "contentVersion": 1, "sourceDisciplineId": "vanguard"}
    for index in range(1, 7)
)
print(json.dumps(skills, separators=(',', ':')))
PY
)"
if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    4,
    '$over_six_payload'::jsonb,
    '00000000-0000-4000-8000-000000003407'::uuid,
    'sha256:p34-over-six'
  );" >/tmp/p34-over6.out 2>/tmp/p34-over6.err; then
  echo 'Expected mixed build capacity >6 to fail.' >&2
  exit 1
fi
grep -Fq 'DISCIPLINE_SKILL_CAPACITY_EXCEEDED' /tmp/p34-over6.err

# Expire only the test character's Secondary lock so the normal authoritative
# Discipline command can prove that a legal Secondary removal prunes its Skills.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_active_builds
  set secondary_attunement_locked_until = clock_timestamp() - interval '1 second'
  where character_id = '$character_id'::uuid;" >/dev/null

pure_again="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select build_version::text || '|' || primary_discipline_id || '|' || coalesce(secondary_discipline_id, '')
  from public.change_character_disciplines_v2(
    '$user_id'::uuid,
    '$character_id'::uuid,
    4,
    false,
    'vanguard',
    true,
    null,
    '00000000-0000-4000-8000-000000003408'::uuid,
    'sha256:p34-pure-again'
  );")"
test "$pure_again" = '5|vanguard|'

pruned="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text || '|' || coalesce(string_agg(skill_id, ',' order by slot_index), '')
  from public.get_character_discipline_skill_loadout_v1('$user_id'::uuid, '$character_id'::uuid);")"
test "$pruned" = '1|vanguard.forceful-strike'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.save_character_discipline_skill_loadout_v1(
    '$user_id'::uuid,
    '$character_id'::uuid,
    4,
    '$pure_payload'::jsonb,
    '00000000-0000-4000-8000-000000003409'::uuid,
    'sha256:p34-stale'
  );" >/tmp/p34-stale.out 2>/tmp/p34-stale.err; then
  echo 'Expected stale Skill-loadout build version to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_BUILD_VERSION_CONFLICT' /tmp/p34-stale.err

snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    (snapshot ->> 'schemaVersion') || '|' ||
    (snapshot ->> 'buildVersion') || '|' ||
    (snapshot -> 'primary' ->> 'disciplineId') || '|' ||
    coalesce(snapshot -> 'secondary' ->> 'disciplineId', '') || '|' ||
    jsonb_array_length(snapshot -> 'disciplineSkills')::text || '|' ||
    (snapshot -> 'disciplineSkills' -> 0 ->> 'skillId') || '|' ||
    coalesce(snapshot -> 'extensions' ->> 'resonance', '') || '|' ||
    jsonb_array_length(snapshot -> 'extensions' -> 'equipmentSkills')::text
  from (
    select public.get_character_committed_build_snapshot_v1(
      '$user_id'::uuid,
      '$character_id'::uuid
    ) snapshot
  ) resolved;")"
test "$snapshot" = '3|5|vanguard||1|vanguard.forceful-strike||0'

audit="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select count(*)::text || '|' || min(build_version_before)::text || '|' || max(build_version_after)::text
  from app_private.character_skill_loadout_change_audit
  where character_id = '$character_id'::uuid;")"
test "$audit" = '2|1|4'

echo 'P3.4 Skill loadout authority verified.'
