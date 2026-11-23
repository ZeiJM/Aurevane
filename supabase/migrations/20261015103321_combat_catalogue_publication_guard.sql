-- Trusted server compiles the complete prospective catalogue before these service-only writes.
-- Every current publication/policy choice uses the same lock and validated snapshot token.
-- Existing v1 bodies remain private implementation helpers, with their original checks/locks/CAS.
begin;

create or replace function app_private.lock_combat_content_catalogue_v1(p_expected_token text)
returns void language plpgsql security definer
set search_path = ''
as $$
declare v_current_token text;
begin
  if p_expected_token is null or p_expected_token !~ '^[0-9a-f]{32}$' then
    raise exception using errcode = '40001', message = 'COMBAT_CONTENT_CATALOGUE_CONFLICT';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('combat-catalogue-publication', 0));
  select public.read_combat_content_catalogue_v1() ->> 'token' into v_current_token;
  if v_current_token is distinct from p_expected_token then
    raise exception using errcode = '40001', message = 'COMBAT_CONTENT_CATALOGUE_CONFLICT';
  end if;
end;
$$;

create or replace function public.publish_combat_content_v2(
  p_actor_user_id uuid, p_content_key text, p_content_kind text, p_definition jsonb,
  p_expected_base_version integer, p_expected_catalogue_token text
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
  perform app_private.lock_combat_content_catalogue_v1(p_expected_catalogue_token);
  return query select * from public.publish_combat_content_v1(
    p_actor_user_id, p_content_key, p_content_kind, p_definition, p_expected_base_version
  );
end;
$$;

create or replace function public.set_combat_content_publication_v2(
  p_actor_user_id uuid, p_content_key text, p_content_kind text,
  p_target_version integer, p_expected_catalogue_token text
)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  perform app_private.assert_master_panel_operator_v1(p_actor_user_id);
  perform app_private.lock_combat_content_catalogue_v1(p_expected_catalogue_token);
  perform public.set_combat_content_publication_v1(
    p_actor_user_id, p_content_key, p_content_kind, p_target_version
  );
end;
$$;

create or replace function public.publish_combat_effect_timing_policy_v2(
  p_actor_user_id uuid, p_expected_version integer, p_modes jsonb,
  p_expected_catalogue_token text
)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);
  perform app_private.lock_combat_content_catalogue_v1(p_expected_catalogue_token);
  return public.publish_combat_effect_timing_policy_v1(
    p_actor_user_id, p_expected_version, p_modes, null
  );
end;
$$;

-- The trusted server must not retain a service-callable writer bypassing catalogue validation.
revoke all on function app_private.lock_combat_content_catalogue_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.publish_combat_content_v1(uuid,text,text,jsonb,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.set_combat_content_publication_v1(uuid,text,text,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.publish_combat_effect_timing_policy_v1(uuid,integer,jsonb,text)
  from public, anon, authenticated, service_role;
revoke all on function public.publish_combat_content_v2(uuid,text,text,jsonb,integer,text)
  from public, anon, authenticated;
revoke all on function public.set_combat_content_publication_v2(uuid,text,text,integer,text)
  from public, anon, authenticated;
revoke all on function public.publish_combat_effect_timing_policy_v2(uuid,integer,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.publish_combat_content_v2(uuid,text,text,jsonb,integer,text) to service_role;
grant execute on function public.set_combat_content_publication_v2(uuid,text,text,integer,text) to service_role;
grant execute on function public.publish_combat_effect_timing_policy_v2(uuid,integer,jsonb,text) to service_role;

commit;
