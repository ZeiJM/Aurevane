begin;

-- The Supabase Data API exposes only the public schema. Keep authoring tables
-- private and expose narrowly scoped read RPCs to service_role only.
create or replace function public.read_current_combat_content_v1(
  p_content_key text,
  p_content_kind text
)
returns table (
  id uuid,
  content_key text,
  content_kind text,
  content_version integer,
  definition jsonb,
  published_by uuid,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select
    version.id,
    version.content_key,
    version.content_kind,
    version.content_version,
    version.definition,
    version.published_by,
    version.published_at
  from app_private.combat_content_publications as publication
  join app_private.combat_content_versions as version
    on publication.version_id = version.id
  where publication.content_key = p_content_key
    and publication.content_kind = p_content_kind
    and version.content_key = p_content_key
    and version.content_kind = p_content_kind
  limit 1;
$$;

create or replace function public.read_combat_content_version_v1(
  p_content_key text,
  p_content_kind text,
  p_content_version integer
)
returns table (
  id uuid,
  content_key text,
  content_kind text,
  content_version integer,
  definition jsonb,
  published_by uuid,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select
    version.id,
    version.content_key,
    version.content_kind,
    version.content_version,
    version.definition,
    version.published_by,
    version.published_at
  from app_private.combat_content_versions as version
  where version.content_key = p_content_key
    and version.content_kind = p_content_kind
    and version.content_version = p_content_version
  limit 1;
$$;

revoke all on function public.read_current_combat_content_v1(text, text)
  from public, anon, authenticated;
revoke all on function public.read_combat_content_version_v1(text, text, integer)
  from public, anon, authenticated;

grant execute on function public.read_current_combat_content_v1(text, text)
  to service_role;
grant execute on function public.read_combat_content_version_v1(text, text, integer)
  to service_role;

comment on function public.read_current_combat_content_v1(text, text) is
  'Service-only read of the immutable combat content version referenced by the current publication pointer.';
comment on function public.read_combat_content_version_v1(text, text, integer) is
  'Service-only read of an exact immutable combat content version for historical battle pinning.';

commit;
