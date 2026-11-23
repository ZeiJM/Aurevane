begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $release_guard$ begin
 if clock_timestamp()<timestamptz '2026-11-05T15:29:30.345143Z' then raise exception 'ITEMS_DRAIN_INCOMPLETE'; end if;
 if exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and backend_type='client backend' and xact_start<timestamptz '2026-11-05T14:57:00.345143Z') then raise exception 'ITEMS_OLD_TRANSACTION'; end if;
 if md5(pg_get_functiondef('public.list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer)'::regprocedure)) is distinct from 'a2e01d1af53d75d50c783c4571c1648a' then raise exception 'ITEMS_PREDECESSOR_CHANGED: public.list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer)'; end if;
end; $release_guard$;
lock table app_private.battle_sessions,public.characters,app_private.character_active_builds,app_private.combat_content_records,app_private.combat_content_versions,app_private.combat_content_publications,app_private.combat_content_drafts,app_private.combat_effect_timing_policy_versions,app_private.runtime_item_source_definitions,app_private.character_item_inventory,app_private.character_item_stacks,app_private.character_item_grants in share row exclusive mode;
create temporary table items_rows_before on commit drop as select 'app_private.battle_sessions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.battle_sessions t) v union all select 'public.characters' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from public.characters t) v union all select 'app_private.character_active_builds' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_active_builds t) v union all select 'app_private.combat_content_records' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_records t) v union all select 'app_private.combat_content_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_versions t) v union all select 'app_private.combat_content_publications' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_publications t) v union all select 'app_private.combat_content_drafts' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_drafts t) v union all select 'app_private.combat_effect_timing_policy_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_effect_timing_policy_versions t) v union all select 'app_private.runtime_item_source_definitions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.runtime_item_source_definitions t) v union all select 'app_private.character_item_inventory' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_inventory t) v union all select 'app_private.character_item_stacks' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_stacks t) v union all select 'app_private.character_item_grants' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_grants t) v;
create temporary table items_functions_before on commit drop as select p.oid,p.proname,p.proowner,p.proacl,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prokind='f';


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


create temporary table items_rows_after on commit drop as select 'app_private.battle_sessions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.battle_sessions t) v union all select 'public.characters' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from public.characters t) v union all select 'app_private.character_active_builds' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_active_builds t) v union all select 'app_private.combat_content_records' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_records t) v union all select 'app_private.combat_content_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_versions t) v union all select 'app_private.combat_content_publications' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_publications t) v union all select 'app_private.combat_content_drafts' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_drafts t) v union all select 'app_private.combat_effect_timing_policy_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_effect_timing_policy_versions t) v union all select 'app_private.runtime_item_source_definitions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.runtime_item_source_definitions t) v union all select 'app_private.character_item_inventory' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_inventory t) v union all select 'app_private.character_item_stacks' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_stacks t) v union all select 'app_private.character_item_grants' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_grants t) v;
do $preserve$ begin
 if exists((table items_rows_before except table items_rows_after) union all (table items_rows_after except table items_rows_before)) then raise exception 'ITEMS_DURABLE_PRESERVATION_FAILED'; end if;
 if exists(select 1 from items_functions_before b left join pg_proc p on p.oid=b.oid where p.oid is null or p.proowner is distinct from b.proowner or p.proacl is distinct from b.proacl or (not(b.proname=any(array['list_combat_content_records_v1']::text[])) and pg_get_functiondef(p.oid) is distinct from b.definition)) then raise exception 'ITEMS_FUNCTION_PRESERVATION_FAILED'; end if;
end; $preserve$;
commit;
