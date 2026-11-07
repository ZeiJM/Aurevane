-- Canonical migrations, trip service and real spatial presence query.
begin;
set local plpgsql.check_asserts = on;
create or replace function app_private.world_ferry_now_v1() returns bigint
language sql volatile set search_path = '' as $$ select 1799999700000::bigint $$;

insert into auth.users(id) values
  ('85000000-0000-4000-8000-000000000001'),
  ('85000000-0000-4000-8000-000000000002'),
  ('85000000-0000-4000-8000-000000000003');
insert into public.player_profiles(user_id)
  select id from auth.users where id in (
    '85000000-0000-4000-8000-000000000001',
    '85000000-0000-4000-8000-000000000002',
    '85000000-0000-4000-8000-000000000003'
  ) on conflict do nothing;

insert into public.characters(
  id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,
  portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,
  level,xp,progression_cycle,created_at,cycle_started_at,last_active_at
)
select actor.character_id,actor.user_id,0,1,actor.name,lower(actor.name),'presentation.test','pronoun.they',
  'portrait.adventure.male-01','appearance.test',definition.discipline_id,
  (profile.core_base_attributes->>'might')::integer+1,
  (profile.core_base_attributes->>'finesse')::integer+1,
  (profile.core_base_attributes->>'vitality')::integer+1,
  (profile.core_base_attributes->>'agility')::integer+1,
  (profile.core_base_attributes->>'intellect')::integer+1,
  (profile.core_base_attributes->>'resolve')::integer,
  1,0,1,clock_timestamp(),clock_timestamp(),clock_timestamp()
from (values
  ('85000000-0000-4000-8000-000000000011'::uuid,'85000000-0000-4000-8000-000000000001'::uuid,'Ferry Captain'),
  ('85000000-0000-4000-8000-000000000012'::uuid,'85000000-0000-4000-8000-000000000002'::uuid,'Ferry Companion'),
  ('85000000-0000-4000-8000-000000000013'::uuid,'85000000-0000-4000-8000-000000000003'::uuid,'Ferry Observer')
) actor(character_id,user_id,name)
cross join (
  select d.discipline_id,d.primary_profile_version
  from app_private.discipline_definitions d where d.enabled_for_primary
  order by d.discipline_id,d.definition_version desc limit 1
) definition
join app_private.discipline_primary_profiles profile on profile.discipline_id=definition.discipline_id
  and profile.profile_version=definition.primary_profile_version;

insert into app_private.character_world_state(character_id,state,last_seen_at)
select c.id,'{"version":1,"position":{"sectorId":"atlas:126:32","x":6,"y":4},"safe":true,"route":[],"nextStepAt":null,"discoveries":{},"completedObjectives":[]}'::jsonb,clock_timestamp()
from public.characters c where c.id in (
  '85000000-0000-4000-8000-000000000011',
  '85000000-0000-4000-8000-000000000012',
  '85000000-0000-4000-8000-000000000013'
);

do $$
declare
  captain uuid := '85000000-0000-4000-8000-000000000001';
  captain_character uuid := '85000000-0000-4000-8000-000000000011';
  companion uuid := '85000000-0000-4000-8000-000000000002';
  companion_character uuid := '85000000-0000-4000-8000-000000000012';
  observer uuid := '85000000-0000-4000-8000-000000000003';
  observer_character uuid := '85000000-0000-4000-8000-000000000013';
  deck text := 'ferry:outbound:1800000000000';
  dock jsonb := '{"sectorId":"atlas:126:32","x":6,"y":4}';
  captain_state jsonb;
  companion_state jsonb;
  payload jsonb;
begin
  captain_state := public.commit_world_ferry_v1(captain,captain_character,1,gen_random_uuid(),'board-ferry','captain');
  companion_state := public.commit_world_ferry_v1(companion,companion_character,1,gen_random_uuid(),'board-ferry','companion');
  assert captain_state->'position' = companion_state->'position';
  assert captain_state#>>'{position,sectorId}' = deck;
  payload := public.read_world_scene_players_v2(captain,captain_character,2,array[deck],dock);
  assert jsonb_array_length(payload->'players') = 1;
  assert payload#>>'{players,0,characterId}' = companion_character::text;
  assert payload#>>'{players,0,position,sectorId}' = deck;
  payload := public.read_world_live_players_v1(captain,captain_character,2);
  assert payload->>'registered' = 'true';
  assert payload#>>'{players,0,characterId}' = companion_character::text;
  payload := public.read_world_scene_players_v2(observer,observer_character,1,array['atlas:126:32'],dock);
  assert jsonb_array_length(payload->'players') = 0;
end;
$$;
rollback;
