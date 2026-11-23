-- Read-only current catalogue audit. Run with the existing trusted service/admin connection.
-- Exports only affected definitions, while the recursive predicate scans every active publication.
select clock_timestamp() as read_at,
 public.read_combat_content_catalogue_token_v1() as catalogue_token,
 (select count(*) from app_private.combat_content_publications p
  join app_private.combat_content_records r on r.content_key=p.content_key
  where r.lifecycle='active') as publication_count,
 coalesce(jsonb_agg(jsonb_build_object(
  'content_key',p.content_key,'content_kind',p.content_kind,'content_version',v.content_version,
  'revision',r.revision,'version_floor',r.version_floor,
  'has_draft',exists(select 1 from app_private.combat_content_drafts d where d.content_key=p.content_key),
  'highest_version',(select max(h.content_version) from app_private.combat_content_versions h where h.content_key=p.content_key),
  'definition',v.definition) order by p.content_key),'[]'::jsonb) as affected
from app_private.combat_content_publications p
join app_private.combat_content_versions v on v.id=p.version_id
join app_private.combat_content_records r on r.content_key=p.content_key
where r.lifecycle='active'
 and jsonb_path_exists(v.definition,'$.** ? (exists(@.payload) && exists(@.requirements) && @.requirements != null)');
