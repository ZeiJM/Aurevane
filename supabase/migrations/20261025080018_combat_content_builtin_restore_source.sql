begin;
-- An executable system baseline is a distinct restore source, not a fabricated
-- historical publication. The service resolves its complete exact definition;
-- browser roles cannot call this RPC or provide sourceDefinition through HTTP.
-- Keep the existing catalogue lock, selected-character authority and record CAS.
alter table app_private.combat_content_records add column restored_source text check (restored_source = 'builtin');
alter table app_private.combat_content_attribution add column restored_source text check (restored_source = 'builtin');
do $migration$
declare d text; old text;
begin
 d := pg_get_functiondef('app_private.validate_content_command_v1(jsonb)'::regprocedure);
 old := $before$when 'restore' then array['action','expectedRevision','sourceVersion']$before$;
 if strpos(d,old)=0 then raise exception 'BUILTIN_RESTORE_COMMAND_PREDECESSOR_CONFLICT'; end if;
 d := replace(d,old,$after$when 'restore' then array['action','expectedRevision','sourceVersion','sourceKind','sourceDefinition']$after$);
 old := 'else allowed end;';
 if strpos(d,old)=0 then raise exception 'BUILTIN_RESTORE_REQUIRED_PREDECESSOR_CONFLICT'; end if;
 d := replace(d,old,$after$when a='restore' then array['action','expectedRevision','sourceVersion'] else allowed end;
 if a='restore' and ((c?'sourceKind')<>(c?'sourceDefinition') or (c?'sourceKind' and c->>'sourceKind' is distinct from 'builtin')) then raise exception using errcode='22023',message='COMBAT_CONTENT_COMMAND_INVALID'; end if;$after$);
 execute d;
 d := pg_get_functiondef('public.write_combat_content_record_v1(uuid,uuid,text,jsonb)'::regprocedure);
 old := $before$   select * into v_version from app_private.combat_content_versions where content_key=p_content_key and content_version=(p_command->>'sourceVersion')::integer;
   if not found then raise exception using errcode='22023',message='COMBAT_CONTENT_VERSION_NOT_FOUND'; end if;
   v_definition:=v_version.definition;
   update app_private.combat_content_records set restored_from=v_version.content_version,restored_by=p_actor_user_id,restore_pending=true where content_key=p_content_key;$before$;
 if strpos(d,old)=0 then raise exception 'BUILTIN_RESTORE_WRITE_PREDECESSOR_CONFLICT'; end if;
 d := replace(d,old,$after$   if p_command->>'sourceKind' = 'builtin' then
    if r.builtin_version is null or r.builtin_version is distinct from (p_command->>'sourceVersion')::integer then raise exception using errcode='22023',message='COMBAT_CONTENT_BUILTIN_SOURCE_INVALID'; end if;
    v_definition := p_command->'sourceDefinition';
    perform app_private.validate_content_record_identity_v1(p_content_key,r.content_kind,v_definition);
    if v_definition->'contentVersion' is distinct from to_jsonb(r.builtin_version) or v_definition->>'sourceDisciplineId' is distinct from r.builtin_source_discipline_id then raise exception using errcode='22023',message='COMBAT_CONTENT_BUILTIN_SOURCE_INVALID'; end if;
    update app_private.combat_content_records set restored_from=r.builtin_version,restored_by=p_actor_user_id,restored_source='builtin',restore_pending=true where content_key=p_content_key;
   else
    select * into v_version from app_private.combat_content_versions where content_key=p_content_key and content_version=(p_command->>'sourceVersion')::integer;
    if not found then raise exception using errcode='22023',message='COMBAT_CONTENT_VERSION_NOT_FOUND'; end if;
    v_definition:=v_version.definition;
    update app_private.combat_content_records set restored_from=v_version.content_version,restored_by=p_actor_user_id,restored_source=null,restore_pending=true where content_key=p_content_key;
   end if;$after$);
 old := $before$  elsif v_action='save' then$before$;
 if strpos(d,old)=0 then raise exception 'BUILTIN_RESTORE_SAVE_PREDECESSOR_CONFLICT'; end if;
 d := replace(d,old,old||$after$
   update app_private.combat_content_records set restored_from=null,restored_by=null,restored_source=null where content_key=p_content_key;$after$);
 execute d;
 d := pg_get_functiondef('public.publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer)'::regprocedure);
 old := 'insert into app_private.combat_content_attribution values(v_id,v_author,v_authored_at,r.restored_from,r.restored_by);';
 if strpos(d,old)=0 then raise exception 'BUILTIN_RESTORE_PUBLISH_PREDECESSOR_CONFLICT'; end if;
 d := replace(d,old,$after$if r.restored_source='builtin' then v_author:=null; v_authored_at:=null; end if;
 insert into app_private.combat_content_attribution(version_id,authored_by,authored_at,restored_from,restored_by,restored_source) values(v_id,v_author,v_authored_at,r.restored_from,r.restored_by,r.restored_source);$after$);
 d := replace(d,'restored_from=null,restored_by=null,updated_by=','restored_from=null,restored_by=null,restored_source=null,updated_by=');
 execute d;
 d := pg_get_functiondef('app_private.combat_content_record_json_v1(text)'::regprocedure);
 old := $before$'restoredBy',r.restored_by$before$;
 if strpos(d,old)=0 then raise exception 'BUILTIN_RESTORE_JSON_PREDECESSOR_CONFLICT'; end if;
 d := replace(d,old,old||$after$,'restoredSource',r.restored_source$after$);
 d := replace(d,$before$'restoredBy',a.restored_by$before$,$after$'restoredBy',a.restored_by,'restoredSource',a.restored_source$after$);
 d := replace(d,$before$a.restored_by as "restoredBy"$before$,$after$a.restored_by as "restoredBy",a.restored_source as "restoredSource"$after$);
 execute d;
end; $migration$;
commit;
