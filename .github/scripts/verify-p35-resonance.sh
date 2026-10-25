#!/usr/bin/env bash
set -euo pipefail
trap 'printf "P3.5 Resonance assertion failed at script line %s.\n" "$LINENO" >&2' ERR

source .github/scripts/auth-test-helpers.sh
load_test_auth

password='P35-resonance-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

email="p35-resonance-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
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
    '00000000-0000-4000-8000-000000003501'::uuid,
    'p35:character:resonancetester',
    1,
    'P35 Resonance Tester',
    'p35resonancetester',
    'androgynous',
    'they_them',
    'portrait.starter.wayfarer-01',
    'appearance.starter.roadworn',
    'vanguard',
    12, 4, 7, 4, 3, 6
  );")"
test -n "$character_id"

# P3.5 derives Resonance from the committed Discipline pair and does not add a new
# character-owned persistent build field. A fresh P3.2-only build must therefore remain schema v2.
initial="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select schema_version::text || '|' || build_version::text || '|' || primary_discipline_id || '|' || coalesce(secondary_discipline_id, '')
  from public.get_character_active_build_v2('$user_id'::uuid, '$character_id'::uuid);")"
test "$initial" = '2|1|vanguard|'

pure_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    (snapshot ->> 'schemaVersion') || '|' ||
    coalesce(snapshot -> 'extensions' ->> 'resonance', '')
  from (
    select public.get_character_committed_build_snapshot_v1('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$pure_snapshot" = '2|'

privileges="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  select
    has_table_privilege('authenticated', 'app_private.resonance_definitions', 'SELECT')::text || '|' ||
    has_table_privilege('authenticated', 'app_private.resonance_definitions', 'UPDATE')::text || '|' ||
    has_function_privilege(
      'authenticated',
      'app_private.resolve_resonance_reference_v1(text,text)',
      'EXECUTE'
    )::text || '|' ||
    (select count(*)::text
      from information_schema.columns
      where table_schema = 'app_private'
        and table_name = 'character_active_builds'
        and column_name = 'resonance_id');")"
test "$privileges" = 'false|false|false|0'

# The current testing release intentionally auto-grants active Secondary Disciplines. Remove only
# those support grants from this legacy P3.5 fixture so manual mastery and Resonance regressions
# continue to prove their original authority path independently of testing access.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  delete from app_private.character_discipline_masteries
  where character_id = '$character_id'::uuid
    and source_kind = 'support'
    and source_id = 'active-player-discipline-testing:v1';" >/dev/null

mastery="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select discipline_id || '|' || mastered_definition_version::text || '|' || replayed::text
  from public.record_character_discipline_mastery_v1(
    '$character_id'::uuid,
    'lifebinder',
    'system',
    'p35.database-proof'
  );")"
test "$mastery" = 'lifebinder|1|false'

mixed_change="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select schema_version::text || '|' || build_version::text || '|' || primary_discipline_id || '|' || secondary_discipline_id
  from public.change_character_disciplines_v2(
    '$user_id'::uuid,
    '$character_id'::uuid,
    1,
    false,
    'vanguard',
    true,
    'lifebinder',
    '00000000-0000-4000-8000-000000003502'::uuid,
    'sha256:p35-mixed'
  );")"
test "$mixed_change" = '2|2|vanguard|lifebinder'

mixed_snapshot="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select
    (snapshot ->> 'schemaVersion') || '|' ||
    (snapshot -> 'extensions' -> 'resonance' ->> 'resonanceId') || '|' ||
    (snapshot -> 'extensions' -> 'resonance' ->> 'contentVersion') || '|' ||
    (snapshot -> 'extensions' -> 'resonance' -> 'disciplinePair' ->> 0) || '|' ||
    (snapshot -> 'extensions' -> 'resonance' -> 'disciplinePair' ->> 1)
  from (
    select public.get_character_committed_build_snapshot_v1('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$mixed_snapshot" = '2|resonance.lifebinder-vanguard.mercys-edge|5|lifebinder|vanguard'

# Current readers use the selected immutable content catalogue (the builtin is
# version 5), not the retired resonance_definitions enable flag. Force a
# tombstone inside a rolled-back subtransaction to prove fail-closed admission.
# The ordinary editor cannot archive a selected dependency in the first place.
docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  do \$proof\$
  begin
    -- Model a retained disabled current row independently of the publication
    -- guard. The exception subtransaction rolls back the row, pointer and DDL.
    begin
      alter table app_private.combat_content_publications disable trigger validate_discipline_selections;
      with retained as (
        insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by)
        values('resonance.lifebinder-vanguard.mercys-edge','resonance',100,
          jsonb_build_object('id','resonance.lifebinder-vanguard.mercys-edge','contentVersion',100,
            'enabled',false,'disciplinePair',jsonb_build_array('lifebinder','vanguard')),'$user_id'::uuid)
        returning id,content_key,content_kind
      )
      insert into app_private.combat_content_publications(content_key,content_kind,version_id,updated_by)
      select content_key,content_kind,id,'$user_id'::uuid from retained;
      perform public.get_character_committed_build_snapshot_v1('$user_id'::uuid, '$character_id'::uuid);
      raise exception 'P35_DISABLED_SELECTION_WAS_ACCEPTED';
    exception when sqlstate '22023' then
      if sqlerrm <> 'COMBAT_CONTENT_SELECTION_DISABLED' then raise; end if;
    end;
    if exists(select 1 from app_private.combat_content_versions
      where content_key = 'resonance.lifebinder-vanguard.mercys-edge' and content_version = 100)
    then raise exception 'P35_DISABLED_SELECTION_DID_NOT_ROLL_BACK'; end if;
    begin
      update app_private.combat_content_records set lifecycle = 'archived'
      where content_key = 'resonance.lifebinder-vanguard.mercys-edge';
      perform public.get_character_committed_build_snapshot_v1('$user_id'::uuid, '$character_id'::uuid);
      raise exception 'P35_TOMBSTONE_WAS_ACCEPTED';
    exception when sqlstate '22023' then
      if sqlerrm <> 'COMBAT_CONTENT_ARCHIVED' then raise; end if;
    end;
    if exists(select 1 from app_private.combat_content_records
      where content_key = 'resonance.lifebinder-vanguard.mercys-edge' and lifecycle <> 'active')
    then raise exception 'P35_TOMBSTONE_DID_NOT_ROLL_BACK'; end if;
  end \$proof\$;
  update app_private.character_active_builds
  set secondary_attunement_locked_until = clock_timestamp() - interval '1 second'
  where character_id = '$character_id'::uuid;" >/dev/null

pure_again="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select schema_version::text || '|' || build_version::text || '|' || coalesce(secondary_discipline_id, '')
  from public.change_character_disciplines_v2(
    '$user_id'::uuid,
    '$character_id'::uuid,
    2,
    false,
    'vanguard',
    true,
    null,
    '00000000-0000-4000-8000-000000003503'::uuid,
    'sha256:p35-pure-again'
  );")"
test "$pure_again" = '2|3|'

resolved_pure_again="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
  set role service_role;
  select coalesce(snapshot -> 'extensions' ->> 'resonance', '')
  from (
    select public.get_character_committed_build_snapshot_v1('$user_id'::uuid, '$character_id'::uuid) as snapshot
  ) resolved;")"
test "$resolved_pure_again" = ''

echo 'P3.5 Resonance database authority verified.'
