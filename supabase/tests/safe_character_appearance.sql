-- Run with psql -v ON_ERROR_STOP=1 -f on a disposable, fully migrated Supabase stack.
-- Exercises the exact production triggers and service-only RPCs; fixtures roll back.
begin;
set local plpgsql.check_asserts = on;
insert into auth.users(id) values ('84000000-0000-4000-8000-000000000001');
insert into auth.users(id) values ('84000000-0000-4000-8000-000000000002');
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

insert into public.characters(
  id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,
  portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,
  level,xp,progression_cycle,created_at,cycle_started_at,last_active_at
)
select '84000000-0000-4000-8000-000000000012',user_id,1,rules_version,'Cuff Regression','cuff regression',
  presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,
  might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at
from public.characters where id='84000000-0000-4000-8000-000000000011';

do $$
declare
  v_user uuid := '84000000-0000-4000-8000-000000000001';
  v_character uuid := '84000000-0000-4000-8000-000000000011';
  v_other_character uuid := '84000000-0000-4000-8000-000000000012';
  v_battle uuid := '84000000-0000-4000-8000-000000000021';
  v_first text := '/api/media/appearance/1/slight.tan.braid.copper.tunic.open.split.lacing.pointed.linen.satchel.pine/neutral.svg';
  v_third text := replace(v_first,'.pine/','.indigo/');
  v_new_design text := replace(v_first,'.pine/','.slate/');
  v_next text := '/api/media/appearance/2/broad.deep.crop.onyx.cuirass.fur.close.clasps.split.quilt.brooch.indigo.greaves/neutral.svg';
  v_cuffed text := '/api/media/appearance/3/broad.deep.crop.onyx.cuirass.fur.close.clasps.split.quilt.brooch.indigo.greaves.braced/neutral.svg';
  v_painted text := '/api/media/appearance/4/scout.pine.natural.none.natural.arcanist.cobalt.eyepatch.charcoal/neutral.svg';
  v_cuff text;
  v_receipt jsonb;
  v_snapshot jsonb;
  v_inventory_revision bigint;
  v_new_user uuid := '84000000-0000-4000-8000-000000000002';
  v_request uuid := '84000000-0000-4000-8000-000000000031';
  v_created uuid;
  v_creation jsonb;
begin
  assert public.read_character_appearance_tokens_v1(v_user,v_character) = 0, 'characters created after launch begin without tokens';
  perform public.grant_character_items_v1(
    v_user,v_character,(public.read_character_item_inventory_v1(v_user,v_character)->>'revision')::bigint,
    'appearance-test','[{"itemId":"item.appearance-token","quantity":2}]'::jsonb
  );
  assert app_private.valid_npc_appearance_v1(to_jsonb(v_next)), 'NPC contract accepts a compatible new recipe';
  assert not app_private.valid_npc_appearance_v1(to_jsonb(replace(v_next,'.cuirass.','.greatcloak.'))), 'NPC rejects a lower layer hidden by its top';
  begin
    perform public.commit_character_appearance_v4(v_user,v_character,0,replace(v_next,'.greaves/','.original/'));
    raise exception 'alias for original v1 look accepted';
  exception when sqlstate '22023' then null;
  end;
  v_inventory_revision := (public.read_character_item_inventory_v1(v_user,v_character)->>'revision')::bigint;
  v_receipt := public.commit_character_appearance_v4(v_user,v_character,0,v_first);
  assert v_receipt = jsonb_build_object('revision',1,'imageUrl',v_first,'pendingImageUrl',null,'appearanceTokens',1), 'first confirmation spends one token';
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
  v_receipt := public.commit_character_appearance_v4(v_user,v_character,1,v_next);
  assert v_receipt = jsonb_build_object('revision',2,'imageUrl',v_first,'pendingImageUrl',v_next,'appearanceTokens',0), 'a save during battle consumes one token and queues the design';
  assert public.commit_character_appearance_v4(v_user,v_character,1,v_next) = v_receipt, 'identical retry at zero tokens is idempotent';
  begin
    perform public.commit_character_appearance_v4(v_user,v_character,2,v_first);
    raise exception 'a zero-token save removed a queued design';
  exception when sqlstate 'PT409' then
    assert sqlerrm='APPEARANCE_TOKEN_REQUIRED';
  end;
  perform public.set_character_personal_title_v1(v_user,v_character,'Roadfarer');
  assert (select appearance_revision=2 and appearance_image_url=v_first and pending_appearance_image_url=v_next
    from public.character_profile_display where character_id=v_character), 'a rejected change and free title switch preserve both appearances';
  assert (select revision=v_inventory_revision+2 from app_private.character_item_inventory where character_id=v_character), 'only paid changes increment the inventory revision';
  assert (select image_url=v_first from public.get_battle_character_appearances_v1(v_battle)
    where character_id=v_character), 'active battle stays pinned to its original appearance';
  update app_private.battle_sessions set lifecycle='completed',
    current_snapshot=jsonb_set(current_snapshot,'{tactical,battle,lifecycle}','"completed"')
    where id=v_battle;
  assert (select appearance_revision=3 and appearance_image_url=v_next and pending_appearance_image_url is null
    from public.character_profile_display where character_id=v_character), 'safe exit activates the queued appearance';
  assert (select image_url=v_first from public.get_battle_character_appearances_v1(v_battle)
    where character_id=v_character), 'completed battle keeps its original pin';
  begin
    perform public.commit_character_appearance_v4(v_user,v_character,1,v_first);
    raise exception 'stale look accepted';
  exception when sqlstate 'PT409' then
    assert sqlerrm='CHARACTER_APPEARANCE_STALE';
  end;
  begin
    perform public.commit_character_appearance_v4(v_user,v_character,3,v_cuffed);
    raise exception 'a third design was saved with no tokens';
  exception when sqlstate 'PT409' then
    assert sqlerrm='APPEARANCE_TOKEN_REQUIRED';
  end;
  assert app_private.valid_npc_appearance_v1(to_jsonb(v_cuffed)), 'NPC accepts cuffs with a separate lower layer';
  foreach v_cuff in array array['wrapped','laced','laminated','splitbell','gauntlet','scalloped'] loop
    assert app_private.valid_npc_appearance_v1(to_jsonb(replace(v_cuffed,'.braced/','.' || v_cuff || '/'))), 'NPC accepts expanded cuffs';
  end loop;
  assert app_private.valid_npc_appearance_v1(to_jsonb(replace(v_cuffed,'.greaves.','.original.'))), 'NPC accepts cuffs with original trousers';
  assert not app_private.valid_npc_appearance_v1(to_jsonb(replace(v_cuffed,'.cuirass.','.bolero.'))), 'NPC rejects cuffs on an incompatible top';
  assert not app_private.valid_npc_appearance_v1(to_jsonb(replace(v_cuffed,'.braced/','.original/'))), 'NPC rejects v3 aliases of a v2 outfit';
  begin
    perform public.commit_character_appearance_v4(v_user,v_character,3,replace(v_cuffed,'.braced/','.original/'));
    raise exception 'player appearance accepted an alias for a v2 outfit';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.commit_character_appearance_v4(v_user,v_other_character,0,v_next);
    raise exception 'duplicate design accepted';
  exception when unique_violation then
    assert sqlerrm='CHARACTER_APPEARANCE_DUPLICATE';
  end;
  perform public.grant_character_items_v1(
    v_user,v_character,v_inventory_revision+2,
    'appearance-test-extra','[{"itemId":"item.appearance-token","quantity":1}]'::jsonb
  );
  update public.character_profile_display set confirmed_sprite_designs=2 where character_id=v_character;
  v_receipt := public.commit_character_appearance_v4(v_user,v_character,3,v_third);
  assert v_receipt = jsonb_build_object('revision',4,'imageUrl',v_third,'pendingImageUrl',null,'appearanceTokens',0), 'a token enables a third saved design even at the former limit';
  assert public.commit_character_appearance_v4(v_user,v_character,3,v_third) = v_receipt, 'replaying an active design does not require a token';

  perform public.grant_character_items_v1(
    v_user,v_other_character,(public.read_character_item_inventory_v1(v_user,v_other_character)->>'revision')::bigint,
    'appearance-test','[{"itemId":"item.appearance-token","quantity":2}]'::jsonb
  );
  v_receipt := public.commit_character_appearance_v4(v_user,v_other_character,0,v_cuffed);
  assert v_receipt = jsonb_build_object('revision',1,'imageUrl',v_cuffed,'pendingImageUrl',null,'appearanceTokens',1), 'a v3 design activates immediately and uses the selected character’s balance';
  begin
    perform public.commit_character_appearance_v4(v_user,v_other_character,0,v_first);
    raise exception 'a stale editor used the final token';
  exception when sqlstate 'PT409' then
    assert sqlerrm='CHARACTER_APPEARANCE_STALE';
  end;
  v_cuffed := replace(v_cuffed,'.braced/','.gauntlet/');
  v_receipt := public.commit_character_appearance_v4(v_user,v_other_character,1,v_cuffed);
  assert v_receipt = jsonb_build_object('revision',2,'imageUrl',v_cuffed,'pendingImageUrl',null,'appearanceTokens',0), 'an expanded cuff activates using the final token';
  assert (select image_url=v_first from public.get_battle_character_appearances_v1(v_battle)
    where character_id=v_character), 'v3 activation preserves the old battle pin';
  assert not has_function_privilege('authenticated','public.commit_character_appearance_v4(uuid,uuid,integer,text)','execute'), 'browser cannot commit appearance changes';
  assert not has_function_privilege('authenticated','public.read_character_appearance_tokens_v1(uuid,uuid)','execute'), 'browser cannot read token balances directly';
  assert has_function_privilege('service_role','public.commit_character_appearance_v4(uuid,uuid,integer,text)','execute'), 'service can use the current appearance authority';
  assert not has_function_privilege('service_role','public.commit_character_appearance_v1(uuid,uuid,integer,text)','execute'), 'the v1 endpoint cannot bypass token spending';
  assert not has_function_privilege('service_role','public.commit_character_appearance_v2(uuid,uuid,integer,text)','execute'), 'the v2 endpoint cannot bypass token spending';
  assert not has_function_privilege('service_role','public.commit_character_appearance_v3(uuid,uuid,integer,text)','execute'), 'the v3 endpoint cannot bypass token spending';
  assert not has_function_privilege('authenticated','public.get_battle_character_appearances_v1(uuid)','execute'), 'browser cannot enumerate pins';

  v_creation := public.create_character_with_appearance_v1(
    v_new_user,0::smallint,v_request,'sprite-creation-starter',1,'Starter Design','starter-design','default','they',
    'portrait.adventure.male-01','appearance.test','vanguard',2,0,2,0,0,1,null,null
  )->0;
  v_created := (v_creation->>'id')::uuid;
  assert (select appearance_revision=0 and appearance_image_url is null
    from public.character_profile_display where character_id=v_created), 'a starter choice begins with the built-in appearance';
  assert public.read_character_appearance_tokens_v1(v_new_user,v_created)=0, 'character creation grants no launch tokens';
  perform public.grant_character_items_v1(
    v_new_user,v_created,(public.read_character_item_inventory_v1(v_new_user,v_created)->>'revision')::bigint,
    'appearance-test','[{"itemId":"item.appearance-token","quantity":1}]'::jsonb
  );
  v_receipt := public.commit_character_appearance_v4(v_new_user,v_created,0,v_new_design);
  assert v_receipt = jsonb_build_object('revision',1,'imageUrl',v_new_design,'pendingImageUrl',null,'appearanceTokens',0), 'a new character can spend a granted token';
  v_creation := public.create_character_with_appearance_v1(
    v_new_user,0::smallint,v_request,'sprite-creation-starter',1,'Starter Design','starter-design','default','they',
    'portrait.adventure.male-01','appearance.test','vanguard',2,0,2,0,0,1,null,null
  )->0;
  assert (v_creation->>'replayed')::boolean and (v_creation->>'id')::uuid=v_created, 'creation remains idempotent';
  assert (select appearance_revision=1 and appearance_image_url=v_new_design
    from public.character_profile_display where character_id=v_created), 'creation replay preserves the saved redesign';
  assert public.read_character_appearance_tokens_v1(v_new_user,v_created)=0, 'creation replay preserves the balance';

  v_creation := public.create_character_with_appearance_v1(
    v_new_user,1::smallint,'84000000-0000-4000-8000-000000000032','sprite-creation-custom',1,
    'Custom Design','custom-design','default','they','portrait.adventure.male-01',
    'appearance.test','vanguard',2,0,2,0,0,1,null,replace(v_first,'.pine/','.garnet/')
  )->0;
  v_created := (v_creation->>'id')::uuid;
  assert (select appearance_revision=1 and appearance_image_url=replace(v_first,'.pine/','.garnet/')
    from public.character_profile_display where character_id=v_created), 'a custom starting design is saved on creation';
  assert public.read_character_appearance_tokens_v1(v_new_user,v_created)=0, 'a custom starting design requires no inventory';
  assert app_private.valid_npc_appearance_v1(to_jsonb(v_painted)), 'NPC accepts a painted layered outfit';
  assert not app_private.valid_npc_appearance_v1(to_jsonb(replace(v_painted,'.pine.','.invented.'))), 'painted outfit names are exact';
  assert not app_private.valid_npc_appearance_v1(to_jsonb(replace(v_painted,'.eyepatch.','.none.'))), 'an absent face accessory cannot carry a dye';
  perform public.grant_character_items_v1(
    v_new_user,v_created,(public.read_character_item_inventory_v1(v_new_user,v_created)->>'revision')::bigint,
    'appearance-test','[{"itemId":"item.appearance-token","quantity":1}]'::jsonb
  );
  v_receipt := public.commit_character_appearance_v4(v_new_user,v_created,1,v_painted);
  assert v_receipt = jsonb_build_object('revision',2,'imageUrl',v_painted,'pendingImageUrl',null,'appearanceTokens',0), 'painted outfits use the same token cost';
end;
$$;
rollback;
