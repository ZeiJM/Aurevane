begin;

-- Keep the installed v1 rows and hashes immutable. The new release is inserted
-- alongside them, allowing migration-first rollout while old application instances finish.
alter table app_private.master_teleport_geometry drop constraint master_teleport_geometry_geometry_version_check;
alter table app_private.master_teleport_geometry add constraint master_teleport_geometry_geometry_version_check
 check(geometry_version in ('2026-11-12-v1','2026-11-12-v2'));
do $$ declare constraint_name text; begin
 select conname into strict constraint_name from pg_constraint where conrelid='app_private.master_teleport_geometry'::regclass
  and contype='c' and pg_get_constraintdef(oid) like '%sector_number%';
 execute format('alter table app_private.master_teleport_geometry drop constraint %I',constraint_name);
end; $$;
alter table app_private.master_teleport_geometry add constraint master_teleport_geometry_sector_number_check
 check(sector_number between 1 and case when realm_id is null then 8192 when geometry_version='2026-11-12-v2' then 3072 else 768 end);

do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.install_master_teleport_geometry_v1(uuid,text,jsonb,uuid)'::regprocedure);
 if strpos(definition,'p_geometry_version is distinct from ''2026-11-12-v1''')=0 then raise exception 'TELEPORT_GEOMETRY_PREDECESSOR'; end if;
 definition:=replace(definition,'p_geometry_version is distinct from ''2026-11-12-v1''','(p_geometry_version is null or p_geometry_version not in (''2026-11-12-v1'',''2026-11-12-v2''))');
 definition:=replace(definition,'case when realm is null then 8192 else 768 end','case when realm is null then 8192 when p_geometry_version=''2026-11-12-v2'' then 3072 else 768 end');
 definition:=replace(definition,'((number-1)%32)::text','((number-1)%(case when p_geometry_version=''2026-11-12-v2'' then 64 else 32 end))::text');
 definition:=replace(definition,'((number-1)/32)::text','((number-1)/(case when p_geometry_version=''2026-11-12-v2'' then 64 else 32 end))::text');
 execute definition;

 definition:=pg_get_functiondef('public.teleport_master_player_v1(uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid)'::regprocedure);
 if strpos(definition,'g.geometry_version=''2026-11-12-v1''')=0 then raise exception 'TELEPORT_COMMIT_PREDECESSOR'; end if;
 definition:=replace(definition,'teleport_master_player_v1(','teleport_master_player_v2(');
 definition:=replace(definition,'''operation'',''teleport''','''operation'',''teleport-v2''');
 definition:=replace(definition,'case when p_map=''mainland'' then 8192 else 768 end','case when p_map=''mainland'' then 8192 else 3072 end');
 definition:=replace(definition,'g.geometry_version=''2026-11-12-v1''','g.geometry_version=''2026-11-12-v2''' );
 definition:=replace(definition,'not in (''.'',''='',''s'',''t'')','not in (''.'',''='',''s'',''t'',''w'')');
 execute definition;
end; $$;

-- The old entrypoint keeps its original release and numbering. New instances
-- call v2 explicitly, so concurrent old/new servers cannot reinterpret a destination.
revoke all on function public.teleport_master_player_v2(uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.teleport_master_player_v2(uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid) to service_role;

commit;
