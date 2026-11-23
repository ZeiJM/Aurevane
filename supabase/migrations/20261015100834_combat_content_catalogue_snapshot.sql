begin;

-- One MVCC snapshot of all current DB overrides and their timing policy. Private
-- definitions stay service-only. Drafts and unselected historical versions are
-- deliberately excluded; publication timestamps detect pointer ABA changes.
create or replace function public.read_combat_content_catalogue_v1()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  with current_records as (
    select version.id, version.content_key, version.content_kind,
      version.content_version, version.definition, version.published_by,
      version.published_at, publication.updated_at as publication_updated_at
    from app_private.combat_content_publications publication
    join app_private.combat_content_versions version
      on version.id = publication.version_id
      and version.content_key = publication.content_key
      and version.content_kind = publication.content_kind
  ), records as (
    select
      coalesce(jsonb_agg(to_jsonb(record) - 'publication_updated_at' order by record.content_key collate "C"), '[]'::jsonb) as publications,
      coalesce(jsonb_agg(to_jsonb(record) order by record.content_key collate "C"), '[]'::jsonb) as token_records
    from current_records record
  ), policy as (
    select jsonb_build_object('version', version, 'modes', modes) as definition
    from app_private.combat_effect_timing_policy_versions
    order by version desc limit 1
  )
  select jsonb_build_object(
    'token', md5(jsonb_build_object('policy', policy.definition, 'publications', records.token_records)::text),
    'policy', policy.definition,
    'publications', records.publications
  ) from records cross join policy;
$$;

revoke all on function public.read_combat_content_catalogue_v1() from public, anon, authenticated;
grant execute on function public.read_combat_content_catalogue_v1() to service_role;
comment on function public.read_combat_content_catalogue_v1() is
  'Server-private coherent current catalogue/policy read; token is a comparison value, not authorization.';

commit;
