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
create function pg_temp.make_p4_trial(u uuid,c uuid,body jsonb,copy_events_from uuid default null)
returns uuid language plpgsql as $$
declare
 id uuid:=gen_random_uuid();
 head jsonb;
 initial jsonb;
begin
 head:=jsonb_set(body,'{tactical,battle}',(body #> '{tactical,battle}') || jsonb_build_object('battleId','test:p4:'||id,'rulesVersion',1,'contentVersion',1,'lifecycle','completed','rng',jsonb_build_object('seed',42,'cursor',0)));
 initial:=jsonb_set(head,'{tactical,battle,lifecycle}','"active"');
 insert into app_private.battle_sessions(id,owner_user_id,battle_id,rules_version,content_version,current_version,lifecycle,current_snapshot) values(id,u,'test:p4:'||id,1,1,2,'completed',head);
 insert into app_private.battle_participants(battle_session_id,combatant_id,participant_role,user_id,character_id) values(id,'character:'||c,'player',u,c);
 insert into app_private.battle_snapshots(battle_session_id,battle_version,snapshot) values(id,1,initial),(id,2,head);
 if copy_events_from is not null then
  insert into app_private.battle_events(battle_session_id,battle_version,event_index,event) select id,battle_version,event_index,event from app_private.battle_events where battle_session_id=copy_events_from;
 end if;
 return id;
end;
$$;
do $$
declare
 u uuid:=current_setting('p4.test_user')::uuid;
 c uuid:=current_setting('p4.test_character')::uuid;
 b uuid:=gen_random_uuid();
 snapshot jsonb;
 result record;
 failed boolean:=false;
begin
 -- Remove only this disposable fixture's pre-existing Owner-authorized testing grants.
 -- Production testing access is preserved; this transaction rolls back.
 delete from app_private.character_discipline_masteries where character_id=c;
 update app_private.character_discipline_progress set mastery_xp=0,demonstrated_skills='{}' where character_id=c;
 if app_private.discipline_unlocked_v1(c,'chronist') then raise exception 'Chronist unlocked without Aetherist Adept'; end if;
 if app_private.discipline_unlocked_v1(c,'bastion') then raise exception 'Bastion unlocked without Vanguard Adept'; end if;
 begin
  perform public.change_character_disciplines_v3(u,c,1,true,'bastion',false,null,gen_random_uuid(),'p4:locked-bastion');
 exception when sqlstate '22023' then failed:=true;
 end;
 if not failed then raise exception 'Advanced prerequisite bypass succeeded'; end if;
 if has_function_privilege('authenticated','public.claim_discipline_trial_v1(uuid,uuid)','execute') or has_function_privilege('anon','public.claim_discipline_trial_v1(uuid,uuid)','execute') or has_table_privilege('authenticated','app_private.character_discipline_progress','update') then raise exception 'Browser role has reward authority'; end if;
 snapshot:=jsonb_build_object('tactical',jsonb_build_object('battle',jsonb_build_object('combatants',jsonb_build_array(jsonb_build_object('id','character:'||c,'teamId','players','hp',10),jsonb_build_object('id','recruit','teamId','opponents','hp',0)))),'statBridge',jsonb_build_object('combatants',jsonb_build_array(jsonb_build_object('provenance',jsonb_build_object('kind','scenario','sourceId','scenario:p2-7-recruit:crossroads-court:mastery-trial:standard')))),'buildAuthority',jsonb_build_object('combatants',jsonb_build_array(jsonb_build_object('combatantId','character:'||c,'primary',jsonb_build_object('disciplineId','vanguard')))));

 b:=pg_temp.make_p4_trial(u,c,snapshot,null);
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

 practice_id:=pg_temp.make_p4_trial(u,c,practice_snapshot,null);
  failed:=false;
  begin perform public.claim_discipline_trial_v1(u,practice_id); exception when sqlstate '22023' then failed:=sqlerrm='MASTERY_TRIAL_REQUIRED'; end;
  if not failed then raise exception 'Sparring did not reject Mastery'; end if;
 end;
 -- Ownership, defeat and timeout must never produce a reward.
 failed:=false;
 begin perform public.claim_discipline_trial_v1(gen_random_uuid(),b); exception when insufficient_privilege then failed:=true; end;
 if not failed then raise exception 'Foreign account claimed mastery'; end if;
 declare
  rejected_id uuid;
  rejected_snapshot jsonb;
  scenario text;
 begin
  foreach scenario in array array['defeat','ai_turn_timed_out','pvp_turn_timed_out'] loop
   rejected_id:=gen_random_uuid();
   rejected_snapshot:=case when scenario='defeat' then jsonb_set(snapshot,'{tactical,battle,combatants,0,hp}','0') else snapshot end;

 rejected_id:=pg_temp.make_p4_trial(u,c,rejected_snapshot,b);
   if scenario<>'defeat' then insert into app_private.battle_events(battle_session_id,battle_version,event_index,event) values(rejected_id,2,3,jsonb_build_object('event',scenario,'combatantId','character:'||c)); end if;
   failed:=false;
   begin perform public.claim_discipline_trial_v1(u,rejected_id); exception when sqlstate '22023' then failed:=sqlerrm=case when scenario='defeat' then 'TRIAL_VICTORY_REQUIRED' else 'TRIAL_TIMEOUT_DISQUALIFIED' end; end;
   if not failed or exists(select 1 from app_private.discipline_trial_claims where battle_session_id=rejected_id) then raise exception 'Defeat/timeout awarded mastery: %',scenario; end if;
  end loop;
 end;
 update app_private.character_discipline_progress set mastery_xp=250 where character_id=c and discipline_id='vanguard';
 select * into result from public.claim_discipline_trial_v1(u,b);
 if result.awarded_xp<>50 or result.mastery_xp<>300 or result.stage<>3 or result.replayed then raise exception 'Incorrect qualifying mastery award'; end if;
 select * into result from public.claim_discipline_trial_v1(u,b);
 if not result.replayed or result.mastery_xp<>300 then raise exception 'Claim retry was not idempotent'; end if;
 if (select mastery_xp from app_private.character_discipline_progress where character_id=c and discipline_id='vanguard')<>300 then raise exception 'Retry awarded duplicate XP'; end if;
 if not app_private.discipline_unlocked_v1(c,'bastion') then raise exception 'Adept did not unlock Bastion'; end if;
 -- XP alone cannot grant Master before all eight regular Skills are demonstrated.
 declare
  cap_trial uuid;
  pass integer;
 begin
  update app_private.character_discipline_progress set mastery_xp=950 where character_id=c and discipline_id='vanguard';
  for pass in 1..2 loop
   cap_trial:=gen_random_uuid();
   if pass=2 then update app_private.character_discipline_progress set demonstrated_skills=(select array_agg(skill_id) from app_private.phase4_skill_catalog where discipline_id='vanguard') where character_id=c and discipline_id='vanguard'; end if;

 cap_trial:=pg_temp.make_p4_trial(u,c,snapshot,b);
   select * into result from public.claim_discipline_trial_v1(u,cap_trial);
   if pass=1 and (result.mastery_xp<>999 or result.stage<>4 or result.awarded_xp<>49 or exists(select 1 from app_private.character_discipline_masteries where character_id=c and discipline_id='vanguard')) then raise exception 'Master granted without full Skill demonstration'; end if;
   if pass=2 and (result.mastery_xp<>1000 or result.stage<>5 or result.awarded_xp<>1 or not exists(select 1 from app_private.character_discipline_masteries where character_id=c and discipline_id='vanguard' and source_kind='gameplay')) then raise exception 'Full demonstration did not grant gameplay Mastery'; end if;
  end loop;
  -- Reset this fixture only to exercise a later pre-existing grant with lagging XP below.
  update app_private.character_discipline_progress set mastery_xp=300 where character_id=c and discipline_id='vanguard';
 end;
 -- A later system/Owner mastery fact must not turn the next capped trial into a 1,000-XP award.
 declare
  mastered_trial uuid:=gen_random_uuid();
 begin
  perform public.record_character_discipline_mastery_v1(c,'vanguard','gameplay','ci:existing-mastery');

 mastered_trial:=pg_temp.make_p4_trial(u,c,snapshot,b);
  select * into result from public.claim_discipline_trial_v1(u,mastered_trial);
  if result.awarded_xp<>0 or result.mastery_xp<>1000 then raise exception 'Existing mastery exceeded the trial reward cap'; end if;
 end;
 perform public.change_character_disciplines_v3(u,c,1,true,'bastion',false,null,gen_random_uuid(),'p4:earned-bastion');
 if (select count(*) from app_private.character_skill_unlocks where character_id=c and source_discipline_id='bastion')<>4 then raise exception 'Bastion Initiate must learn four Skills'; end if;
 update app_private.character_discipline_progress set mastery_xp=300 where character_id=c and discipline_id='bastion';
 perform app_private.provision_mastery_skills_v1(c);
 if (select count(*) from app_private.character_skill_unlocks where character_id=c and source_discipline_id='bastion')<>8 then raise exception 'Bastion Adept must learn all eight Skills'; end if;
 insert into app_private.character_discipline_progress(character_id,discipline_id,mastery_xp) values(c,'aetherist',300) on conflict(character_id,discipline_id) do update set mastery_xp=300;
 if not app_private.discipline_unlocked_v1(c,'chronist') then raise exception 'Aetherist Adept did not unlock Chronist'; end if;
 delete from app_private.character_skill_unlocks where character_id=c and source_discipline_id='chronist';
 insert into app_private.character_discipline_progress(character_id,discipline_id,mastery_xp) values(c,'chronist',0) on conflict(character_id,discipline_id) do update set mastery_xp=0;
 perform public.change_character_disciplines_v3(u,c,2,true,'chronist',false,null,gen_random_uuid(),'p4:earned-chronist');
 perform app_private.provision_mastery_skills_v1(c);
 if (select count(*) from app_private.character_skill_unlocks where character_id=c and source_discipline_id='chronist')<>4 then raise exception 'Chronist Initiate must learn four Skills'; end if;
 update app_private.character_discipline_progress set mastery_xp=100 where character_id=c and discipline_id='chronist';
 perform app_private.provision_mastery_skills_v1(c);
 if (select count(*) from app_private.character_skill_unlocks where character_id=c and source_discipline_id='chronist')<>6 then raise exception 'Chronist Apprentice must learn six Skills'; end if;
 update app_private.character_discipline_progress set mastery_xp=300 where character_id=c and discipline_id='chronist';
 perform app_private.provision_mastery_skills_v1(c);
 if (select count(*) from app_private.character_skill_unlocks where character_id=c and source_discipline_id='chronist')<>8 then raise exception 'Chronist Adept must learn eight Skills'; end if;
 if (select count(*) from app_private.resonance_definitions where enabled and (discipline_a_id='chronist' or discipline_b_id='chronist'))<>16 then raise exception 'Chronist requires sixteen Resonance pairs'; end if;

end;
$$;
rollback;
SQL
echo 'Phase 4 Mastery prerequisites, persisted-event rewards, retries, milestones and browser denial PASS.'
