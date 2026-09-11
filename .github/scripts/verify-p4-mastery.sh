#!/usr/bin/env bash
set -euo pipefail
source .github/scripts/auth-test-helpers.sh
load_test_auth
password='P4-Mastery-2026!'
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
email="p4-mastery-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
signup="$(signup_test_user "$email" "$password")"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
test -n "$user_id"
test "$user_id" != 'null'
confirm_test_user "$user_id"
character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
set role service_role;
select id::text from public.create_character_v3('$user_id'::uuid,0::smallint,'00000000-0000-4000-8000-000000004101'::uuid,'p4:mastery:character',1,'P4 Mastery Tester','p4masterytester','androgynous','they_them','portrait.starter.wayfarer-01','appearance.starter.roadworn','vanguard',12,4,7,4,3,6);")"
test -n "$character_id"
# Private committed-event fixtures exercise the database reward authority. They are
# isolated in CI and rolled back; they are not human gameplay evidence.
docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -v user_id="$user_id" -v character_id="$character_id" -U postgres -d postgres <<'SQL'
begin;
select set_config('p4.test_user', :'user_id', true),set_config('p4.test_character', :'character_id', true);
do $$
declare
 u uuid:=current_setting('p4.test_user')::uuid;
 c uuid:=current_setting('p4.test_character')::uuid;
 b uuid:=gen_random_uuid();
 snapshot jsonb;
 result record;
 failed boolean:=false;
begin
 if app_private.discipline_unlocked_v1(c,'bastion') then raise exception 'Bastion unlocked without Vanguard Adept'; end if;
 begin
  perform public.change_character_disciplines_v3(u,c,1,true,'bastion',false,null,gen_random_uuid(),'p4:locked-bastion');
 exception when sqlstate '22023' then failed:=true;
 end;
 if not failed then raise exception 'Advanced prerequisite bypass succeeded'; end if;
 if has_function_privilege('authenticated','public.claim_discipline_trial_v1(uuid,uuid)','execute') or has_function_privilege('anon','public.claim_discipline_trial_v1(uuid,uuid)','execute') or has_table_privilege('authenticated','app_private.character_discipline_progress','update') then raise exception 'Browser role has reward authority'; end if;
 snapshot:=jsonb_build_object('tactical',jsonb_build_object('battle',jsonb_build_object('combatants',jsonb_build_array(jsonb_build_object('id','character:'||c,'teamId','players','hp',10),jsonb_build_object('id','recruit','teamId','opponents','hp',0)))),'statBridge',jsonb_build_object('combatants',jsonb_build_array(jsonb_build_object('provenance',jsonb_build_object('kind','scenario','sourceId','scenario:p2-7-recruit:crossroads-court:mastery-trial:standard')))),'buildAuthority',jsonb_build_object('combatants',jsonb_build_array(jsonb_build_object('combatantId','character:'||c,'primary',jsonb_build_object('disciplineId','vanguard')))));
 insert into app_private.battle_sessions(id,owner_user_id,battle_id,rules_version,content_version,current_version,lifecycle,current_snapshot) values(b,u,'test:mastery:'||b,1,1,2,'completed',snapshot);
 insert into app_private.battle_participants(battle_session_id,combatant_id,participant_role,user_id,character_id) values(b,'character:'||c,'player',u,c);
 insert into app_private.battle_snapshots(battle_session_id,battle_version,snapshot) values(b,1,snapshot),(b,2,snapshot);
 failed:=false;
 begin perform public.claim_discipline_trial_v1(u,b); exception when sqlstate '22023' then failed:=true; end;
 if not failed then raise exception 'Empty event history awarded mastery'; end if;
 insert into app_private.battle_events(battle_session_id,battle_version,event_index,event) values
 (b,2,0,jsonb_build_object('event','combat_action_used','actorId','character:'||c,'actionId','vanguard.forceful-strike')),
 (b,2,1,jsonb_build_object('event','combat_action_used','actorId','character:'||c,'actionId','vanguard.brace')),
 (b,2,2,jsonb_build_object('event','combat_action_used','actorId','character:'||c,'actionId','vanguard.forceful-strike'));
 -- A practice source is rejected before event eligibility. Never rewrite a frozen snapshot.
 declare
  practice_id uuid:=gen_random_uuid();
  practice_snapshot jsonb:=jsonb_set(snapshot,'{statBridge,combatants,0,provenance,sourceId}','"scenario:p2-7-recruit:crossroads-court:recruit-sparring:standard"');
 begin
  insert into app_private.battle_sessions(id,owner_user_id,battle_id,rules_version,content_version,current_version,lifecycle,current_snapshot) values(practice_id,u,'test:practice:'||practice_id,1,1,1,'completed',practice_snapshot);
  insert into app_private.battle_participants(battle_session_id,combatant_id,participant_role,user_id,character_id) values(practice_id,'character:'||c,'player',u,c);
  insert into app_private.battle_snapshots(battle_session_id,battle_version,snapshot) values(practice_id,1,practice_snapshot);
  failed:=false;
  begin perform public.claim_discipline_trial_v1(u,practice_id); exception when sqlstate '22023' then failed:=sqlerrm='MASTERY_TRIAL_REQUIRED'; end;
  if not failed then raise exception 'Sparring did not reject Mastery'; end if;
 end;
 update app_private.character_discipline_progress set mastery_xp=250 where character_id=c and discipline_id='vanguard';
 select * into result from public.claim_discipline_trial_v1(u,b);
 if result.awarded_xp<>50 or result.mastery_xp<>300 or result.stage<>3 or result.replayed then raise exception 'Incorrect qualifying mastery award'; end if;
 select * into result from public.claim_discipline_trial_v1(u,b);
 if not result.replayed or result.mastery_xp<>300 then raise exception 'Claim retry was not idempotent'; end if;
 if (select mastery_xp from app_private.character_discipline_progress where character_id=c and discipline_id='vanguard')<>300 then raise exception 'Retry awarded duplicate XP'; end if;
 if not app_private.discipline_unlocked_v1(c,'bastion') then raise exception 'Adept did not unlock Bastion'; end if;
 perform public.change_character_disciplines_v3(u,c,1,true,'bastion',false,null,gen_random_uuid(),'p4:earned-bastion');
 if (select count(*) from app_private.character_skill_unlocks where character_id=c and source_discipline_id='bastion')<>4 then raise exception 'Bastion Initiate must learn four Skills'; end if;
 update app_private.character_discipline_progress set mastery_xp=300 where character_id=c and discipline_id='bastion';
 perform app_private.provision_mastery_skills_v1(c);
 if (select count(*) from app_private.character_skill_unlocks where character_id=c and source_discipline_id='bastion')<>8 then raise exception 'Bastion Adept must learn all eight Skills'; end if;
end;
$$;
rollback;
SQL
echo 'Phase 4 Mastery prerequisites, persisted-event rewards, retries, milestones and browser denial PASS.'
