begin;

-- Refresh current characters at entry, never historical encounter snapshots. The
-- existing Primary transaction owns versioning, skill reconciliation and clocks.
create function app_private.refresh_character_primary_profile_v1(p_user_id uuid,p_character_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
 b app_private.character_active_builds%rowtype;
 d app_private.discipline_definitions%rowtype;
 p app_private.character_attribute_personal_allocations%rowtype;
 v_key uuid:=gen_random_uuid();
 v_fingerprint text;
begin
 if exists(select 1 from app_private.character_deletion_requests where character_id=p_character_id) then return; end if;
 select * into b from app_private.character_active_builds where character_id=p_character_id and user_id=p_user_id;
 if not found then return; end if;
 select * into d from app_private.current_discipline_definitions_v1() where discipline_id=b.primary_discipline_id and enabled_for_primary;
 if not found or (b.primary_definition_version=d.definition_version and b.primary_profile_version=d.primary_profile_version) then return; end if;
 perform app_private.lock_current_discipline_selection_v1();
 -- Do not invert allocation's personal/character lock order while waiting. An
 -- overlapping edit retries through the existing content-admission response.
 select * into b from app_private.character_active_builds where character_id=p_character_id and user_id=p_user_id for update nowait;
 perform 1 from public.characters where id=p_character_id and user_id=p_user_id for update nowait;
 select * into p from app_private.character_attribute_personal_allocations where character_id=p_character_id and user_id=p_user_id for update nowait;
 if not found then raise exception 'CHARACTER_ATTRIBUTE_PERSONAL_ALLOCATION_UNAVAILABLE'; end if;
 select * into d from app_private.current_discipline_definitions_v1() where discipline_id=b.primary_discipline_id and enabled_for_primary;
 if not found or (b.primary_definition_version=d.definition_version and b.primary_profile_version=d.primary_profile_version) then return; end if;
 v_fingerprint:='current-profile:'||b.build_version||':'||d.definition_version||':'||d.primary_profile_version;
 begin
  perform public.change_character_disciplines_v3(p_user_id,p_character_id,b.build_version,true,b.primary_discipline_id,false,null,v_key,v_fingerprint);
 exception when invalid_parameter_value then
  if sqlerrm not in ('CHARACTER_ATTRIBUTE_DISCIPLINE_CAP_EXCEEDED','CHARACTER_ATTRIBUTE_CONVERSION_REQUIRED') then raise; end if;
  -- Keep every personal point until the player accepts a legal free conversion.
  -- Existing totals stay intact while the conversion panel uses the new bases.
  perform public.change_character_disciplines_v2(p_user_id,p_character_id,b.build_version,true,b.primary_discipline_id,false,null,v_key,v_fingerprint);
  update app_private.character_attribute_personal_allocations set primary_profile_version=d.primary_profile_version,conversion_required=true,updated_at=clock_timestamp()
    where character_id=p_character_id and user_id=p_user_id;
 end;
exception when lock_not_available then
 raise exception using errcode='PT409',message='COMBAT_CONTENT_ADMISSION_RETRY';
end; $$;
revoke all on function app_private.refresh_character_primary_profile_v1(uuid,uuid) from public,anon,authenticated,service_role;

-- Retain the complete slot/deletion contract and keep the historical v2 reader.
do $migration$
declare body text;
begin
 body:=pg_get_functiondef('public.get_character_slots_v2(uuid)'::regprocedure);
 body:=replace(body,'public.get_character_slots_v2(', 'public.get_character_slots_v3(');
 if strpos(body,E'  return query\n')=0 then raise exception 'CURRENT_CHARACTER_ENTRY_PREDECESSOR_CONFLICT'; end if;
 body:=replace(body,E'  return query\n',E'  perform app_private.refresh_character_primary_profile_v1(p_user_id,c.id) from public.characters c where c.user_id=p_user_id order by c.id;\n  return query\n');
 execute body;
end; $migration$;
revoke all on function public.get_character_slots_v3(uuid) from public,anon,authenticated;
grant execute on function public.get_character_slots_v3(uuid) to service_role;
-- A pending free conversion is an authority boundary, not merely a forced UI.
-- Existing participant rows and captured encounters are untouched.
do $migration$
declare body text; predecessor text:='select build_version into v_version from app_private.character_active_builds';
begin
 body:=pg_get_functiondef('app_private.guard_player_battle_admission_v1()'::regprocedure);
 if strpos(body,predecessor)=0 then raise exception 'PROFILE_RECONCILIATION_ADMISSION_PREDECESSOR_CONFLICT'; end if;
 body:=replace(body,predecessor,$guard$if exists(select 1 from app_private.character_attribute_personal_allocations where character_id=new.character_id and user_id=new.user_id and conversion_required) then
   raise exception using errcode='22023',message='CHARACTER_CORE_CONVERSION_REQUIRED';
 end if;
 $guard$||predecessor);
 execute body;
end; $migration$;
commit;
