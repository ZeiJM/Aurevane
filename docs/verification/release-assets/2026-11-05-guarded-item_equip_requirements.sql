begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $release_guard$ begin
 if clock_timestamp()<timestamptz '2026-11-05T15:29:30.345143Z' then raise exception 'ITEMS_DRAIN_INCOMPLETE'; end if;
 if exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and backend_type='client backend' and xact_start<timestamptz '2026-11-05T14:57:00.345143Z') then raise exception 'ITEMS_OLD_TRANSACTION'; end if;
 if md5(pg_get_functiondef('app_private.assert_runtime_item_shape_v1(jsonb)'::regprocedure)) is distinct from '393d17cabd742d6fc4b86f456845ea12' then raise exception 'ITEMS_PREDECESSOR_CHANGED: app_private.assert_runtime_item_shape_v1(jsonb)'; end if;
 if md5(pg_get_functiondef('app_private.validate_character_item_equipment_v1(uuid,jsonb,jsonb)'::regprocedure)) is distinct from '9d15cf2f037adf40b66cf35482f4c36c' then raise exception 'ITEMS_PREDECESSOR_CHANGED: app_private.validate_character_item_equipment_v1(uuid,jsonb,jsonb)'; end if;
 if md5(pg_get_functiondef('public.read_character_items_view_v1(uuid,uuid)'::regprocedure)) is distinct from 'faf878c44816f44ae70e37667bd5783e' then raise exception 'ITEMS_PREDECESSOR_CHANGED: public.read_character_items_view_v1(uuid,uuid)'; end if;
end; $release_guard$;
lock table app_private.battle_sessions,public.characters,app_private.character_active_builds,app_private.combat_content_records,app_private.combat_content_versions,app_private.combat_content_publications,app_private.combat_content_drafts,app_private.combat_effect_timing_policy_versions,app_private.runtime_item_source_definitions,app_private.character_item_inventory,app_private.character_item_stacks,app_private.character_item_grants in share row exclusive mode;
create temporary table items_rows_before on commit drop as select 'app_private.battle_sessions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.battle_sessions t) v union all select 'public.characters' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from public.characters t) v union all select 'app_private.character_active_builds' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_active_builds t) v union all select 'app_private.combat_content_records' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_records t) v union all select 'app_private.combat_content_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_versions t) v union all select 'app_private.combat_content_publications' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_publications t) v union all select 'app_private.combat_content_drafts' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_drafts t) v union all select 'app_private.combat_effect_timing_policy_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_effect_timing_policy_versions t) v union all select 'app_private.runtime_item_source_definitions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.runtime_item_source_definitions t) v union all select 'app_private.character_item_inventory' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_inventory t) v union all select 'app_private.character_item_stacks' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_stacks t) v union all select 'app_private.character_item_grants' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_grants t) v;
create temporary table items_functions_before on commit drop as select p.oid,p.proname,p.proowner,p.proacl,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prokind='f';


-- Optional Item equip requirements are separate from ability Requirements.
-- No inventory, source definitions or historical battle rows are rewritten.
create function app_private.assert_item_equip_requirements_shape_v1(d jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare r jsonb:=d->'equipRequirements'; e record;
begin
 if not d ? 'equipRequirements' then return; end if;
 if jsonb_typeof(r) is distinct from 'object' or d->'equipment' is null or d->'equipment'='null'::jsonb or (r-'minimumLevel'-'disciplineIds'-'minimumCoreStats')<>'{}'::jsonb then raise exception using errcode='22023',message='ITEM_EQUIP_REQUIREMENTS_SHAPE'; end if;
 if r ? 'minimumLevel' and (jsonb_typeof(r->'minimumLevel') is distinct from 'number' or (r->>'minimumLevel') !~ '^[1-9][0-9]*$' or (r->>'minimumLevel')::numeric>9007199254740991) then raise exception using errcode='22023',message='ITEM_EQUIP_REQUIREMENTS_SHAPE'; end if;
 if r ? 'disciplineIds' then
  if jsonb_typeof(r->'disciplineIds') is distinct from 'array' then raise exception using errcode='22023',message='ITEM_EQUIP_REQUIREMENTS_SHAPE'; end if;
  if jsonb_array_length(r->'disciplineIds')=0 or exists(select 1 from jsonb_array_elements(r->'disciplineIds') x where jsonb_typeof(x)<>'string' or char_length(x#>>'{}')>160 or (x#>>'{}') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$') or (select count(*)<>count(distinct x) from jsonb_array_elements(r->'disciplineIds') x) then raise exception using errcode='22023',message='ITEM_EQUIP_REQUIREMENTS_SHAPE'; end if;
 end if;
 if r ? 'minimumCoreStats' then
  if jsonb_typeof(r->'minimumCoreStats') is distinct from 'object' then raise exception using errcode='22023',message='ITEM_EQUIP_REQUIREMENTS_SHAPE'; end if;
  for e in select * from jsonb_each(r->'minimumCoreStats') loop
   if e.key not in ('might','finesse','vitality','agility','intellect','resolve') or jsonb_typeof(e.value)<>'number' or e.value::text !~ '^[1-9][0-9]*$' or e.value::text::numeric>9007199254740991 then raise exception using errcode='22023',message='ITEM_EQUIP_REQUIREMENTS_SHAPE'; end if;
  end loop;
 end if;
end; $$;
create function app_private.character_item_equip_context_v1(p_character_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('level',c.level,'disciplineIds',to_jsonb(array_remove(array[b.primary_discipline_id,b.secondary_discipline_id],null)),
 'baseCoreStats',jsonb_build_object('might',c.might,'finesse',c.finesse,'vitality',c.vitality,'agility',c.agility,'intellect',c.intellect,'resolve',c.resolve),
 'disciplineNames',(select coalesce(jsonb_object_agg(x.discipline_id,x.name),'{}') from (select distinct on (discipline_id) discipline_id,name from app_private.discipline_definitions order by discipline_id,definition_version desc) x))
 from public.characters c join app_private.character_active_builds b on b.character_id=c.id where c.id=p_character_id;
$$;
create function app_private.assert_item_equip_requirements_v1(p_character_id uuid,d jsonb)
returns void language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=d->'equipRequirements'; context jsonb; e record;
begin
 perform app_private.assert_item_equip_requirements_shape_v1(d);
 if not d ? 'equipRequirements' or not (r ? 'minimumLevel' or r ? 'disciplineIds' or coalesce(r->'minimumCoreStats','{}')<>'{}'::jsonb) then return; end if;
 context:=app_private.character_item_equip_context_v1(p_character_id);
 if context is null then raise exception using errcode='22023',message='ITEM_EQUIP_REQUIREMENTS'; end if;
 if r ? 'minimumLevel' and (context->>'level')::numeric<(r->>'minimumLevel')::numeric then raise exception using errcode='22023',message='ITEM_EQUIP_REQUIREMENTS'; end if;
 if r ? 'disciplineIds' and not exists(select 1 from jsonb_array_elements(r->'disciplineIds') wanted join jsonb_array_elements(context->'disciplineIds') actual on wanted=actual) then raise exception using errcode='22023',message='ITEM_EQUIP_REQUIREMENTS'; end if;
 for e in select * from jsonb_each(coalesce(r->'minimumCoreStats','{}')) loop
  if context->'baseCoreStats'->>e.key is null or (context->'baseCoreStats'->>e.key)::numeric<e.value::text::numeric then raise exception using errcode='22023',message='ITEM_EQUIP_REQUIREMENTS'; end if;
 end loop;
end; $$;
-- Exact guarded patches preserve all current authorization, QP, replacement and lock rules.
do $$
declare src text; anchor text;
begin
 src:=pg_get_functiondef('app_private.assert_runtime_item_shape_v1(jsonb)'::regprocedure);
 anchor:='''maximumStack'',''requirements'',''ability''';
 if strpos(src,anchor)=0 then raise exception 'Item shape whitelist anchor changed'; end if;
 src:=replace(src,anchor,'''maximumStack'',''requirements'',''equipRequirements'',''ability''');
 -- equipRequirements remains optional in the required-key list.
 src:=replace(src,'''equipment'',''maximumStack'',''requirements'',''equipRequirements'',''ability'',''battleUses''','''equipment'',''maximumStack'',''requirements'',''ability'',''battleUses''');
 anchor:='begin';
 src:=replace(src,anchor,anchor||E'\n perform app_private.assert_item_equip_requirements_shape_v1(d);');
 execute src;
 src:=pg_get_functiondef('app_private.validate_character_item_equipment_v1(uuid,jsonb,jsonb)'::regprocedure);
 anchor:='perform app_private.assert_runtime_item_shape_v1(d);';
 if strpos(src,anchor)=0 then raise exception 'Item equipment validation anchor changed'; end if;
 src:=replace(src,anchor,anchor||E'\n  perform app_private.assert_item_equip_requirements_v1(p_character_id,d);');
 anchor:='return qp;';
 if strpos(src,anchor)=0 then raise exception 'Item equipment result anchor changed'; end if;
 src:=replace(src,anchor,E'if exists(select 1 from jsonb_each_text(p_equipment) e join app_private.character_item_stacks s on s.id::text=e.value and s.character_id=p_character_id where e.key in (''consumable-1'',''consumable-2'') group by s.item_id having count(*)>1) then raise exception using errcode=''22023'',message=''ITEM_DUPLICATE_CONSUMABLE''; end if;\n '||anchor);
 execute src;
 src:=pg_get_functiondef('public.read_character_items_view_v1(uuid,uuid)'::regprocedure);
 anchor:='''battleLocked'',locked';
 if strpos(src,anchor)=0 then raise exception 'Item owner view anchor changed'; end if;
 src:=replace(src,anchor,anchor||',''equipContext'',app_private.character_item_equip_context_v1(p_character_id)');
 execute src;
end; $$;
revoke all on function app_private.assert_item_equip_requirements_shape_v1(jsonb),app_private.character_item_equip_context_v1(uuid),app_private.assert_item_equip_requirements_v1(uuid,jsonb) from public,anon,authenticated,service_role;


create temporary table items_rows_after on commit drop as select 'app_private.battle_sessions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.battle_sessions t) v union all select 'public.characters' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from public.characters t) v union all select 'app_private.character_active_builds' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_active_builds t) v union all select 'app_private.combat_content_records' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_records t) v union all select 'app_private.combat_content_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_versions t) v union all select 'app_private.combat_content_publications' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_publications t) v union all select 'app_private.combat_content_drafts' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_content_drafts t) v union all select 'app_private.combat_effect_timing_policy_versions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.combat_effect_timing_policy_versions t) v union all select 'app_private.runtime_item_source_definitions' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.runtime_item_source_definitions t) v union all select 'app_private.character_item_inventory' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_inventory t) v union all select 'app_private.character_item_stacks' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_stacks t) v union all select 'app_private.character_item_grants' label,count(*) amount,md5(coalesce(string_agg(row_data,E'\n' order by row_data),'')) digest from (select to_jsonb(t)::text row_data from app_private.character_item_grants t) v;
do $preserve$ begin
 if exists((table items_rows_before except table items_rows_after) union all (table items_rows_after except table items_rows_before)) then raise exception 'ITEMS_DURABLE_PRESERVATION_FAILED'; end if;
 if exists(select 1 from items_functions_before b left join pg_proc p on p.oid=b.oid where p.oid is null or p.proowner is distinct from b.proowner or p.proacl is distinct from b.proacl or (not(b.proname=any(array['assert_runtime_item_shape_v1','validate_character_item_equipment_v1','read_character_items_view_v1']::text[])) and pg_get_functiondef(p.oid) is distinct from b.definition)) then raise exception 'ITEMS_FUNCTION_PRESERVATION_FAILED'; end if;
end; $preserve$;
commit;
