#!/usr/bin/env bash
set -euo pipefail
# Disposable local Supabase only. Never accepts a remote connection URL.
source .github/scripts/auth-test-helpers.sh
load_test_auth
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
email="support-action-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}@example.com"
signup="$(signup_test_user "$email" 'Support-action-test-2026!')"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
confirm_test_user "$user_id"
character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
 set role service_role;
 select id::text from public.create_character_v3(
 '$user_id'::uuid, 0::smallint, gen_random_uuid(), 'support:create:character', 1,
 'Support Tester', 'supporttester', 'androgynous', 'they_them',
 'portrait.starter.wayfarer-01', 'appearance.starter.roadworn', 'vanguard', 12, 4, 7, 4, 3, 6);")"
docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
begin;
set role service_role;
do \$test\$
declare
 v_user uuid := '$user_id';
 v_character uuid := '$character_id';
 v_choice text;
 v_version bigint := 1;
 v_key uuid;
 v_row record;
 v_before jsonb;
begin
 if (public.get_character_active_build_v4(v_user,v_character)->>'support_action_id') is distinct from 'basic.guard' then raise exception 'legacy default failed'; end if;
 if public.get_character_active_build_v4(gen_random_uuid(),v_character) is not null then raise exception 'foreign read allowed'; end if;
 v_before := public.get_character_committed_build_snapshot_v2(v_user,v_character)->'disciplineSkills';
 foreach v_choice in array array['basic.guard','basic.recover','basic.recover.mp'] loop
   v_key := gen_random_uuid();
   select * into v_row from public.save_character_support_action_v1(v_user,v_character,v_version,v_choice,v_key,'support:'||v_choice);
   v_version := v_version + 1;
   if v_row.build_version is distinct from v_version or v_row.replayed then raise exception 'save failed'; end if;
   select * into v_row from public.save_character_support_action_v1(v_user,v_character,v_version-1,v_choice,v_key,'support:'||v_choice);
   if v_row.build_version is distinct from v_version or not v_row.replayed then raise exception 'replay failed'; end if;
   if public.get_character_committed_build_snapshot_v2(v_user,v_character)->>'supportActionId' is distinct from v_choice then raise exception 'snapshot did not pin choice'; end if;
   if public.get_character_committed_build_snapshot_v2(v_user,v_character)->'disciplineSkills' is distinct from v_before then raise exception 'support changed Discipline slots'; end if;
 end loop;
 begin
   perform public.save_character_support_action_v1(v_user,v_character,v_version,'basic.guard',v_key,'support:conflict');
   raise exception 'conflicting replay allowed';
 exception when raise_exception then if sqlerrm <> 'CHARACTER_SUPPORT_ACTION_IDEMPOTENCY_CONFLICT' then raise; end if; end;
 begin
   perform public.save_character_support_action_v1(v_user,v_character,1,'basic.guard',gen_random_uuid(),'support:stale');
   raise exception 'stale save allowed';
 exception when raise_exception then if sqlerrm <> 'CHARACTER_BUILD_VERSION_CONFLICT' then raise; end if; end;
 begin
   perform public.save_character_support_action_v1(gen_random_uuid(),v_character,v_version,'basic.guard',gen_random_uuid(),'support:foreign');
   raise exception 'foreign save allowed';
 exception when raise_exception then if sqlerrm <> 'CHARACTER_BUILD_NOT_FOUND' then raise; end if; end;
 foreach v_choice in array array['basic.attack','',null] loop
   begin
     perform public.save_character_support_action_v1(v_user,v_character,v_version,v_choice,gen_random_uuid(),'support:invalid');
     raise exception 'invalid action allowed';
   exception when invalid_parameter_value then if sqlerrm <> 'SUPPORT_ACTION_INVALID' then raise; end if; end;
 end loop;
 perform public.save_character_build_loadout_v1(v_user,v_character,1::smallint,'Recovery',v_version,gen_random_uuid(),'support:loadout');
 if (select support_action_id from public.get_character_saved_build_loadouts_v2(v_user,v_character) where slot_index=1) is distinct from 'basic.recover.mp' then raise exception 'loadout omitted support'; end if;
 perform public.save_character_support_action_v1(v_user,v_character,v_version,'basic.guard',gen_random_uuid(),'support:reset');
 v_version := v_version + 1;
 v_key := gen_random_uuid();
 select * into v_row from public.activate_character_build_loadout_v1(v_user,v_character,1::smallint,v_version,v_key,'support:activate');
 v_version := v_version + 1;
 if v_row.build_version is distinct from v_version or v_row.replayed then raise exception 'activation version failed'; end if;
 if public.get_character_active_build_v4(v_user,v_character)->>'support_action_id' is distinct from 'basic.recover.mp' then raise exception 'activation did not restore support'; end if;
 select * into v_row from public.activate_character_build_loadout_v1(v_user,v_character,1::smallint,v_version-1,v_key,'support:activate');
 if not v_row.replayed or v_row.build_version is distinct from v_version then raise exception 'activation replay failed'; end if;
end;
\$test\$;
reset role;
do \$test\$
begin
 if exists (
   select 1 from (values ('anon'),('authenticated')) forbidden(role_name)
   cross join (values
     ('public.save_character_support_action_v1(uuid,uuid,bigint,text,uuid,text)'),
     ('public.get_character_active_build_v4(uuid,uuid)'),
     ('public.get_character_saved_build_loadouts_v2(uuid,uuid)')
   ) rpc(signature)
   where has_function_privilege(forbidden.role_name,rpc.signature,'execute')
 ) then raise exception 'support RPC privilege leak'; end if;
 if exists (
   select 1 from (values ('anon'),('authenticated')) forbidden(role_name)
   cross join (values
     ('app_private.character_support_action_idempotency'),
     ('app_private.character_support_action_change_audit')
   ) private_table(table_name)
   where has_table_privilege(forbidden.role_name,private_table.table_name,'SELECT,INSERT,UPDATE,DELETE')
 ) then raise exception 'support private table privilege leak'; end if;
 begin
   update app_private.character_active_builds set support_action_id='basic.attack' where character_id='$character_id';
   raise exception 'invalid persisted choice allowed';
 exception when check_violation then null; end;
end;
\$test\$;
rollback;
SQL
printf 'Support Action ownership, defaults, idempotency, versions, snapshots, loadouts and privileges passed.\n'

# Race two independent writers against the same version. The row lock must admit exactly
# one mutation and reject the other as stale; retrying its intent must preserve both fields.
race_dir="$(mktemp -d)"
trap 'rm -rf "$race_dir"' EXIT
support_sql="set role service_role; select * from public.save_character_support_action_v1('$user_id','$character_id',1,'basic.recover',gen_random_uuid(),'support:race');"
skills_sql="set role service_role; select * from public.save_character_discipline_skill_loadout_v1('$user_id','$character_id',1,jsonb_build_array((select jsonb_build_object('skillId',skill_id,'contentVersion',skill_content_version,'sourceDisciplineId',source_discipline_id) from public.get_character_learned_skills_v1('$user_id','$character_id') where skill_id='vanguard.forceful-strike')),gen_random_uuid(),'skills:race');"
run_race_save() {
  local label="$1" sql="$2" result=0
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "$sql" >"$race_dir/$label" 2>&1 || result=$?
  printf '%s' "$result" >"$race_dir/$label.status"
}
run_race_save support "$support_sql" &
support_pid=$!
run_race_save skills "$skills_sql" &
skills_pid=$!
wait "$support_pid"
wait "$skills_pid"
if [ "$(cat "$race_dir/support.status")" = 0 ]; then
  test "$(cat "$race_dir/skills.status")" != 0
  grep -Fq 'CHARACTER_BUILD_VERSION_CONFLICT' "$race_dir/skills"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "${skills_sql/,1,/,2,}" >/dev/null
else
  test "$(cat "$race_dir/skills.status")" = 0
  grep -Fq 'CHARACTER_BUILD_VERSION_CONFLICT' "$race_dir/support"
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "${support_sql/,1,/,2,}" >/dev/null
fi
final="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
 set role service_role;
 select (snapshot->>'buildVersion') || '|' || (snapshot->>'supportActionId') || '|' || (snapshot->'disciplineSkills'->0->>'skillId')
 from (select public.get_character_committed_build_snapshot_v2('$user_id','$character_id') snapshot) current;")"
test "$final" = '3|basic.recover|vanguard.forceful-strike'
printf 'Concurrent Support Action and Discipline Skill saves preserved both intents.\n'
