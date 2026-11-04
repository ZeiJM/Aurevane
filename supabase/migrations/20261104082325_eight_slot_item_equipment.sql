begin;

-- Version the battle capture, not Item definitions: weapon, hand-armor and
-- battle-item definitions retain their existing equipment.slot = hand metadata.
-- Patching exact predecessors retains every owner, ACL, search path and security
-- mode, including the previously installed PT409 conflicts and lock order.
-- Take the existing first lock exclusively so concurrent Item/catalogue writers
-- fail/retry rather than observe a partial policy or assignment transition.
do $lock$
begin
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('combat-catalogue-publication',0)) then
  raise exception using errcode='PT409',message='ITEM_CATALOGUE_RETRY';
 end if;
end; $lock$;

do $policy$
declare d text; old_slots text:='''head'',''body'',''pants'',''boots'',''main-hand'',''off-hand''';
 new_slots text:='''head'',''body'',''pants'',''boots'',''main-hand'',''off-hand'',''consumable-1'',''consumable-2''';
 signature text; anchor text;
begin
 foreach signature in array array[
  'app_private.item_support_valid_v1(uuid,jsonb,jsonb)',
  'app_private.validate_character_item_equipment_v1(uuid,jsonb,jsonb)',
  'public.set_character_item_equipment_v1(uuid,uuid,bigint,jsonb,jsonb,text[])',
  'app_private.battle_equipment_capture_v1(jsonb)'
 ] loop
  d:=pg_get_functiondef(signature::regprocedure);
  if strpos(d,new_slots)>0 or (length(d)-length(replace(d,old_slots,'')))/length(old_slots)<>1 then
   raise exception 'ITEM_EIGHT_SLOT_PREDECESSOR_CONFLICT: %',signature;
  end if;
  d:=replace(d,old_slots,new_slots);
  if signature='app_private.validate_character_item_equipment_v1(uuid,jsonb,jsonb)' then
   anchor:=$before$if (case when d->'equipment'->>'slot'='hand' then entry.key not in ('main-hand','off-hand') else d->'equipment'->>'slot' is distinct from entry.key end) then$before$;
   if strpos(d,anchor)=0 then raise exception 'ITEM_EIGHT_SLOT_CLASS_PREDECESSOR_CONFLICT'; end if;
   d:=replace(d,anchor,$after$if (case d->>'itemClass'
    when 'weapon' then entry.key<>'main-hand'
    when 'hand-armor' then entry.key<>'off-hand'
    when 'battle-item' then entry.key not in ('consumable-1','consumable-2')
    when 'armor' then d->'equipment'->>'slot' is distinct from entry.key
    else true end) then$after$);
  elsif signature='app_private.battle_equipment_capture_v1(jsonb)' then
   anchor:=$before$'schemaVersion',1$before$;
   if strpos(d,anchor)=0 then raise exception 'ITEM_EIGHT_SLOT_CAPTURE_PREDECESSOR_CONFLICT'; end if;
   d:=replace(d,anchor,$after$'schemaVersion',2$after$);
  end if;
  execute d;
 end loop;
 d:=pg_get_functiondef('app_private.guard_player_battle_admission_v1()'::regprocedure);
 anchor:=$before$v_capture#>'{extensions,equipmentSkills,0,schemaVersion}' is distinct from '1'::jsonb$before$;
 if strpos(d,anchor)=0 then raise exception 'ITEM_EIGHT_SLOT_ADMISSION_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,anchor,$after$v_capture#>'{extensions,equipmentSkills,0,schemaVersion}' is distinct from '2'::jsonb$after$);
end; $policy$;

-- Transition only current assignments. Never rewrite stacks, quantities, grant
-- receipts, catalogue definitions, publication history or frozen battle captures.
-- Classify unavailable/archived holdings by their exact acquired definition.
-- Battle-items move main then off into the first vacant consumable position.
-- A passive main hand and one-handed off weapon can swap without discarding either.
-- Conflicting dual weapons/passives (or missing definitions) stay assigned and
-- fail normal admission validation until repaired with explicit unequips.
do $assignments$
declare owner record; current_state record; entry record; d jsonb; next_equipment jsonb;
 next_support jsonb; moved jsonb; target text; main_class text; off_class text;
 off_hands text; main_definition jsonb; off_definition jsonb;
begin
 for owner in select distinct c.user_id from app_private.character_item_inventory i
  join public.characters c on c.id=i.character_id order by c.user_id loop
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(owner.user_id::text,0))
   or not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(owner.user_id::text,1)) then
   raise exception using errcode='PT409',message='ITEM_ADMISSION_RETRY';
  end if;
  for current_state in select i.* from app_private.character_item_inventory i
   join public.characters c on c.id=i.character_id where c.user_id=owner.user_id order by i.character_id loop
   perform 1 from public.characters where id=current_state.character_id for update nowait;
   perform 1 from app_private.character_active_builds where character_id=current_state.character_id for update nowait;
   perform 1 from app_private.character_item_inventory where character_id=current_state.character_id for update nowait;
   next_equipment:=current_state.equipment; moved:='{}';
   main_definition:=null; off_definition:=null;
   for entry in select e.key,s.item_id,s.acquired_content_version from jsonb_each_text(current_state.equipment) e
    join app_private.character_item_stacks s on s.character_id=current_state.character_id and s.id::text=e.value
    where e.key in ('main-hand','off-hand') order by case e.key when 'main-hand' then 1 else 2 end loop
    d:=coalesce(app_private.available_runtime_item_v1(entry.item_id),public.read_runtime_item_version_v1(entry.item_id,entry.acquired_content_version));
    if entry.key='main-hand' then main_definition:=d; else off_definition:=d; end if;
    if d->>'itemClass'='battle-item' and d#>>'{equipment,slot}'='hand' then
     target:=case when not next_equipment ? 'consumable-1' then 'consumable-1'
      when not next_equipment ? 'consumable-2' then 'consumable-2' else null end;
     if target is not null then
      next_equipment:=jsonb_set(next_equipment,array[target],next_equipment->entry.key)-entry.key;
      moved:=moved||jsonb_build_object(entry.key,target);
     end if;
    end if;
   end loop;
   main_class:=case when next_equipment ? 'main-hand' then main_definition->>'itemClass' end;
   off_class:=case when next_equipment ? 'off-hand' then off_definition->>'itemClass' end;
   off_hands:=off_definition#>>'{equipment,hands}';
   if main_class='hand-armor' and off_class='weapon' and off_hands='1' then
    next_equipment:=next_equipment||jsonb_build_object('main-hand',next_equipment->'off-hand','off-hand',next_equipment->'main-hand');
    moved:=moved||'{"main-hand":"off-hand","off-hand":"main-hand"}'::jsonb;
   elsif main_class='hand-armor' and not next_equipment ? 'off-hand' then
    next_equipment:=jsonb_set(next_equipment,array['off-hand'],next_equipment->'main-hand')-'main-hand';
    moved:=moved||'{"main-hand":"off-hand"}'::jsonb;
   elsif off_class='weapon' and not next_equipment ? 'main-hand' then
    next_equipment:=jsonb_set(next_equipment,array['main-hand'],next_equipment->'off-hand')-'off-hand';
    moved:=moved||'{"off-hand":"main-hand"}'::jsonb;
   end if;
   if next_equipment is distinct from current_state.equipment then
    next_support:=current_state.selected_support;
    if next_support->>'kind'='equipment' and moved ? (next_support->>'position') then
     next_support:=jsonb_set(next_support,array['position'],moved->(next_support->>'position'));
    end if;
    if not coalesce(app_private.item_support_valid_v1(current_state.character_id,next_equipment,next_support),false) then
     next_support:=jsonb_build_object('kind','basic','actionId',current_state.previous_basic_support);
    end if;
    update app_private.character_item_inventory set equipment=next_equipment,selected_support=next_support,revision=revision+1
     where character_id=current_state.character_id;
    update app_private.character_active_builds set
     support_action_id=case when next_support->>'kind'='basic' then next_support->>'actionId' else support_action_id end,
     build_version=build_version+1,updated_at=clock_timestamp() where character_id=current_state.character_id;
   end if;
  end loop;
 end loop;
end; $assignments$;

commit;
