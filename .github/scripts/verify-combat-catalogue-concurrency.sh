#!/usr/bin/env bash
set -euo pipefail
# Disposable local Supabase only. Run last: committed fixture history/policy is
# intentionally retained until the CI stack is destroyed, just like real history.
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
sql() { docker exec "$db_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "$1"; }
# The earlier staff-authority verifier bootstraps the sole trusted CI Owner.
# Reuse it rather than violating the real single-enabled-Owner constraint.
owner_id="$(sql "select user_id from app_private.master_panel_role_assignments where role='game-owner' and enabled;")"
[[ "$owner_id" =~ ^[0-9a-f-]{36}$ ]]
race_tmp="$(mktemp -d)"
holder_app="catalogue-holder-$owner_id"
writer_app="catalogue-writer-$owner_id"
holder_pid=''
writer_pid=''
active_race=''
cleanup() {
  result=$?
  trap - EXIT
  sql "select pg_terminate_backend(pid) from pg_stat_activity where application_name in ('$holder_app','$writer_app') and pid<>pg_backend_pid();" >/dev/null || true
  if [ -n "$holder_pid" ]; then wait "$holder_pid" 2>/dev/null || true; fi
  if [ -n "$writer_pid" ]; then wait "$writer_pid" 2>/dev/null || true; fi
  if [ "$result" -ne 0 ]; then
    # Preserve exact fixture evidence without flooding the job log with every
    # completed EXPECTED state snapshot. Large logs defeat remote log readers.
    mkdir -p /tmp/aurevane-catalogue-race-failure
    # Copy only regular logs; race input FIFOs must never enter an artifact.
    for race_log in "$race_tmp"/*.log; do
      if [ -f "$race_log" ]; then cp "$race_log" /tmp/aurevane-catalogue-race-failure/; fi
    done
    printf 'Catalogue failure during %s (exit %s)\n' "${active_race:-fixture setup}" "$result" >&2
    if [ -n "$active_race" ]; then
      for race_log in "$race_tmp/$active_race-holder.log" "$race_tmp/$active_race-writer.log"; do
        if [ -f "$race_log" ]; then
          printf '%s\n' "$(basename "$race_log")" >&2
          awk 'length($0)>2000 { print substr($0,1,2000) " [diagnostic line truncated]"; next } { print }' "$race_log" | tail -30 >&2
        fi
      done
    fi
  fi
  rm -rf "$race_tmp"
  exit "$result"
}
trap cleanup EXIT

originals_json="$(node apps/web/scripts/master-originals-fixture.mjs)"

# The all-migration local regression executes this exact SQL too. Native execution
# proves real PostgreSQL bytes, current metadata, deep history and forged/CAS denials.
{ printf '%s\n' 'begin;' "select set_config('task13.owner','$owner_id',true);" "select set_config('task13.originals', :'originals', true);"; cat .github/scripts/verify-master-content-lifecycle.sql; printf '%s\n' 'rollback;'; } | docker exec -i "$db_container" psql -X -v ON_ERROR_STOP=1 -v originals="$originals_json" -U postgres -d postgres

# Snapshot all persisted combat authoring state, including immutable history and
# drafts. A losing writer must not even delete an existing draft.
state_expression="jsonb_build_object(
  'catalogue',public.read_combat_content_catalogue_v1(),
  'publications',(select coalesce(jsonb_agg(to_jsonb(p) order by content_key),'[]') from app_private.combat_content_publications p),
  'media',(select coalesce(jsonb_agg(to_jsonb(m) order by id),'[]') from app_private.combat_content_media m),
  'mediaReferences',(select coalesce(jsonb_agg(to_jsonb(m) order by to_jsonb(m)::text),'[]') from app_private.combat_content_media_versions m),
  'versions',(select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from app_private.combat_content_versions v),
  'drafts',(select coalesce(jsonb_agg(to_jsonb(d) order by content_key),'[]') from app_private.combat_content_drafts d),
  'records',(select coalesce(jsonb_agg(to_jsonb(r) order by content_key),'[]') from app_private.combat_content_records r),
  'requests',(select coalesce(jsonb_agg(to_jsonb(r) order by actor_user_id,request_id),'[]') from app_private.combat_content_record_requests r),
  'links',(select coalesce(jsonb_agg(to_jsonb(l) order by parent_key,child_key),'[]') from app_private.combat_content_links l),
  'attribution',(select coalesce(jsonb_agg(to_jsonb(a) order by version_id),'[]') from app_private.combat_content_attribution a),
  'references',(select coalesce(jsonb_agg(to_jsonb(r) order by source_key,version_key,target_key),'[]') from app_private.combat_content_references r),
  'builtinSelections',(select coalesce(jsonb_agg(to_jsonb(s) order by kind,selection_key),'[]') from app_private.combat_content_builtin_selections s),
  'characters',(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.characters c),
  'earned',(select coalesce(jsonb_agg(to_jsonb(u) order by character_id,skill_id),'[]') from app_private.character_skill_unlocks u),
  'equipped',(select coalesce(jsonb_agg(to_jsonb(e) order by character_id,slot_index),'[]') from app_private.character_build_discipline_skills e),
  'saved',(select coalesce(jsonb_agg(to_jsonb(s) order by character_id,slot_index),'[]') from app_private.character_saved_build_loadouts s),
  'builds',(select coalesce(jsonb_agg(to_jsonb(b) order by character_id),'[]') from app_private.character_active_builds b),
  'personal',(select coalesce(jsonb_agg(to_jsonb(p) order by character_id),'[]') from app_private.character_attribute_personal_allocations p),
  'grants',(select coalesce(jsonb_agg(to_jsonb(g) order by character_id,skill_id,eligibility_discipline_id),'[]') from app_private.character_discipline_skill_grants g),
  'disciplinePointers',(select coalesce(jsonb_agg(to_jsonb(d) order by discipline_id),'[]') from app_private.discipline_current_definitions d),
  'disciplineDefinitions',(select coalesce(jsonb_agg(to_jsonb(d) order by discipline_id,definition_version),'[]') from app_private.discipline_definitions d),
  'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by discipline_id,profile_version),'[]') from app_private.discipline_primary_profiles p),
  'idempotency',(select coalesce(jsonb_agg(to_jsonb(i) order by actor_key,command_name,idempotency_key),'[]') from app_private.idempotency_records i),
  'mastery',(select coalesce(jsonb_agg(to_jsonb(p) order by character_id,discipline_id),'[]') from app_private.character_discipline_progress p),
  'character_attribute_reset_windows',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from app_private.character_attribute_reset_windows x),
  'character_attribute_change_audit',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from app_private.character_attribute_change_audit x),
  'character_build_change_audit',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from app_private.character_build_change_audit x),
  'character_discipline_masteries',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from app_private.character_discipline_masteries x),
  'character_saved_build_loadout_activation_audit',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from app_private.character_saved_build_loadout_activation_audit x),
  'character_saved_build_loadout_activation_idempotency',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from app_private.character_saved_build_loadout_activation_idempotency x),
  'character_saved_build_loadout_save_idempotency',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from app_private.character_saved_build_loadout_save_idempotency x),
  'character_skill_loadout_change_audit',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from app_private.character_skill_loadout_change_audit x),
  'character_skill_loadout_idempotency',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from app_private.character_skill_loadout_idempotency x),
  'phase4',(select coalesce(jsonb_agg(to_jsonb(c) order by skill_id),'[]') from app_private.phase4_skill_catalog c),
  'timing',(select jsonb_agg(to_jsonb(t) order by version) from app_private.combat_effect_timing_policy_versions t))::text"
wait_for_query() {
  for ((attempt=0; attempt<100; attempt++)); do
    if [ "$(sql "$1")" = 't' ]; then return; fi
    sleep 0.1
  done
  echo "Timed out waiting for $2" >&2
  return 1
}

# SQL arguments below are fixed test statements, not input from content/users.
race() {
  local label="$1" holder_sql="$2" writer_sql="$3" finish="${4:-commit}"
  local expected_error="${5-COMBAT_CONTENT_CATALOGUE_CONFLICT}" schedule="${6:-blocking}"
  active_race="$label"
  local writer_timeout='30s'
  if [ "$schedule" = immediate ]; then writer_timeout='3s'; fi
  local catalogue_token before_state writer_result expected_state
  catalogue_token="$(sql "select public.read_combat_content_catalogue_v1()->>'token';")"
  before_state="$(sql "select $state_expression;")"
  mkfifo "$race_tmp/$label-input"
  exec {holder_input}<>"$race_tmp/$label-input"
  docker exec -i -e PGAPPNAME="$holder_app" "$db_container" psql -X -Atq -v ON_ERROR_STOP=1 -v actor="$owner_id" -v token="$catalogue_token" -v originals="$originals_json" -U postgres -d postgres \
    <"$race_tmp/$label-input" >"$race_tmp/$label-holder.log" 2>&1 &
  holder_pid=$!
  cat >&"$holder_input" <<SQL
begin;
set local statement_timeout='30s';
set local role service_role;
$holder_sql
reset role;
select 'EXPECTED:' || $state_expression;
SQL
  wait_for_query "select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.application_name='$holder_app' and a.state='idle in transaction' and l.locktype='advisory' and l.granted);" "$label holder's real RPC lock"
  if [[ "$label" == b-*-producer-first ]]; then
    test "$(sql "select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.application_name='$holder_app' and l.locktype='advisory' and l.mode='ShareLock' and l.granted);")" = t
  elif [[ "$label" == b-*-catalogue-first ]]; then
    test "$(sql "select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.application_name='$holder_app' and l.locktype='advisory' and l.mode='ExclusiveLock' and l.granted);")" = t
  fi
  docker exec -i -e PGAPPNAME="$writer_app" "$db_container" psql -X -Atq -v ON_ERROR_STOP=1 -v actor="$owner_id" -v token="$catalogue_token" -v originals="$originals_json" -U postgres -d postgres \
    >"$race_tmp/$label-writer.log" 2>&1 <<SQL &
begin;
\\set VERBOSITY verbose
set local statement_timeout='$writer_timeout';
set local role service_role;
$writer_sql
rollback;
SQL
  writer_pid=$!
  writer_result=0
  if [ "$schedule" = blocking ]; then
    wait_for_query "select exists(select 1 from pg_stat_activity a join pg_stat_activity h on h.application_name='$holder_app' where a.application_name='$writer_app' and a.wait_event_type='Lock' and h.pid=any(pg_blocking_pids(a.pid)));" "$label writer blocked by catalogue holder"
  else
    # The writer must finish while the holder still owns its real RPC lock.
    # A blocking implementation times out and fails the exact error/result check.
    wait "$writer_pid" || writer_result=$?
    writer_pid=''
    test "$(sql "select exists(select 1 from pg_stat_activity where application_name='$holder_app' and state='idle in transaction');")" = t
  fi
  printf '%s;\n\\quit\n' "$finish" >&"$holder_input"
  exec {holder_input}>&-
  wait "$holder_pid"
  holder_pid=''
  if [ -n "$writer_pid" ]; then wait "$writer_pid" || writer_result=$?; fi
  writer_pid=''
  if [ "$finish" = commit ]; then
    if [ -n "$expected_error" ]; then
      test "$writer_result" -ne 0
      grep -Fq "$expected_error" "$race_tmp/$label-writer.log"
      if [ "$expected_error" = COMBAT_CONTENT_ADMISSION_RETRY ]; then grep -Fq 'PT409:' "$race_tmp/$label-writer.log"; fi
    else
      test "$writer_result" -eq 0
    fi
    expected_state="$(sed -n 's/^EXPECTED://p' "$race_tmp/$label-holder.log")"
    test -n "$expected_state"
    test "$(sql "select $state_expression;")" = "$expected_state"
  else
    if [ -n "$expected_error" ]; then
      test "$writer_result" -ne 0
      grep -Fq "$expected_error" "$race_tmp/$label-writer.log"
      grep -Fq 'PT409:' "$race_tmp/$label-writer.log"
    else
      test "$writer_result" -eq 0
    fi
    test "$(sql "select $state_expression;")" = "$before_state"
  fi
  echo "Catalogue two-session $label: observed $schedule schedule, $finish, exact result and complete persisted state PASS."
  active_race=''
}

sql "set role service_role; select public.write_combat_content_record_v1('$owner_id',null,k,jsonb_build_object('action','create','requestId',gen_random_uuid(),'contentKind','skill','definition',jsonb_build_object('id',k))) from unnest(array['ci.catalogue-race','ci.catalogue-loser']) k;" >/dev/null
publish="select public.publish_saved_combat_content_v1(:'actor',null,'ci.catalogue-race',1,null,:'token',5);"
timing="select public.publish_combat_effect_timing_policy_v2(:'actor',(public.read_combat_content_catalogue_v1()->'policy'->>'version')::integer,'{\"slow\":\"instant\"}',:'token');"
race content-versus-timing "$publish" "$timing"
test "$(sql "select content_version from app_private.combat_content_versions where content_key='ci.catalogue-race';")" = 6
race timing-versus-content "$timing" "select public.publish_saved_combat_content_v1(:'actor',null,'ci.catalogue-loser',1,null,:'token',5);"
race history-versus-content "select public.write_combat_content_record_v1(:'actor',null,'ci.catalogue-race','{\"action\":\"restore\",\"expectedRevision\":2,\"sourceVersion\":6}');" "select public.publish_saved_combat_content_v1(:'actor',null,'ci.catalogue-loser',1,null,:'token',5);"
publish="select public.publish_saved_combat_content_v1(:'actor',null,'ci.catalogue-race',2,6,:'token',1);"
race rollback-releases-token "$publish" "$timing" rollback ''

# Use an isolated confirmed account and a physical character fixture. The actual
# earned-Skill RPC runs under service_role; no guard or authorizer is replaced.
admission_user="$(sql "insert into auth.users(id,email,email_confirmed_at) values(gen_random_uuid(),'content-admission-native@example.test',now()) returning id;")"
admission_character="$(sql "insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at) values(gen_random_uuid(),'$admission_user',0,1,'Content Admission','content-admission-native','androgynous','they_them','portrait.starter.wayfarer-01','appearance.starter.roadworn','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now()) returning id;")"
[[ "$admission_character" =~ ^[0-9a-f-]{36}$ ]]
sql "set role service_role; select public.write_combat_content_record_v1('$owner_id',null,k,jsonb_build_object('action','create','requestId',gen_random_uuid(),'contentKind','skill','definition',jsonb_build_object('id',k,'sourceDisciplineId','vanguard'))) from unnest(array['ci.admission-first','ci.archive-first','ci.shared-first','ci.shared-second']) k;" >/dev/null
grant_skill() { printf "select * from public.record_character_skill_unlock_v1('%s','%s',1,'vanguard','owner','native-content-admission');" "$admission_character" "$1"; }
archive_skill() { printf "select public.write_combat_content_record_v1(:'actor',null,'%s','{\"action\":\"archive\",\"expectedRevision\":1}');" "$1"; }
race admission-before-archive "$(grant_skill ci.admission-first)" "$(archive_skill ci.admission-first)" commit COMBAT_CONTENT_DEPENDENCIES
# Take the player row first, as real admission callers do. The subsequent trigger
# must try its shared lock without waiting, avoiding catalogue/player inversion.
race archive-before-admission "$(archive_skill ci.archive-first)" "reset role; select id from public.characters where id='$admission_character' for update; update public.characters set xp=xp+1 where id='$admission_character'; set local role service_role; $(grant_skill ci.archive-first)" commit COMBAT_CONTENT_ADMISSION_RETRY immediate
race independent-shared-admission "$(grant_skill ci.shared-first)" "$(grant_skill ci.shared-second)" rollback '' immediate

echo 'Combat catalogue physical PostgreSQL races: saved revision and floor, content/timing/restore cross-writer CAS, rollback and zero partial losing writes PASS.'
echo 'Content archive/admission physical PostgreSQL races: admission-first dependency, archive-first immediate PT409, shared admissions and complete player/content rollback PASS.'

# Stage B: each of the seven guarded tables is reached by its real mutation
# producer. phase4_skill_catalog is the private content-import table itself.
# Every schedule uses an independent catalogue holder, exact result, bounded
# fail-fast assertion, and whole persisted state comparison including grants,
# personal points, pointers and idempotency. Successful holders roll back here.
sql "set role service_role; select public.write_combat_content_record_v1('$owner_id',null,k,jsonb_build_object('action','create','requestId',gen_random_uuid(),'contentKind','skill','definition',jsonb_build_object('id',k,'sourceDisciplineId','vanguard'))) from unnest(array['ci.b-stage-lock','ci.b-stage-grant','ci.b-stage-import']) k;" >/dev/null
# A real unspent level point lets the allocation producer perform a write.
sql "update public.characters set level=2 where id='$admission_character';" >/dev/null
archive_b="$(archive_skill ci.b-stage-lock)"
selected_b="$(sql "select jsonb_agg(jsonb_build_object('skillId',skill_id,'contentVersion',skill_content_version,'sourceDisciplineId',source_discipline_id,'eligibilityDisciplineId','vanguard') order by skill_id) from (select * from app_private.character_skill_unlocks where character_id='$admission_character' and source_discipline_id='vanguard' and skill_id like 'vanguard.%' order by skill_id limit 2) s;")"
version_b="$(sql "select build_version from app_private.character_active_builds where character_id='$admission_character';")"
producer_b() {
  case "$1" in
    character_skill_unlocks|character_discipline_skill_grants) grant_skill ci.b-stage-grant ;;
    character_build_discipline_skills) printf "select * from public.save_character_discipline_skill_loadout_v1('%s','%s',%s,'%s'::jsonb,gen_random_uuid(),'native-b-selected');" "$admission_user" "$admission_character" "$version_b" "$selected_b" ;;
    character_saved_build_loadouts) printf "select * from public.save_character_build_loadout_v1('%s','%s',1::smallint,'Native B',%s,gen_random_uuid(),'native-b-named');" "$admission_user" "$admission_character" "$version_b" ;;
    character_active_builds) printf "select * from public.change_character_disciplines_v3('%s','%s',%s,true,'lifebinder',false,null,gen_random_uuid(),'native-b-primary');" "$admission_user" "$admission_character" "$version_b" ;;
    character_attribute_personal_allocations) printf "select * from public.commit_character_attribute_allocation_v2('%s','%s','spend',13,4,7,4,3,6,gen_random_uuid(),'native-b-allocation');" "$admission_user" "$admission_character" ;;
    phase4_skill_catalog) printf "reset role; insert into app_private.phase4_skill_catalog(skill_id,content_version,discipline_id,minimum_stage) values('ci.b-stage-import',1,'vanguard',1); set local role service_role;" ;;
    *) return 1 ;;
  esac
}
for guarded_table in character_skill_unlocks character_build_discipline_skills character_saved_build_loadouts phase4_skill_catalog character_active_builds character_attribute_personal_allocations character_discipline_skill_grants; do
  actual_producer="$(producer_b "$guarded_table")"
  race "b-$guarded_table-catalogue-first" "$archive_b" "$actual_producer" rollback COMBAT_CONTENT_ADMISSION_RETRY immediate
  race "b-$guarded_table-producer-first" "$actual_producer" "$archive_b" rollback '' blocking
done
echo 'Stage B all seven actual guard tables: both physical catalogue/producer lock orders and whole-transaction rollback PASS.'

# Tag publication uses the same catalogue lock as complete Skill publication.
# Observe both real blocking orders; the losing writer retains its entire draft.
prepare_tag_race() {
  { printf '%s\n' 'begin;' "select set_config('task13.owner', :'actor', true);" 'set local role service_role;'; cat .github/scripts/prepare-combat-tag-race.sql; printf '%s\n' 'commit;'; } |
    docker exec -i "$db_container" psql -X -v ON_ERROR_STOP=1 -v actor="$owner_id" -U postgres -d postgres >/dev/null
}
tag_publication() {
  local draft_version base_version
  draft_version="$(sql "select draft_version from app_private.combat_content_drafts where content_key='tag.damage';")"
  base_version="$(sql "select coalesce(base_version::text,'null') from app_private.combat_content_drafts where content_key='tag.damage';")"
  printf "select public.publish_saved_combat_content_v1(:'actor',null,'tag.damage',%s,%s,:'token',null);" "$draft_version" "$base_version"
}
prepare_tag_race
tag_publish="$(tag_publication)"
loser_publish="select public.publish_saved_combat_content_v1(:'actor',null,'ci.catalogue-loser',1,null,:'token',5);"
race tag-before-skill "$tag_publish" "$loser_publish"
prepare_tag_race
tag_publish="$(tag_publication)"
race skill-before-tag "$loser_publish" "$tag_publish"
race tag-rollback "$tag_publish" "$timing" rollback ''
echo 'Media/Tag lifecycle, pointer attribution, both actual Tag/Skill lock orders and whole rollback PASS.'

# Exact source-defined Basic original restore participates in both lock orders.
original_guard="(select value from jsonb_array_elements(:'originals'::jsonb) where value->>'id'='basic.guard')"
# The command below is transported through psql variables, not interpolated SQL JSON.
printf '%s\n' "set role service_role; select public.write_combat_content_record_v1(:'actor',null,'basic.guard',jsonb_build_object('action','save','expectedRevision',public.read_combat_content_record_v1(:'actor',null,'basic.guard')->'revision','definition',$original_guard));" | docker exec -i "$db_container" psql -X -v ON_ERROR_STOP=1 -v actor="$owner_id" -v originals="$originals_json" -U postgres -d postgres >/dev/null
original_restore() {
  local revision
  revision="$(sql "select revision from app_private.combat_content_records where content_key='basic.guard';")"
  printf "select public.write_combat_content_record_v1(:'actor',null,'basic.guard',jsonb_build_object('action','restore','expectedRevision',%s,'sourceVersion',1,'sourceKind','builtin','sourceDefinition',%s));" "$revision" "$original_guard"
}
original_publish() {
  local version base
  version="$(sql "select draft_version from app_private.combat_content_drafts where content_key='basic.guard';")"
  base="$(sql "select coalesce(base_version::text,'null') from app_private.combat_content_drafts where content_key='basic.guard';")"
  printf "select public.publish_saved_combat_content_v1(:'actor',null,'basic.guard',%s,%s,:'token',1);" "$version" "$base"
}
race original-before-publication "$(original_restore)" "$(original_publish)"
race publication-before-original "$(original_publish)" "$(original_restore)" commit COMBAT_CONTENT_RECORD_CONFLICT
race original-rollback "$(original_restore)" "$timing" rollback ''
echo 'System-original restore: both physical restore/publication lock orders and whole rollback PASS.'
