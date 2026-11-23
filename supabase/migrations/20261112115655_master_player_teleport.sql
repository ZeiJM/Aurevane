begin;

-- A bounded, immutable cache of trusted server geography, never a browser upload.
-- The release identity must change when collision or safety geometry changes.
create table app_private.master_teleport_geometry (
 geometry_version text not null,
 sector_id text not null,
 realm_id text,
 sector_number integer not null,
 rows jsonb not null,
 safe_cells jsonb not null,
 geometry_hash text not null,
 primary key(geometry_version,sector_id),
 unique(geometry_version,realm_id,sector_number),
 check(geometry_version='2026-11-12-v1'),
 check(realm_id is null or realm_id in ('ivory-veil','amber-drowned','cinder-choir','glass-tides','hollow-orchard','starfall-basin','violet-estuary','clockwound-waste')),
 check(sector_number between 1 and case when realm_id is null then 8192 else 768 end),
 check(jsonb_typeof(rows)='array' and jsonb_array_length(rows)=9),
 check(jsonb_typeof(safe_cells)='array' and jsonb_array_length(safe_cells)<=117)
);
create unique index master_teleport_mainland_number on app_private.master_teleport_geometry(geometry_version,sector_number) where realm_id is null;
alter table app_private.master_teleport_geometry enable row level security;
revoke all on app_private.master_teleport_geometry from public,anon,authenticated,service_role;

create function public.install_master_teleport_geometry_v1(
 p_actor_user_id uuid,p_geometry_version text,p_geometry jsonb,p_actor_character_id uuid
) returns void language plpgsql security definer set search_path='' as $$
declare entry jsonb; realm text; number integer; geometry_hash text; existing_hash text;
begin
 perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'players.manage');
 if p_geometry_version is distinct from '2026-11-12-v1' or jsonb_typeof(p_geometry) is distinct from 'array'
 or jsonb_array_length(p_geometry) not between 1 and 8 then raise exception using errcode='22023',message='PLAYER_TELEPORT_GEOMETRY_INVALID'; end if;
 for entry in select value from jsonb_array_elements(p_geometry) loop
  if jsonb_typeof(entry) is distinct from 'object' or not entry ?& array['sectorId','realmId','sectorNumber','rows','safeCells']
  or (select count(*) from jsonb_object_keys(entry))<>5
  or jsonb_typeof(entry->'sectorId') is distinct from 'string' or length(entry->>'sectorId') not between 1 and 160
  or jsonb_typeof(entry->'sectorNumber') is distinct from 'number' or (entry->>'sectorNumber')!~'^[1-9][0-9]{0,3}$'
  or jsonb_typeof(entry->'rows') is distinct from 'array' or jsonb_array_length(entry->'rows')<>9
  or exists(select 1 from jsonb_array_elements(entry->'rows') r where jsonb_typeof(r)<>'string' or length(r#>>'{}')<>13)
  or jsonb_typeof(entry->'safeCells') is distinct from 'array' or jsonb_array_length(entry->'safeCells')>117
  or exists(select 1 from jsonb_array_elements(entry->'safeCells') c where jsonb_typeof(c)<>'number' or c::text!~'^(0|[1-9][0-9]{0,2})$' or (c::text)::integer>116)
  then raise exception using errcode='22023',message='PLAYER_TELEPORT_GEOMETRY_INVALID'; end if;
  realm:=entry->>'realmId'; number:=(entry->>'sectorNumber')::integer;
  if (realm is null and entry->'realmId'<>'null'::jsonb) or number>(case when realm is null then 8192 else 768 end)
  or (realm is not null and (realm not in ('ivory-veil','amber-drowned','cinder-choir','glass-tides','hollow-orchard','starfall-basin','violet-estuary','clockwound-waste')
    or entry->>'sectorId' is distinct from 'void:'||realm||':'||((number-1)%32)::text||':'||((number-1)/32)::text))
  then raise exception using errcode='22023',message='PLAYER_TELEPORT_GEOMETRY_INVALID'; end if;
  geometry_hash:=encode(sha256(convert_to(entry::text,'UTF8')),'hex');
  insert into app_private.master_teleport_geometry(geometry_version,sector_id,realm_id,sector_number,rows,safe_cells,geometry_hash)
   values(p_geometry_version,entry->>'sectorId',realm,number,entry->'rows',entry->'safeCells',geometry_hash) on conflict do nothing;
  select g.geometry_hash into existing_hash from app_private.master_teleport_geometry g where g.geometry_version=p_geometry_version and g.sector_id=entry->>'sectorId';
  if existing_hash is distinct from geometry_hash then raise exception using errcode='PT409',message='PLAYER_TELEPORT_GEOMETRY_CONFLICT'; end if;
 end loop;
end; $$;

alter table app_private.player_support_audit drop constraint player_support_audit_action_check;
alter table app_private.player_support_audit add constraint player_support_audit_action_check check(action in ('player.edit','battle.no-contest','player.teleport'));

create function public.teleport_master_player_v1(
 p_actor_user_id uuid,p_character_id uuid,p_expected_version bigint,p_request_key uuid,
 p_map text,p_sector_number integer,p_x integer,p_y integer,p_reason text,p_confirmed boolean,p_actor_character_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.characters%rowtype; world app_private.character_world_state%rowtype;
 geometry app_private.master_teleport_geometry%rowtype; prior app_private.player_support_audit%rowtype;
 request_hash text; realm text; now_ms bigint; before_state jsonb; next_state jsonb; destination jsonb; result jsonb; reveal jsonb;
begin
 perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'players.manage');
 if p_reason is null or char_length(trim(p_reason)) not between 3 and 240 then raise exception using errcode='22023',message='PLAYER_TELEPORT_REASON_REQUIRED'; end if;
 p_reason:=trim(p_reason);
 if p_confirmed is distinct from true or p_request_key is null or p_expected_version is null or p_expected_version<0
 or p_map is null or p_map not in ('mainland','currentVoid') or p_sector_number is null or p_sector_number not between 1 and (case when p_map='mainland' then 8192 else 768 end)
 or p_x is null or p_x not between 0 and 12 or p_y is null or p_y not between 0 and 8 then raise exception using errcode='22023',message='PLAYER_TELEPORT_DESTINATION_INVALID'; end if;
 select * into target from public.characters where id=p_character_id;
 if not found then raise exception using errcode='22023',message='PLAYER_NOT_FOUND'; end if;
 -- Account admission serializes against movement, ferry boarding/settlement and battle entry.
 -- NOWAIT secondary locks avoid inversion with retained session-first settlement paths.
 if not pg_try_advisory_xact_lock(hashtextextended(target.user_id::text,1)) then raise exception using errcode='PT409',message='PLAYER_TELEPORT_RETRY'; end if;
 select * into target from public.characters where id=p_character_id for update nowait;
 select * into world from app_private.character_world_state where character_id=p_character_id for update nowait;
 request_hash:=encode(sha256(convert_to(jsonb_build_object('operation','teleport','target',p_character_id,'expected',p_expected_version,'map',p_map,'sector',p_sector_number,'x',p_x,'y',p_y,'reason',p_reason)::text,'UTF8')),'hex');
 select * into prior from app_private.player_support_audit where actor_user_id=p_actor_user_id and request_key=p_request_key;
 if found then
  if prior.action<>'player.teleport' or prior.request_hash<>request_hash or prior.character_id<>p_character_id then raise exception using errcode='22023',message='PLAYER_IDEMPOTENCY_CONFLICT'; end if;
  return prior.after_facts||jsonb_build_object('replayed',true);
 end if;
 if exists(select 1 from app_private.character_deletion_requests where character_id=p_character_id)
 or exists(select 1 from app_private.account_deletion_requests where user_id=target.user_id) then raise exception using errcode='22023',message='PLAYER_DELETION_PENDING'; end if;
 if coalesce((world.state->>'version')::bigint,0) is distinct from p_expected_version then raise exception using errcode='PT409',message='PLAYER_TELEPORT_VERSION_STALE'; end if;
 perform 1 from app_private.battle_sessions b where b.lifecycle in ('pending','active') and (b.owner_user_id=target.user_id or exists(select 1 from app_private.battle_participants p where p.battle_session_id=b.id and p.user_id=target.user_id)) for update nowait;
 if found then raise exception using errcode='22023',message='PLAYER_BATTLE_ACTIVE'; end if;
 if world.state->'ferry' is not null and world.state->'ferry'<>'null'::jsonb then raise exception using errcode='22023',message='PLAYER_TELEPORT_FERRY'; end if;
 if p_map='currentVoid' then
  if not pg_try_advisory_xact_lock(hashtextextended('world-environment',0)) then raise exception using errcode='PT409',message='PLAYER_TELEPORT_ROTATION_RETRY'; end if;
  perform 1 from app_private.world_environment_settings for update nowait;
  now_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  realm:=app_private.world_void_rotation_v1(now_ms)->>'realmId';
  if realm is null then raise exception using errcode='22023',message='PLAYER_TELEPORT_DESTINATION_UNAVAILABLE'; end if;
 end if;
 select * into geometry from app_private.master_teleport_geometry g where g.geometry_version='2026-11-12-v1'
  and g.realm_id is not distinct from realm and g.sector_number=p_sector_number;
 if not found or substr(geometry.rows->>p_y,p_x+1,1) not in ('.','=','s','t') then raise exception using errcode='22023',message='PLAYER_TELEPORT_DESTINATION_BLOCKED'; end if;
 destination:=jsonb_build_object('sectorId',geometry.sector_id,'x',p_x,'y',p_y);
 before_state:=world.state;
 next_state:=coalesce(before_state,jsonb_build_object('discoveries','{}'::jsonb,'discoveredAnchors','[]'::jsonb,'completedObjectives','[]'::jsonb,'objectiveProgress','{}'::jsonb));
 next_state:=(next_state-'ferry'-'warpedPhase')||jsonb_build_object('position',destination,'version',p_expected_version+1,
  'route','[]'::jsonb,'routeDestination',null,'routeObjectiveId',null,'nextStepAt',null,
  'safe',geometry.safe_cells @> jsonb_build_array(p_y*13+p_x));
 -- Match ordinary arrival reveal: radius two, no landmarks/quests/whole-map revelation.
 select jsonb_agg(cell order by cell) into reveal from (
  select distinct cell from (
   select value::integer cell from jsonb_array_elements_text(coalesce(next_state#>array['discoveries',geometry.sector_id],'[]'::jsonb))
   union all select y*13+x from generate_series(greatest(0,p_y-2),least(8,p_y+2)) y cross join generate_series(greatest(0,p_x-2),least(12,p_x+2)) x
  ) combined
 ) known;
 next_state:=jsonb_set(next_state,array['discoveries',geometry.sector_id],reveal,true);
 insert into app_private.character_world_state(character_id,state,last_seen_at) values(p_character_id,next_state,coalesce(world.last_seen_at,'-infinity'::timestamptz))
 on conflict(character_id) do update set state=excluded.state,last_command_id=null,last_command_fingerprint=null;
 result:=jsonb_build_object('position',destination,'version',p_expected_version+1,'replayed',false,'reason',p_reason);
 insert into app_private.player_support_audit(actor_user_id,actor_character_id,character_id,action,request_key,request_hash,before_facts,after_facts)
 values(p_actor_user_id,p_actor_character_id,p_character_id,'player.teleport',p_request_key,request_hash,
 jsonb_build_object('position',before_state->'position','version',coalesce((before_state->>'version')::bigint,0)),result);
 return result;
end; $$;

-- The existing activity trigger keeps the same actor/subject privacy projection.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('app_private.capture_master_panel_activity_v1()'::regprocedure);
 if strpos(definition,'when ''battle.no-contest'' then ''Recovered battle''')=0 then raise exception 'TELEPORT_ACTIVITY_PREDECESSOR'; end if;
 definition:=replace(definition,'when ''battle.no-contest'' then ''Recovered battle''','when ''battle.no-contest'' then ''Recovered battle'' when ''player.teleport'' then ''Teleported player''');
 execute definition;
end; $$;

revoke all on function public.install_master_teleport_geometry_v1(uuid,text,jsonb,uuid),public.teleport_master_player_v1(uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.install_master_teleport_geometry_v1(uuid,text,jsonb,uuid),public.teleport_master_player_v1(uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid) to service_role;

commit;
