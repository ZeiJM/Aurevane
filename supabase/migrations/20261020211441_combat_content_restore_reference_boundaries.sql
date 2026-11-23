begin;
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('app_private.index_content_references_v1()'::regprocedure);
 old:=$before$where r.content_key=target and r.lifecycle='archived')$before$;
 if strpos(d,old)=0 then raise exception 'CONTENT_SELF_RESTORE_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,$after$where r.content_key=target and r.lifecycle='archived' and not (target=new.content_key and r.restore_pending))$after$);
 d:=pg_get_functiondef('public.write_combat_content_record_v1(uuid,uuid,text,jsonb)'::regprocedure);
 old:=$before$if r.content_kind<>'discipline' or r.lifecycle='archived' or source.content_kind<>'skill' or source.lifecycle='archived' or source.content_key is null then$before$;
 if strpos(d,old)=0 then raise exception 'CONTENT_UNLINK_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,$after$if r.content_kind<>'discipline' or source.content_kind<>'skill' or source.content_key is null or (v_action='link' and (r.lifecycle='archived' or source.lifecycle='archived')) then$after$);
end; $migration$;
commit;
