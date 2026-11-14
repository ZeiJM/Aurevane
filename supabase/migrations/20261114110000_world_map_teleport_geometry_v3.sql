begin;

-- A third, immutable, release-specific geometry identity protects staff
-- teleport from newly impassable discovery walls and alpine frontier cells.
-- Keep v1/v2 rows and their RPCs intact for historical requests / blue-green deploys.
alter table app_private.master_teleport_geometry
  drop constraint master_teleport_geometry_geometry_version_check;
alter table app_private.master_teleport_geometry
  add constraint master_teleport_geometry_geometry_version_check
  check (geometry_version in ('2026-11-12-v1', '2026-11-12-v2', '2026-11-14-v3'));

alter table app_private.master_teleport_geometry
  drop constraint master_teleport_geometry_sector_number_check;
alter table app_private.master_teleport_geometry
  add constraint master_teleport_geometry_sector_number_check
  check (sector_number between 1 and
    case when realm_id is null then 8192
      when geometry_version in ('2026-11-12-v2', '2026-11-14-v3') then 3072
      else 768 end);

do $migration$
declare definition text;
begin
  definition := pg_get_functiondef(
    'public.install_master_teleport_geometry_v1(uuid,text,jsonb,uuid)'::regprocedure
  );
  if strpos(definition,
    'p_geometry_version not in (''2026-11-12-v1'',''2026-11-12-v2'')') = 0
    or strpos(definition,
    'p_geometry_version=''2026-11-12-v2''') = 0 then
    raise exception 'TELEPORT_GEOMETRY_V2_PREDECESSOR';
  end if;
  definition := replace(definition,
    'p_geometry_version not in (''2026-11-12-v1'',''2026-11-12-v2'')',
    'p_geometry_version not in (''2026-11-12-v1'',''2026-11-12-v2'',''2026-11-14-v3'')');
  definition := replace(definition,
    'p_geometry_version=''2026-11-12-v2''',
    'p_geometry_version in (''2026-11-12-v2'',''2026-11-14-v3'')');
  execute definition;

  definition := pg_get_functiondef(
    'public.teleport_master_player_v2(uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid)'::regprocedure
  );
  if strpos(definition, 'g.geometry_version=''2026-11-12-v2''') = 0
    or strpos(definition, 'teleport-v2') = 0 then
    raise exception 'TELEPORT_COMMIT_V2_PREDECESSOR';
  end if;
  definition := replace(definition,
    'teleport_master_player_v2(', 'teleport_master_player_v3(');
  definition := replace(definition, 'teleport-v2', 'teleport-v3');
  definition := replace(definition,
    'g.geometry_version=''2026-11-12-v2''',
    'g.geometry_version=''2026-11-14-v3''');
  execute definition;
end
$migration$;

revoke all on function
  public.teleport_master_player_v3(
    uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid
  ) from public, anon, authenticated;
grant execute on function
  public.teleport_master_player_v3(
    uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid
  ) to service_role;

commit;
