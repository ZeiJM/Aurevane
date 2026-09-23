begin;

-- Navigation performance helpers. These RPCs keep the existing authority model intact while
-- reducing Data API round trips and payload size for common authenticated reads.

create or replace function public.read_current_combat_content_many_v1(
  p_content_keys text[],
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
  where publication.content_key = any(coalesce(p_content_keys, array[]::text[]))
    and publication.content_kind = p_content_kind
    and version.content_key = publication.content_key
    and version.content_kind = p_content_kind;
$$;

revoke all on function public.read_current_combat_content_many_v1(text[], text)
  from public, anon, authenticated;
grant execute on function public.read_current_combat_content_many_v1(text[], text)
  to service_role;

comment on function public.read_current_combat_content_many_v1(text[], text) is
  'Service-only batch read of immutable combat content versions referenced by current publication pointers.';

create or replace function public.count_online_characters_v1()
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select count(*)::integer
  from public.character_presence as presence
  join public.characters as character
    on character.id = presence.character_id
  where presence.last_seen_at >= now() - interval '10 minutes'
    and not exists (
      select 1
      from app_private.character_deletion_requests as deletion
      where deletion.character_id = character.id
    );
$$;

revoke all on function public.count_online_characters_v1()
  from public, anon, authenticated;
grant execute on function public.count_online_characters_v1()
  to service_role;

comment on function public.count_online_characters_v1() is
  'Service-only scalar online-character count for shell presence without transferring directory rows.';

commit;
