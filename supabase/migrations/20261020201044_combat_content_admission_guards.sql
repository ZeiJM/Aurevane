begin;
-- Ordinary grant/build writers can already hold character locks. Never wait on
-- the catalogue lock here: archive owns it exclusively and must not invert that
-- order. Independent ordinary writers share the lock and proceed concurrently.
create function app_private.guard_combat_content_admission_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_keys text[]; v_key text; v_row jsonb:=to_jsonb(new); v_skill jsonb;
begin
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('combat-catalogue-publication',0)) then
  raise exception using errcode='40001',message='COMBAT_CONTENT_ADMISSION_RETRY'; end if;
 if tg_table_name='character_saved_build_loadouts' then
  v_keys:=array[v_row->>'primary_discipline_id',v_row->>'secondary_discipline_id'];
  for v_skill in select value from jsonb_array_elements(v_row->'discipline_skills') loop
   v_keys:=v_keys||array[v_skill->>'skillId',v_skill->>'sourceDisciplineId',v_skill->>'eligibilityDisciplineId'];
  end loop;
 else v_keys:=array[v_row->>'skill_id',v_row->>'source_discipline_id',v_row->>'discipline_id']; end if;
 foreach v_key in array v_keys loop
  if exists(select 1 from app_private.combat_content_records where content_key=v_key and lifecycle='archived') then
   raise exception using errcode='22023',message='COMBAT_CONTENT_ARCHIVED'; end if;
 end loop;
 return new;
end; $$;
create trigger combat_content_admission before insert or update on app_private.character_skill_unlocks for each row execute function app_private.guard_combat_content_admission_v1();
create trigger combat_content_admission before insert or update on app_private.character_build_discipline_skills for each row execute function app_private.guard_combat_content_admission_v1();
create trigger combat_content_admission before insert or update on app_private.character_saved_build_loadouts for each row execute function app_private.guard_combat_content_admission_v1();
create trigger combat_content_admission before insert or update on app_private.phase4_skill_catalog for each row execute function app_private.guard_combat_content_admission_v1();
revoke all on function app_private.guard_combat_content_admission_v1() from public,anon,authenticated,service_role;

-- Current readers must distinguish a tombstone from absent legacy data. Exact
-- history readers intentionally remain unchanged for pinned encounters.
create function app_private.assert_combat_content_current_v1(p_keys text[])
returns void language plpgsql stable security definer set search_path='' as $$
begin
 if exists(select 1 from app_private.combat_content_records where content_key=any(p_keys) and lifecycle='archived') then
  raise exception using errcode='22023',message='COMBAT_CONTENT_ARCHIVED'; end if;
end; $$;
revoke all on function app_private.assert_combat_content_current_v1(text[]) from public,anon,authenticated,service_role;

do $migration$
declare v_signature text; v_definition text; v_body text; v_keys text;
begin
 foreach v_signature in array array['public.read_current_combat_content_v1(text,text)','public.read_current_combat_content_many_v1(text[],text)'] loop
  v_definition:=pg_get_functiondef(v_signature::regprocedure);
  if strpos(v_definition,'LANGUAGE sql')=0 then raise exception 'CONTENT_CURRENT_PREDECESSOR_CONFLICT'; end if;
  v_keys:=case when strpos(v_signature,'many')>0 then 'p_content_keys' else 'array[p_content_key]' end;
  v_body:=split_part(split_part(v_definition,'AS $function$',2),'$function$',1);
  v_definition:=replace(v_definition,'LANGUAGE sql','LANGUAGE plpgsql');
  v_definition:=replace(v_definition,v_body,E'\nbegin\n perform app_private.assert_combat_content_current_v1('||v_keys||E');\n return query\n'||v_body||E'\nend;\n');
  execute v_definition;
 end loop;
end; $migration$;

-- Also guard immutable intrinsic source when there is no current draft (the
-- common first save following publication), using existing physical history.
create function app_private.guard_combat_content_intrinsic_source_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_original jsonb;
begin
 if new.content_kind='skill' then
  select definition->'sourceDisciplineId' into v_original from app_private.combat_content_versions where content_key=new.content_key order by content_version limit 1;
  if found and v_original is distinct from new.definition->'sourceDisciplineId' then
   raise exception using errcode='22023',message='COMBAT_CONTENT_SOURCE_IMMUTABLE'; end if;
 end if;
 return new;
end; $$;
create trigger combat_content_intrinsic_source before insert or update on app_private.combat_content_drafts for each row execute function app_private.guard_combat_content_intrinsic_source_v1();
revoke all on function app_private.guard_combat_content_intrinsic_source_v1() from public,anon,authenticated,service_role;
commit;
