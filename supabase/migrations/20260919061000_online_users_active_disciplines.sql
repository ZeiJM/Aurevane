begin;

create or replace function public.get_character_public_active_disciplines_v1(
  p_character_ids uuid[]
)
returns table (
  character_id uuid,
  primary_discipline_id text,
  secondary_discipline_id text
)
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select
    build.character_id,
    build.primary_discipline_id,
    build.secondary_discipline_id
  from app_private.character_active_builds as build
  where build.character_id = any(coalesce(p_character_ids, array[]::uuid[]))
  order by build.character_id;
$$;

revoke all on function public.get_character_public_active_disciplines_v1(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_character_public_active_disciplines_v1(uuid[])
  to service_role;

comment on function public.get_character_public_active_disciplines_v1(uuid[]) is
  'Service-only shallow public identity projection for Online Users. Returns current committed Primary and optional Secondary Discipline only; no stats, skills, account identity, progression, inventory or other private build data.';

commit;
