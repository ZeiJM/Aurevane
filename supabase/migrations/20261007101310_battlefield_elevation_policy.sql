begin;
create table app_private.battlefield_elevation_policy_versions (
  version integer primary key check (version > 0),
  level1_basis_points integer not null check (level1_basis_points between 0 and 10000),
  level2_basis_points integer not null check (level2_basis_points between 0 and 10000),
  level3_basis_points integer not null check (level3_basis_points between 0 and 10000),
  published_by uuid,
  reason text not null check (char_length(btrim(reason)) between 1 and 240),
  published_at timestamptz not null default clock_timestamp(),
  check (level1_basis_points + level2_basis_points + level3_basis_points = 10000)
);
alter table app_private.battlefield_elevation_policy_versions enable row level security;
revoke all on app_private.battlefield_elevation_policy_versions from public, anon, authenticated, service_role;
insert into app_private.battlefield_elevation_policy_versions(version,level1_basis_points,level2_basis_points,level3_basis_points,reason)
values (1,6000,3000,1000,'Owner-approved independent raised tile chances: 60% / 30% / 10%.');

-- Narrow server-only RPCs match existing audited Owner combat settings authority.
create function public.read_battlefield_elevation_policy_v1()
returns jsonb language sql stable security definer
set search_path = pg_catalog, public, app_private
as $$
  select jsonb_build_object('version',version,'level1BasisPoints',level1_basis_points,'level2BasisPoints',level2_basis_points,'level3BasisPoints',level3_basis_points)
  from app_private.battlefield_elevation_policy_versions order by version desc limit 1;
$$;
create function public.publish_battlefield_elevation_policy_v1(p_actor_user_id uuid,p_expected_version integer,p_chances jsonb,p_reason text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_version integer;
  v_one integer;
  v_two integer;
  v_three integer;
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);
  if p_chances is null or jsonb_typeof(p_chances) <> 'object' or p_reason is null or char_length(btrim(p_reason)) not between 1 and 240 then
    raise exception 'INVALID_ELEVATION_POLICY';
  end if;
  if (select count(*) from jsonb_object_keys(p_chances)) <> 3 or not (p_chances ?& array['level1BasisPoints','level2BasisPoints','level3BasisPoints']) or
    exists (select 1 from jsonb_each(p_chances) item where jsonb_typeof(item.value) <> 'number' or item.value::text !~ '^[0-9]{1,5}$') then
    raise exception 'INVALID_ELEVATION_POLICY';
  end if;
  v_one := (p_chances->>'level1BasisPoints')::integer;
  v_two := (p_chances->>'level2BasisPoints')::integer;
  v_three := (p_chances->>'level3BasisPoints')::integer;
  if v_one not between 0 and 10000 or v_two not between 0 and 10000 or v_three not between 0 and 10000 or v_one+v_two+v_three <> 10000 then
    raise exception 'INVALID_ELEVATION_POLICY';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('battlefield-elevation-policy',0));
  select max(version) into v_version from app_private.battlefield_elevation_policy_versions;
  if p_expected_version is null or v_version <> p_expected_version then raise exception 'ELEVATION_POLICY_VERSION_CONFLICT'; end if;
  insert into app_private.battlefield_elevation_policy_versions(version,level1_basis_points,level2_basis_points,level3_basis_points,published_by,reason)
  values (v_version+1,v_one,v_two,v_three,p_actor_user_id,btrim(p_reason));
  return jsonb_build_object('version',v_version+1,'level1BasisPoints',v_one,'level2BasisPoints',v_two,'level3BasisPoints',v_three);
end;
$$;
revoke all on function public.read_battlefield_elevation_policy_v1() from public, anon, authenticated;
revoke all on function public.publish_battlefield_elevation_policy_v1(uuid,integer,jsonb,text) from public, anon, authenticated;
grant execute on function public.read_battlefield_elevation_policy_v1() to service_role;
grant execute on function public.publish_battlefield_elevation_policy_v1(uuid,integer,jsonb,text) to service_role;
commit;
