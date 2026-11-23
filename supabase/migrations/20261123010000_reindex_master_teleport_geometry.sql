begin;

-- Bind sequential mainland chart numbers and new coast geometry to an immutable version.
alter table app_private.master_teleport_geometry
  drop constraint master_teleport_geometry_geometry_version_check;
alter table app_private.master_teleport_geometry
  add constraint master_teleport_geometry_geometry_version_check
  check (geometry_version in (
    '2026-11-12-v1', '2026-11-12-v2', '2026-11-14-v3', '2026-11-14-v4', '2026-11-18-v5', '2026-11-23-v6'
  ));
alter table app_private.master_teleport_geometry
  drop constraint master_teleport_geometry_sector_number_check;
alter table app_private.master_teleport_geometry
  add constraint master_teleport_geometry_sector_number_check
  check (sector_number between 1 and case when realm_id is null then 8192
    when geometry_version in ('2026-11-12-v2','2026-11-14-v3','2026-11-14-v4', '2026-11-18-v5', '2026-11-23-v6')
      then 3072 else 768 end);

do $migration$
declare
  definition text;
  versions text := $versions$'2026-11-12-v1','2026-11-12-v2','2026-11-14-v3','2026-11-14-v4','2026-11-18-v5'$versions$;
  expanded text := versions || $new$,'2026-11-23-v6'$new$;
begin
  definition := pg_get_functiondef(
    'public.install_master_teleport_geometry_v1(uuid,text,jsonb,uuid)'::regprocedure
  );
  if strpos(definition, 'p_geometry_version not in (' || versions || ')') = 0
    or strpos(definition, $realm$'2026-11-12-v2','2026-11-14-v3','2026-11-14-v4','2026-11-18-v5'$realm$) = 0
    then raise exception 'TELEPORT_GEOMETRY_V5_PREDECESSOR'; end if;
  definition := replace(definition, versions, expanded);
  definition := replace(definition,
    $realm$when p_geometry_version in ('2026-11-12-v2','2026-11-14-v3','2026-11-14-v4','2026-11-18-v5')$realm$,
    $realm$when p_geometry_version in ('2026-11-12-v2','2026-11-14-v3','2026-11-14-v4','2026-11-18-v5','2026-11-23-v6')$realm$);
  execute definition;

  definition := pg_get_functiondef(
    'public.teleport_master_player_v5(uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid)'::regprocedure
  );
  if strpos(definition, 'g.geometry_version=''2026-11-18-v5''') = 0
    then raise exception 'TELEPORT_COMMIT_V5_PREDECESSOR'; end if;
  definition := replace(definition, 'teleport_master_player_v5(', 'teleport_master_player_v6(');
  definition := replace(definition, 'teleport-v5', 'teleport-v6');
  definition := replace(definition, 'g.geometry_version=''2026-11-18-v5''',
    'g.geometry_version=''2026-11-23-v6''');
  execute definition;
end;
$migration$;

revoke all on function public.teleport_master_player_v6(
  uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid
) from public,anon,authenticated;
grant execute on function public.teleport_master_player_v6(
  uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid
) to service_role;
commit;
