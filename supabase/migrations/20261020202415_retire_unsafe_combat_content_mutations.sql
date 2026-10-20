begin;
-- Preserve every exact old signature and its ACL. Authority still runs first,
-- including Owner/bootstrap and selected-character overloads. A caller body or
-- pointer rollback cannot bypass the saved-record transaction after this point.
do $migration$
declare proc record; v_definition text; v_body text; v_assert text; v_error text; v_count integer:=0;
begin
 for proc in select p.oid,p.proname,p.proargnames from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','app_private') and p.proname in ('save_combat_content_draft_v1','publish_combat_content_v1','publish_combat_content_v2','publish_combat_content_v3','set_combat_content_publication_v1','set_combat_content_publication_v2','publish_combat_content_with_floor_v1') loop
  v_count:=v_count+1;
  v_definition:=pg_get_functiondef(proc.oid);
  if not 'p_actor_user_id'=any(proc.proargnames) or strpos(v_definition,'LANGUAGE plpgsql')=0 then raise exception 'CONTENT_RETIREMENT_PREDECESSOR_CONFLICT'; end if;
  v_assert:='app_private.assert_master_panel_operator_v1(p_actor_user_id'||case when 'p_actor_character_id'=any(proc.proargnames) then ',p_actor_character_id' else '' end||')';
  v_error:=case when proc.proname like 'set_%' then 'COMBAT_CONTENT_RESTORE_TO_DRAFT_REQUIRED' when proc.proname like 'save_%' then 'COMBAT_CONTENT_COMPLETE_RECORD_REQUIRED' else 'COMBAT_CONTENT_SAVED_REVISION_REQUIRED' end;
  v_body:=split_part(split_part(v_definition,'AS $function$',2),'$function$',1);
  if v_body='' then raise exception 'CONTENT_RETIREMENT_PREDECESSOR_CONFLICT'; end if;
  execute replace(v_definition,v_body,E'\nbegin\n perform '||v_assert||E';\n raise exception using errcode=''0A000'',message='||quote_literal(v_error)||E';\nend;\n');
 end loop;
 if v_count<>14 then raise exception 'CONTENT_RETIREMENT_SIGNATURE_INVENTORY_CONFLICT: %',v_count; end if;
end; $migration$;
-- The only new durable authoring writers are the capability-bound RPCs.
revoke insert,update,delete on app_private.combat_content_drafts,app_private.combat_content_publications,app_private.combat_content_versions from service_role;
commit;
