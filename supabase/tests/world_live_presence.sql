-- Run against a disposable, fully migrated Supabase stack:
-- pnpm exec supabase test db --local supabase/tests/world_live_presence.sql
-- Native two-player Broadcast delivery is exercised separately by the World browser suite.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(31);

select has_function('public', 'read_world_scene_players_v2', array['uuid','uuid','bigint','text[]','jsonb'], 'service scene v2 exists');
select has_function('public', 'read_world_live_players_v1', array['uuid','uuid','bigint'], 'live reader accepts no scene IDs');
select ok(has_function_privilege('service_role','public.read_world_scene_players_v2(uuid,uuid,bigint,text[],jsonb)','execute'), 'service role can register scenes');
select ok(not has_function_privilege('authenticated','public.read_world_scene_players_v2(uuid,uuid,bigint,text[],jsonb)','execute'), 'browser cannot widen registration');
select ok(not has_function_privilege('authenticated','public.read_world_live_players_v1(uuid,uuid,bigint)','execute'), 'browser cannot bypass authenticated server reader');
select ok(not has_table_privilege('authenticated','app_private.world_scene_subscriptions','select,insert,update,delete'), 'registry has no browser table grants');
select ok(has_function_privilege('authenticated','public.can_receive_world_scene_v1(text)','execute') and not has_function_privilege('anon','public.can_receive_world_scene_v1(text)','execute'), 'only authenticated receive checks are narrowly granted');
select ok((select relrowsecurity from pg_class where oid='app_private.world_scene_subscriptions'::regclass), 'private registry uses RLS');
select is((select count(*)::integer from pg_policies where schemaname='realtime' and tablename='messages' and cmd in ('INSERT','ALL') and ('authenticated'=any(roles) or 'public'=any(roles))), 0, 'no policy allows browser Broadcast publishing');
select ok(exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname='world_scene_receive_v1' and cmd='SELECT'), 'native realtime messages have the receive policy');
select ok(exists(select 1 from pg_trigger where tgrelid='app_private.character_world_state'::regclass and tgname='world_scene_changed_v1' and not tgisinternal), 'version-change trigger is installed on authoritative state');
select ok(to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null, 'native private Broadcast sender exists');

insert into auth.users(id) values('81000000-0000-4000-8000-000000000001'),('81000000-0000-4000-8000-000000000002');
insert into public.player_profiles(user_id) values('81000000-0000-4000-8000-000000000001'),('81000000-0000-4000-8000-000000000002') on conflict do nothing;
-- Use a current enabled primary profile so the real character provisioning triggers run.
insert into public.characters(
  id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,
  portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,
  level,xp,progression_cycle,created_at,cycle_started_at,last_active_at
)
select actor.character_id,actor.user_id,0,1,actor.label,lower(actor.label),'presentation.world-test','pronoun.they',
  'portrait.world-test','appearance.world-test',definition.discipline_id,
  (profile.core_base_attributes->>'might')::integer+1,
  (profile.core_base_attributes->>'finesse')::integer+1,
  (profile.core_base_attributes->>'vitality')::integer+1,
  (profile.core_base_attributes->>'agility')::integer+1,
  (profile.core_base_attributes->>'intellect')::integer+1,
  (profile.core_base_attributes->>'resolve')::integer,
  1,0,1,clock_timestamp(),clock_timestamp(),clock_timestamp()
from (values
  ('81000000-0000-4000-8000-000000000011'::uuid,'81000000-0000-4000-8000-000000000001'::uuid,'World Presence Owner'),
  ('81000000-0000-4000-8000-000000000012'::uuid,'81000000-0000-4000-8000-000000000002'::uuid,'World Presence Peer')
) actor(character_id,user_id,label)
cross join lateral (
  select distinct on (d.discipline_id) d.discipline_id,d.primary_profile_version
  from app_private.discipline_definitions d where d.enabled_for_primary
  order by d.discipline_id,d.definition_version desc limit 1
) definition
join app_private.discipline_primary_profiles profile on profile.discipline_id=definition.discipline_id and profile.profile_version=definition.primary_profile_version;
insert into app_private.character_world_state(character_id,state)
select id,'{"version":1,"position":{"sectorId":"verdant-expanse","x":5,"y":4},"safe":true,"route":[],"nextStepAt":null,"discoveries":{},"completedObjectives":[]}'::jsonb
from public.characters where id in ('81000000-0000-4000-8000-000000000011','81000000-0000-4000-8000-000000000012');
create temporary table world_presence_receipt as
select public.read_world_scene_players_v2(
  '81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011',1,
  array['verdant-expanse'],'{"sectorId":"verdant-expanse","x":5,"y":4}'::jsonb
) receipt;
select ok((select receipt->>'version'='1' and (receipt->>'serverNow')::bigint>0 from world_presence_receipt), 'scene receipt has matching version and database clock');
select ok((select expires_at>clock_timestamp()+interval '110 seconds' and expires_at<=clock_timestamp()+interval '120 seconds' from app_private.world_scene_subscriptions where character_id='81000000-0000-4000-8000-000000000011'), 'registration expires after two minutes');
select ok(exists(select 1 from world_presence_receipt r cross join lateral jsonb_array_elements(r.receipt->'players') p where p->>'characterId'='81000000-0000-4000-8000-000000000012' and p#>>'{movement,version}'='1' and p#>'{movement,route}'='[]'::jsonb), 'stopped peers retain a versioned empty movement receipt');
select ok((public.read_world_live_players_v1('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011',1)->>'registered')::boolean, 'live reader derives registered scene internally');
select ok(not (public.read_world_live_players_v1('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011',0)->>'registered')::boolean, 'stale versions cannot receive presence');
select throws_ok($$select public.read_world_scene_players_v2('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011',1,array(select 'scene-'||n from generate_series(1,26) n),'{}'::jsonb)$$, '22023','WORLD_INVALID_SCENE','registration cannot exceed 25 scenes');
select throws_ok($$select public.read_world_live_players_v1('81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000011',1)$$, '42501','WORLD_NOT_OWNED','other account cannot read owner state');

select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select ok(public.can_receive_world_scene_v1('world-scene:verdant-expanse'), 'native authenticated owner may receive registered topic');
select ok(not public.can_receive_world_scene_v1('world-scene:private-unregistered'), 'unregistered topics are denied');
select set_config('realtime.topic','world-scene:verdant-expanse',true);
select ok(has_table_privilege('authenticated','realtime.messages','INSERT'), 'native Broadcast table grant reaches its RLS boundary');
select throws_matching(
  $$insert into realtime.messages(topic,extension,payload,event,private) values('world-scene:verdant-expanse','broadcast','{}'::jsonb,'changed',true)$$,
  'row-level security policy',
  'registered receivers cannot publish Broadcast messages'
);
reset role;
update app_private.world_scene_subscriptions set expires_at=clock_timestamp()-interval '1 second' where character_id='81000000-0000-4000-8000-000000000011';
set local role authenticated;
select ok(not public.can_receive_world_scene_v1('world-scene:verdant-expanse'), 'expired registry denies new channel authorization');
reset role;
select ok(not (public.read_world_live_players_v1('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011',1)->>'registered')::boolean, 'expired live read fails closed without renewing');
update app_private.world_scene_subscriptions set expires_at=clock_timestamp()+interval '2 minutes' where character_id='81000000-0000-4000-8000-000000000011';
create temporary table world_presence_old_registration as
select ctid::text row,expires_at from app_private.world_scene_subscriptions where character_id='81000000-0000-4000-8000-000000000011';
-- A new owner version cannot silently reuse/renew the previous server-projected scene.
update app_private.character_world_state
set state=jsonb_set(jsonb_set(state,'{version}','2'::jsonb),'{position,sectorId}','"atlas:58:28"'::jsonb)
where character_id='81000000-0000-4000-8000-000000000011';
select ok((select receipt->>'version'='2' and not (receipt->>'registered')::boolean and receipt->'players'='[]'::jsonb and receipt->'sceneSectorIds'='[]'::jsonb from (select public.read_world_live_players_v1('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011',2) receipt) r), 'new owner version with old registration withholds old scene and peers');
select ok(exists(select 1 from app_private.world_scene_subscriptions s join world_presence_old_registration old on s.ctid::text=old.row and s.expires_at=old.expires_at where s.character_id='81000000-0000-4000-8000-000000000011'), 'rejected old registration is not renewed or rewritten');
set local role authenticated;
select ok(not public.can_receive_world_scene_v1('world-scene:verdant-expanse'), 'new joins cannot use an obsolete World version');
reset role;
select public.read_world_scene_players_v2('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011',2,array['atlas:58:28'],'{"sectorId":"verdant-expanse","x":5,"y":4}'::jsonb);
select ok((select (receipt->>'registered')::boolean and receipt->'sceneSectorIds'='["atlas:58:28"]'::jsonb from (select public.read_world_live_players_v1('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011',2) receipt) r), 'new service registration restores only the matching scene');
set local role authenticated;
select ok(public.can_receive_world_scene_v1('world-scene:atlas:58:28'), 'new matching registration restores receive authorization');
reset role;
insert into app_private.character_deletion_requests(character_id,user_id,requested_at,delete_after)
values('81000000-0000-4000-8000-000000000011','81000000-0000-4000-8000-000000000001',transaction_timestamp(),transaction_timestamp()+interval '24 hours');
set local role authenticated;
select ok(not public.can_receive_world_scene_v1('world-scene:atlas:58:28'), 'deleting character loses receive authorization');
reset role;
select * from finish();
rollback;
