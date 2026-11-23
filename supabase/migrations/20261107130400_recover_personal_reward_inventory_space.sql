begin;

create index event_personal_input_item_idx
 on app_private.event_run_personal_journeys ((journey->>'inputItemId'))
 where journey->>'type'='item-exchange';

-- Use the same ownership and inventory lock as the ordinary Item view/writer.
-- Published and captured exchange identities and Item grants from Events remain protected.
create function app_private.character_item_discardable_stack_ids_v1(p_character_id uuid)
returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(s.id order by s.inventory_category,s.slot_index),'[]'::jsonb)
 from app_private.character_item_stacks s
 join app_private.character_item_inventory i on i.character_id=s.character_id
 where s.character_id=p_character_id
   and s.inventory_category in ('event','general')
   and s.item_id not in ('letter-introduction','cracked-aurevane-sigil','gatewarden-token')
   and left(s.provenance,6)<>'event.'
   and not exists(select from jsonb_each_text(i.equipment) e where e.value=s.id::text)
   and not exists(
     select from app_private.event_run_personal_journeys j
     where j.journey->>'type'='item-exchange' and j.journey->>'inputItemId'=s.item_id
   )
   and not exists(
     select from app_private.event_run_personal_journeys j
     where j.journey->>'type'='item-exchange' and j.journey->>'outputItemId'=s.item_id
   )
   and s.item_id not in (
     select item.id
     from app_private.event_publications p
     join app_private.event_definition_versions v on (v.id,v.event_key)=(p.version_id,p.event_key)
     cross join lateral (values
       (v.definition#>>'{personalJourney,inputItemId}'),
       (v.definition#>>'{personalJourney,outputItemId}')
     ) item(id)
     where v.definition#>>'{personalJourney,type}'='item-exchange' and item.id is not null
   );
$$;

revoke all on function app_private.character_item_discardable_stack_ids_v1(uuid)
 from public,anon,authenticated,service_role;

do $migration$
declare src text; anchor text;
begin
 src:=pg_get_functiondef('public.read_character_items_view_v1(uuid,uuid)'::regprocedure);
 anchor:='''battleLocked'',locked';
 if length(src)-length(replace(src,anchor,''))<>length(anchor) then
  raise exception 'ITEM_DISCARD_VIEW_PREDECESSOR';
 end if;
 execute replace(src,anchor,anchor||$patch$,'discardableStackIds',
   app_private.character_item_discardable_stack_ids_v1(p_character_id)$patch$);

 src:=pg_get_functiondef('public.write_character_items_v1(uuid,uuid,bigint,text,jsonb)'::regprocedure);
 anchor:=$anchor$ else raise exception using errcode='22023',message='ITEM_COMMAND_INVALID'; end if;$anchor$;
 if length(src)-length(replace(src,anchor,''))<>length(anchor) then
  raise exception 'ITEM_DISCARD_WRITER_PREDECESSOR';
 end if;
 execute replace(src,anchor,$patch$
 elsif p_command->>'action'='discard' and (p_command-'action'-'stackId')='{}'::jsonb
  and jsonb_typeof(p_command->'stackId')='string'
  and p_command->>'stackId' ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then
  if not ((view->'discardableStackIds') ? (p_command->>'stackId')) then
   raise exception using errcode='22023',message='ITEM_DISCARD_PROTECTED';
  end if;
  delete from app_private.character_item_stacks
   where character_id=p_character_id and id=(p_command->>'stackId')::uuid;
  update app_private.character_item_inventory
   set revision=revision+1 where character_id=p_character_id;
  result:='{"notices":[]}';
$patch$||anchor);
end;
$migration$;

commit;
