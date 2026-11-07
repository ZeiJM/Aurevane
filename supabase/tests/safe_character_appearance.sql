-- Run with psql -v ON_ERROR_STOP=1 -f on a disposable, fully migrated Supabase stack.
-- Exercises the exact production triggers and service-only RPCs; fixtures roll back.
begin;
set local plpgsql.check_asserts = on;
insert into auth.users(id) values ('84000000-0000-4000-8000-000000000001');
insert into public.player_profiles(user_id) values ('84000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.characters(
  id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,
  portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,
  level,xp,progression_cycle,created_at,cycle_started_at,last_active_at
)
select '84000000-0000-4000-8000-000000000011'::uuid,'84000000-0000-4000-8000-000000000001'::uuid,0,1,
  'Look Regression','look regression','presentation.test','pronoun.they',
  'portrait.adventure.male-01','appearance.test',definition.discipline_id,
  (profile.core_base_attributes->>'might')::integer+1,
  (profile.core_base_attributes->>'finesse')::integer+1,
  (profile.core_base_attributes->>'vitality')::integer+1,
  (profile.core_base_attributes->>'agility')::integer+1,
  (profile.core_base_attributes->>'intellect')::integer+1,
  (profile.core_base_attributes->>'resolve')::integer,
  1,0,1,clock_timestamp(),clock_timestamp(),clock_timestamp()
from (
  select distinct on (d.discipline_id) d.discipline_id,d.primary_profile_version
  from app_private.discipline_definitions d where d.enabled_for_primary
  order by d.discipline_id,d.definition_version desc limit 1
) definition
join app_private.discipline_primary_profiles profile on profile.discipline_id=definition.discipline_id and profile.profile_version=definition.primary_profile_version;

do $$
declare
  v_user uuid := '84000000-0000-4000-8000-000000000001';
  v_character uuid := '84000000-0000-4000-8000-000000000011';
  v_battle uuid := '84000000-0000-4000-8000-000000000021';
  v_first text := '/api/media/appearance/1/slight.tan.braid.copper.tunic.open.split.lacing.pointed.linen.satchel.pine/neutral.svg';
  v_next text := '/api/media/appearance/2/broad.deep.crop.onyx.cuirass.fur.close.clasps.split.quilt.brooch.indigo.greaves/neutral.svg';
  v_receipt jsonb;
  v_snapshot jsonb;
begin
  assert app_private.valid_npc_appearance_v1(to_jsonb(v_next)), 'NPC contract accepts a compatible new recipe';
  assert not app_private.valid_npc_appearance_v1(to_jsonb(replace(v_next,'.cuirass.','.greatcloak.'))), 'NPC rejects a lower layer hidden by its top';
  begin
    perform public.commit_character_appearance_v2(v_user,v_character,0,replace(v_next,'.greaves/','.original/'));
    raise exception 'alias for original v1 look accepted';
  exception when sqlstate '22023' then null;
  end;
  v_receipt := public.commit_character_appearance_v2(v_user,v_character,0,v_first);
  assert v_receipt = jsonb_build_object('revision',1,'imageUrl',v_first,'pendingImageUrl',null), 'safe immediate activation';
  v_snapshot := '{"tactical":{"battle":{"battleId":"appearance-regression","rulesVersion":1,"contentVersion":1,"lifecycle":"active","combatants":[{},{}],"rng":{}}}}'::jsonb ||
    jsonb_build_object('buildAuthority',jsonb_build_object('combatants',jsonb_build_array(
      public.get_character_committed_build_snapshot_v2(v_user,v_character) ||
      jsonb_build_object('combatantId','appearance-regression','characterId',v_character)
    )));
  insert into app_private.battle_sessions(
    id,owner_user_id,battle_id,rules_version,content_version,lifecycle,current_snapshot
  ) values (v_battle,v_user,'appearance-regression',1,1,'active',v_snapshot);
  insert into app_private.battle_participants(
    battle_session_id,combatant_id,participant_role,user_id,character_id
  ) values (v_battle,'appearance-regression','player',v_user,v_character);
  v_receipt := public.commit_character_appearance_v2(v_user,v_character,1,v_next);
  assert v_receipt = jsonb_build_object('revision',2,'imageUrl',v_first,'pendingImageUrl',v_next), 'battle queues new appearance';
  assert public.commit_character_appearance_v2(v_user,v_character,1,v_next) = v_receipt, 'identical retry is idempotent';

  update public.character_profile_display set image_url='https://example.test/legacy.png' where character_id=v_character;
  perform public.set_character_default_portrait_v1(v_user,v_character,'portrait.adventure.female-12');
  assert (select image_url is null and appearance_revision=2 and appearance_image_url=v_first and pending_appearance_image_url=v_next
    from public.character_profile_display where character_id=v_character), 'legacy portrait settings preserve active and pending looks';
  update app_private.battle_sessions set lifecycle='completed',
    current_snapshot=jsonb_set(current_snapshot,'{tactical,battle,lifecycle}','"completed"')
    where id=v_battle;
  assert (select appearance_revision=3 and appearance_image_url=v_next and pending_appearance_image_url is null
    from public.character_profile_display where character_id=v_character), 'safe exit activates the queued appearance';
  assert (select image_url=v_first from public.get_battle_character_appearances_v1(v_battle)
    where character_id=v_character), 'completed battle keeps its original pin';
  begin
    perform public.commit_character_appearance_v2(v_user,v_character,1,v_first);
    raise exception 'stale look accepted';
  exception when sqlstate 'PT409' then null;
  end;
  assert not has_function_privilege('authenticated','public.commit_character_appearance_v2(uuid,uuid,integer,text)','execute'), 'browser cannot mutate appearance';
  assert not has_function_privilege('authenticated','public.get_battle_character_appearances_v1(uuid)','execute'), 'browser cannot enumerate pins';
end;
$$;
rollback;
