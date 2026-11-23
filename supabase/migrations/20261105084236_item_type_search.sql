begin;

-- Extend the installed reader, including its current Basic partitions, without
-- replacing its signature, security properties, ACL, cursor or ordering rules.
-- Master searches the displayed draft first, then current publication, then the
-- latest trusted source. Runtime availability guards deliberately do not apply
-- to this authoring browse: archived and disabled Items remain repairable.
do $item_search$
declare definition text; patch record;
begin
 definition:=pg_get_functiondef('public.list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer)'::regprocedure);
 for patch in select * from (values
  ($before$as name
  from app_private.combat_content_records r$before$,
   $after$as name,
   case when r.content_kind='item' then concat_ws(' ',
    item_search.definition->>'itemClass',replace(item_search.definition->>'itemClass','-',' '),
    item_search.definition->>'inventoryCategory',replace(item_search.definition->>'inventoryCategory','-',' '),
    item_search.definition#>>'{equipment,slot}',
    case item_search.definition->>'itemClass'
     when 'weapon' then 'main-hand main hand'
     when 'hand-armor' then 'gloves off-hand off hand'
     when 'battle-item' then 'consumable consumables consumable-1 consumable 1 consumable-2 consumable 2'
    end) end as item_type_search
  from app_private.combat_content_records r$after$),
  ($before$left join app_private.combat_content_versions v on v.id=p.version_id$before$,
   $after$left join app_private.combat_content_versions v on v.id=p.version_id
  left join lateral (
   select source.definition from app_private.runtime_item_source_definitions source
   where r.content_kind='item' and d.definition is null and v.definition is null
    and source.item_id=r.content_key
   order by source.content_version desc limit 1
  ) item_source on true
  left join lateral (
   select coalesce(d.definition,v.definition,item_source.definition) as definition
   where r.content_kind='item'
  ) item_search on true$after$),
  ($before$(p_search is null or position(lower(p_search) in lower(m."contentKey"||' '||m.name))>0)$before$,
   $after$(p_search is null or position(lower(case when m."contentKind"='item'
    then btrim(p_search,E' \t\n\r') else p_search end)
    in lower(m."contentKey"||' '||m.name||coalesce(' '||m.item_type_search,'')))>0)$after$),
  ($before$to_jsonb(n)-'ordinal'$before$,
   $after$to_jsonb(n)-'ordinal'-'item_type_search'$after$)
 ) as patches(predecessor,replacement) loop
  if (length(definition)-length(replace(definition,patch.predecessor,'')))/length(patch.predecessor)<>1 then
   raise exception 'ITEM_TYPE_SEARCH_PREDECESSOR_CONFLICT';
  end if;
  definition:=replace(definition,patch.predecessor,patch.replacement);
 end loop;
 execute definition;
end; $item_search$;

commit;
