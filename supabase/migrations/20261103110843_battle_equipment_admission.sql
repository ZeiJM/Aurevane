begin;

-- A compact private capture of the exact assertion result; no grants/provenance
-- or unassigned stacks become encounter history.
create function app_private.battle_equipment_capture_v1(p_admission jsonb)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('schemaVersion',1,
   'inventoryRevision',p_admission#>'{inventory,revision}',
   'selectedSupport',p_admission#>'{inventory,selectedSupport}',
   'equipment',coalesce((select jsonb_agg(jsonb_build_object(
     'position',e.key,'ownedStackId',e.value,'item',p_admission->'definitions'->(s->>'itemId'))
     order by array_position(array['head','body','pants','boots','main-hand','off-hand'],e.key))
     from jsonb_each_text(p_admission#>'{inventory,equipment}') e
     join jsonb_array_elements(p_admission#>'{inventory,stacks}') s on s->>'id'=e.value),'[]'::jsonb));
$$;
revoke all on function app_private.battle_equipment_capture_v1(jsonb) from public,anon,authenticated,service_role;

create function public.read_character_battle_equipment_v1(p_user_id uuid,p_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare inventory jsonb;
begin
 inventory:=public.read_character_item_inventory_v1(p_user_id,p_character_id);
 return app_private.battle_equipment_capture_v1(public.assert_character_item_admission_v1(p_user_id,p_character_id,(inventory->>'revision')::bigint));
end; $$;
revoke all on function public.read_character_battle_equipment_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_character_battle_equipment_v1(uuid,uuid) to service_role;

-- Both v2 startup writers delegate to the real v1 participant insertion path.
-- This BEFORE trigger also covers World/map and owned staff test characters.
-- It runs before the participant exists, so admission cannot see itself active.
-- A retained/synthetic empty-equipment fixture may omit the new capture; actual
-- prepared owned builds always carry an explicit version, even with empty gear.
do $migration$
declare d text; anchor text;
begin
 d:=pg_get_functiondef('app_private.guard_player_battle_admission_v1()'::regprocedure);
 anchor:='if new.character_id is null then return new; end if;';
 if strpos(d,anchor)=0 then raise exception 'ITEM_ADMISSION_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,anchor,anchor||$equipment$
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('combat-catalogue-publication',0))
 or not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0))
 then raise exception using errcode='40001',message='ITEM_ADMISSION_RETRY'; end if;
 select current_snapshot into v_snapshot from app_private.battle_sessions where id=new.battle_session_id;
 select unit into v_capture from jsonb_array_elements(v_snapshot#>'{buildAuthority,combatants}') unit
 where unit->>'combatantId'=new.combatant_id and unit->>'characterId'=new.character_id::text;
 if coalesce(v_capture#>'{extensions,equipmentSkills}','[]'::jsonb)<>'[]'::jsonb or exists(
   select 1 from app_private.character_item_inventory where character_id=new.character_id and equipment<>'{}'::jsonb
 ) then
   if jsonb_typeof(v_capture#>'{extensions,equipmentSkills}') is distinct from 'array'
   or jsonb_array_length(v_capture#>'{extensions,equipmentSkills}')<>1
   or v_capture#>'{extensions,equipmentSkills,0,schemaVersion}' is distinct from '1'::jsonb
   or coalesce(v_capture#>>'{extensions,equipmentSkills,0,inventoryRevision}','') !~ '^(0|[1-9][0-9]*)$'
   then raise exception using errcode='40001',message='ITEM_PREPARATION_STALE'; end if;
   v_expected:=app_private.battle_equipment_capture_v1(public.assert_character_item_admission_v1(
     new.user_id,new.character_id,(v_capture#>>'{extensions,equipmentSkills,0,inventoryRevision}')::bigint));
   if v_capture#>'{extensions,equipmentSkills,0}' is distinct from v_expected
   then raise exception using errcode='40001',message='ITEM_PREPARATION_STALE'; end if;
 end if;
$equipment$);
 execute d;
 d:=pg_get_functiondef('app_private.guard_player_battle_head_admission_v1()'::regprocedure);
 anchor:=E'begin\n';
 if strpos(d,anchor)=0 then raise exception 'ITEM_HEAD_ADMISSION_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,anchor,anchor||$locks$
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('combat-catalogue-publication',0))
 or not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_user_id::text,0))
 then raise exception using errcode='40001',message='ITEM_ADMISSION_RETRY'; end if;
$locks$);
 execute d;
 d:=pg_get_functiondef('public.start_world_encounter_v1(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb)'::regprocedure);
 anchor:='for v_user in select u from unnest(array[p_user_id,v_target_user]) u order by u loop';
 if strpos(d,anchor)=0 then raise exception 'ITEM_WORLD_ADMISSION_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,anchor,$outer$
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('combat-catalogue-publication',0)) then raise exception using errcode='40001',message='ITEM_CATALOGUE_RETRY'; end if;
 for v_user in select u from unnest(array[p_user_id,v_target_user]) u order by u loop
   if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0)) then raise exception using errcode='40001',message='ITEM_ADMISSION_RETRY'; end if;
 end loop;
 $outer$||anchor);
 execute d;
 d:=pg_get_functiondef('app_private.append_battle_startup_events_v1(uuid,jsonb,jsonb,jsonb,jsonb,timestamptz)'::regprocedure);
 anchor:=E'begin\n';
 if strpos(d,anchor)=0 then raise exception 'ITEM_STARTUP_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,anchor,anchor||$capture$
 if (select jsonb_agg(jsonb_build_array(c->>'combatantId',c#>'{extensions,equipmentSkills}') order by c->>'combatantId')
     from jsonb_array_elements(p_start_snapshot#>'{buildAuthority,combatants}') c where c#>'{extensions,equipmentSkills}' is not null)
 is distinct from
    (select jsonb_agg(jsonb_build_array(c->>'combatantId',c#>'{extensions,equipmentSkills}') order by c->>'combatantId')
     from jsonb_array_elements(p_final_snapshot#>'{buildAuthority,combatants}') c where c#>'{extensions,equipmentSkills}' is not null)
 then raise exception using errcode='40001',message='ITEM_STARTUP_CAPTURE_CHANGED'; end if;
 $capture$);
 execute d;
end; $migration$;

commit;
