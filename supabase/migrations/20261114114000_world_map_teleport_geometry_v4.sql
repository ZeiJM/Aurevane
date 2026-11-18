begin;

-- Release v4 is immutable and tracks the final public arena/valley collision.
-- V1/V2/V3 rows and their original procedures remain available and unchanged.
alter table app_private.master_teleport_geometry
  drop constraint master_teleport_geometry_geometry_version_check;
alter table app_private.master_teleport_geometry
  add constraint master_teleport_geometry_geometry_version_check
  check (geometry_version in (
    '2026-11-12-v1', '2026-11-12-v2', '2026-11-14-v3', '2026-11-14-v4'
  ));
alter table app_private.master_teleport_geometry
  drop constraint master_teleport_geometry_sector_number_check;
alter table app_private.master_teleport_geometry
  add constraint master_teleport_geometry_sector_number_check
  check (sector_number between 1 and case when realm_id is null then 8192
    when geometry_version in ('2026-11-12-v2','2026-11-14-v3','2026-11-14-v4')
      then 3072 else 768 end);

do $migration$
declare definition text;
begin
  definition := pg_get_functiondef(
    'public.install_master_teleport_geometry_v1(uuid,text,jsonb,uuid)'::regprocedure
  );
  if strpos(definition,
    'p_geometry_version not in (''2026-11-12-v1'',''2026-11-12-v2'',''2026-11-14-v3'')') = 0
    or strpos(definition,
    'p_geometry_version in (''2026-11-12-v2'',''2026-11-14-v3'')') = 0
    then raise exception 'TELEPORT_GEOMETRY_V3_PREDECESSOR'; end if;
  definition := replace(definition,
    'p_geometry_version not in (''2026-11-12-v1'',''2026-11-12-v2'',''2026-11-14-v3'')',
    'p_geometry_version not in (''2026-11-12-v1'',''2026-11-12-v2'',''2026-11-14-v3'',''2026-11-14-v4'')');
  definition := replace(definition,
    'p_geometry_version in (''2026-11-12-v2'',''2026-11-14-v3'')',
    'p_geometry_version in (''2026-11-12-v2'',''2026-11-14-v3'',''2026-11-14-v4'')');
  execute definition;

  definition := pg_get_functiondef(
    'public.teleport_master_player_v3(uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid)'::regprocedure
  );
  if strpos(definition,'g.geometry_version=''2026-11-14-v3''') = 0
    or strpos(definition,'teleport-v3') = 0
    or strpos(definition,
      'now_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;') = 0
    then raise exception 'TELEPORT_COMMIT_V3_PREDECESSOR'; end if;
  definition := replace(definition,
    'teleport_master_player_v3(', 'teleport_master_player_v4(');
  definition := replace(definition,'teleport-v3','teleport-v4');
  definition := replace(definition,
    'g.geometry_version=''2026-11-14-v3''',
    'g.geometry_version=''2026-11-14-v4''');
  definition := replace(definition,
    'now_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;',
    'now_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;' || chr(10) ||
    '  if app_private.world_void_return_due_v1(world.state,now_ms)' ||
    ' or now_ms>=app_private.world_void_cutoff_v1(now_ms) then' ||
    ' raise exception ''WORLD_VOID_RETURN_DUE'' using errcode=''PT409''; end if;');
  execute definition;
end;
$migration$;

revoke all on function public.teleport_master_player_v4(
  uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid
) from public,anon,authenticated;
grant execute on function public.teleport_master_player_v4(
  uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid
) to service_role;
commit;
