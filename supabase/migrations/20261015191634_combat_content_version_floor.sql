-- Shipped versions and Owner publications share an immutable identity namespace.
-- Keep selected-pointer CAS separate from the trusted server's shipped-history floor.
begin;

do $migration$
declare
  v_definition text;
  v_old_assignment text := 'v_next_version := greatest(v_highest_version, coalesce(p_expected_base_version, 0)) + 1;';
  v_new_assignment text := 'v_next_version := greatest(v_highest_version, coalesce(p_expected_base_version, 0), coalesce(p_version_floor, 0)) + 1;';
begin
  v_definition := pg_get_functiondef('public.publish_combat_content_v1(uuid,text,text,jsonb,integer)'::regprocedure);
  if strpos(v_definition, v_old_assignment) = 0
    or strpos(v_definition, 'p_expected_base_version integer)') = 0
    or strpos(v_definition, '-- Typed Essence/Resonance identity.') = 0 then
    raise exception 'COMBAT_CONTENT_VERSION_FLOOR_PREDECESSOR_CONFLICT';
  end if;
  v_definition := replace(v_definition, 'public.publish_combat_content_v1(', 'app_private.publish_combat_content_with_floor_v1(');
  v_definition := replace(v_definition, 'p_expected_base_version integer)', 'p_expected_base_version integer, p_version_floor integer)');
  v_definition := replace(v_definition, v_old_assignment, v_new_assignment);
  execute v_definition;
end;
$migration$;

alter function app_private.publish_combat_content_with_floor_v1(uuid,text,text,jsonb,integer,integer)
  set search_path = '';

create or replace function public.publish_combat_content_v3(
  p_actor_user_id uuid, p_content_key text, p_content_kind text, p_definition jsonb,
  p_expected_base_version integer, p_expected_catalogue_token text, p_version_floor integer
)
returns table (
  id uuid, content_key text, content_kind text, content_version integer,
  definition jsonb, published_by uuid, published_at timestamptz
)
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app_private.assert_master_panel_operator_v1(p_actor_user_id);
  if p_version_floor is not null and p_version_floor < 1 then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_VERSION_FLOOR_INVALID';
  end if;
  perform app_private.lock_combat_content_catalogue_v1(p_expected_catalogue_token);
  return query select * from app_private.publish_combat_content_with_floor_v1(
    p_actor_user_id, p_content_key, p_content_kind, p_definition,
    p_expected_base_version, p_version_floor
  );
end;
$$;

revoke all on function app_private.publish_combat_content_with_floor_v1(uuid,text,text,jsonb,integer,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.publish_combat_content_v2(uuid,text,text,jsonb,integer,text)
  from public, anon, authenticated, service_role;
revoke all on function public.publish_combat_content_v3(uuid,text,text,jsonb,integer,text,integer)
  from public, anon, authenticated;
grant execute on function public.publish_combat_content_v3(uuid,text,text,jsonb,integer,text,integer)
  to service_role;

commit;
