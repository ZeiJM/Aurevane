begin;

-- Basic Support edits configure the next battle; existing encounters keep their
-- captured build. Retain catalogue/account/character/build/inventory locks,
-- ownership, revision, receipt and audit behavior, without applying the gear lock.
-- Equipment, equipment Support selection, sorting and grants remain battle-locked.
do $saved_support$
declare definition text; anchor text;
begin
 definition:=pg_get_functiondef('public.save_character_support_action_v1(uuid,uuid,bigint,text,uuid,text)'::regprocedure);
 anchor:='perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,true);';
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then
  raise exception 'SAVED_SUPPORT_BATTLE_LOCK_PREDECESSOR_CONFLICT';
 end if;
 execute replace(definition,anchor,'perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,false);');
end; $saved_support$;

commit;
