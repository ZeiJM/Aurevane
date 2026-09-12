#!/usr/bin/env bash
set -euo pipefail
source .github/scripts/auth-test-helpers.sh
load_test_auth
password='P4-Publication-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
email="p4-publication-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
signup="$(signup_test_user "$email" "$password")"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$user_id"
test "$user_id" != 'null'
confirm_test_user "$user_id"
for caller in anon authenticated; do
  if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "set role $caller; select public.activate_phase4_combat_interactions_v2();" > /tmp/p4-publication-denial.log 2>&1; then
    echo 'Browser publication unexpectedly succeeded.' >&2
    exit 1
  fi
  grep -Fq 'permission denied for function activate_phase4_combat_interactions_v2' /tmp/p4-publication-denial.log
done
# All publication and battle fixtures are local and transactionally rolled back.
docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -v user_id="$user_id" -U postgres -d postgres <<'SQL'
begin;
select set_config('p4.publication_user', :'user_id', true);
do $$
declare
 u uuid := current_setting('p4.publication_user')::uuid;
 c uuid;
 future_character uuid;
 b uuid := gen_random_uuid();
 v_before bigint;
 v_after bigint;
 receipt jsonb;
 repeated jsonb;
 frozen jsonb;
 saved jsonb;
 snapshot jsonb;
 audit_count integer;
 old_skills jsonb := '[{"skillId":"shadehand.smoke-vial","contentVersion":1,"sourceDisciplineId":"shadehand"},{"skillId":"shadehand.backstab","contentVersion":1,"sourceDisciplineId":"shadehand"}]';
begin
 assert (select activated_at is null from app_private.phase4_combat_publication), 'Migration must only prepare';
 assert (select count(*) from app_private.phase4_combat_skill_versions) = 20, 'Exact release manifest';
 assert (select count(*) from app_private.phase4_skill_catalog c join app_private.phase4_combat_skill_versions r using(skill_id) where c.content_version = r.previous_version) = 20, 'Pre-activation catalog remains historical';
 assert not has_table_privilege('service_role','app_private.phase4_combat_skill_versions','UPDATE'), 'Release list is not mutable by service API';

 select id into c from public.create_character_v3(u,0::smallint,gen_random_uuid(),'p4:publication:character',1,'P4 Publication','p4publication','androgynous','they_them','portrait.starter.wayfarer-01','appearance.starter.roadworn','shadehand',4,10,5,8,4,5);
 assert (select skill_content_version = 1 from app_private.character_skill_unlocks where character_id=c and skill_id='shadehand.smoke-vial'), 'Pre-activation new character gets v1';
 select build_version into v_before from app_private.character_active_builds where character_id=c;
 perform public.save_character_discipline_skill_loadout_v1(u,c,v_before,old_skills,gen_random_uuid(),'p4:publication:old-selection');
 select build_version into v_before from app_private.character_active_builds where character_id=c;
 perform public.save_character_build_loadout_v1(u,c,1::smallint,'Historical Shadehand',v_before,gen_random_uuid(),'p4:publication:saved');
 select to_jsonb(loadout) into saved from app_private.character_saved_build_loadouts loadout where character_id=c and slot_index=1;
 snapshot := public.get_character_committed_build_snapshot_v2(u,c);
 assert snapshot #>> '{disciplineSkills,0,contentVersion}' = '1', 'Old committed version';
 -- A persisted historical battle fixture survives the real activation transaction byte-for-byte.
 frozen := jsonb_build_object('tactical', jsonb_build_object('battle', jsonb_build_object('battleId','test:p4-publication:'||b,'rulesVersion',1,'contentVersion',1,'lifecycle','active','rng',jsonb_build_object('seed',42,'cursor',0),'combatants',jsonb_build_array(jsonb_build_object('id','character:'||c,'teamId','players','hp',100),jsonb_build_object('id','recruit:publication','teamId','opponents','hp',100)))), 'committedBuild', snapshot);
 insert into app_private.battle_sessions(id,owner_user_id,battle_id,rules_version,content_version,current_version,lifecycle,current_snapshot) values(b,u,'test:p4-publication:'||b,1,1,1,'active',frozen);
 insert into app_private.battle_snapshots(battle_session_id,battle_version,snapshot) values(b,1,frozen);

 -- Exercise the exact public activation interface with its real caller grant.
 set local role service_role;
 receipt := public.activate_phase4_combat_interactions_v2();
 repeated := public.activate_phase4_combat_interactions_v2();
 reset role;
 assert receipt ->> 'replayed' = 'false' and repeated ->> 'replayed' = 'true', 'Idempotent receipt';
 assert (receipt - 'replayed') = (repeated - 'replayed'), 'Stable original receipt';
 assert (select count(*) from app_private.phase4_skill_catalog c join app_private.phase4_combat_skill_versions r using(skill_id) where c.content_version = r.content_version) = 20, 'Exactly all release versions activated';
 assert (select count(*) from app_private.phase4_skill_catalog) = 136, 'No ninth Skill';
 assert (select skill_content_version = 2 from app_private.character_skill_unlocks where character_id=c and skill_id='shadehand.smoke-vial'), 'Learned version upgraded';
 assert (select skill_content_version = 2 from app_private.character_build_discipline_skills where character_id=c and skill_id='shadehand.smoke-vial'), 'Selected version upgraded';
 assert (select skill_content_version = 1 from app_private.character_build_discipline_skills where character_id=c and skill_id='shadehand.backstab'), 'Unaffected selection retained';
 select build_version into v_after from app_private.character_active_builds where character_id=c;
 assert v_after = v_before + 1, 'Exactly one build increment';
 select count(*) into audit_count from app_private.character_skill_loadout_change_audit where character_id=c and request_fingerprint='publication:phase4-combat-interactions-v2' and build_version_before=v_before and build_version_after=v_after and before_skills=old_skills and after_skills #>> '{0,contentVersion}'='2';
 assert audit_count=1, 'Exactly one complete loadout audit';
 assert (select current_snapshot=frozen from app_private.battle_sessions where id=b), 'Active battle unchanged';
 assert (select historical.snapshot=frozen from app_private.battle_snapshots historical where battle_session_id=b and battle_version=1), 'Historical snapshot unchanged';
 assert (select to_jsonb(loadout)=saved from app_private.character_saved_build_loadouts loadout where character_id=c and slot_index=1), 'Saved history unchanged';
 snapshot := public.get_character_committed_build_snapshot_v2(u,c);
 assert snapshot #>> '{disciplineSkills,0,contentVersion}' = '2', 'Future battle receives v2';

 -- Clear the current selection, then actually activate historical saved v1 references.
 perform public.save_character_discipline_skill_loadout_v1(u,c,v_after,'[]'::jsonb,gen_random_uuid(),'p4:publication:clear');
 select build_version into v_after from app_private.character_active_builds where character_id=c;
 perform public.activate_character_build_loadout_v1(u,c,1::smallint,v_after,gen_random_uuid(),'p4:publication:restore');
 assert (select skill_content_version=2 from app_private.character_build_discipline_skills where character_id=c and skill_id='shadehand.smoke-vial'), 'Saved activation resolves current version';
 assert (select to_jsonb(loadout)=saved from app_private.character_saved_build_loadouts loadout where character_id=c and slot_index=1), 'Saved source remains immutable';
 select id into future_character from public.create_character_v3(u,1::smallint,gen_random_uuid(),'p4:publication:future',1,'P4 Future','p4future','androgynous','they_them','portrait.starter.wayfarer-01','appearance.starter.roadworn','ironfist',13,4,5,8,2,4);
 assert (select skill_content_version=2 from app_private.character_skill_unlocks where character_id=future_character and skill_id='ironfist.breakfall'), 'Future provisioning uses v2';
 perform app_private.provision_mastery_skills_v1(future_character);
 assert (select count(*) from app_private.character_skill_unlocks where character_id=future_character)=8, 'Repeated provisioning stays unique';
end;
$$;
rollback;
SQL
bash .github/scripts/verify-p4-combat-publication-concurrency.sh "$db_container" "$user_id"
echo 'Phase 4 staged publication, caller denial, activation replay, selected/saved builds, future provisioning and frozen snapshots PASS.'
