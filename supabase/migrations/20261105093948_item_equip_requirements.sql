begin;

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

commit;
