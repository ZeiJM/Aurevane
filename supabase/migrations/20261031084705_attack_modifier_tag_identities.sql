begin;

-- Add identity/search/floor metadata only; retained drafts and publications stay unchanged.
insert into app_private.combat_content_records(
  content_key, content_kind, lifecycle, version_floor, builtin_version, builtin_name,
  builtin_source_discipline_id
)
select r."contentKey", r."contentKind", 'active', r."versionFloor", r."contentVersion", r.name, null
from jsonb_to_recordset($attack_tag_manifest$[
  {
    "contentKey": "tag.weak-point",
    "contentKind": "tag",
    "name": "Weak Point",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.spike",
    "contentKind": "tag",
    "name": "Spike",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.ruin",
    "contentKind": "tag",
    "name": "Ruin",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  }
]$attack_tag_manifest$::jsonb)
  as r("contentKey" text, "contentKind" text, name text, "contentVersion" integer, "versionFloor" integer, "sourceDisciplineId" text)
on conflict (content_key) do update set
  builtin_version = excluded.builtin_version,
  builtin_name = excluded.builtin_name,
  version_floor = greatest(app_private.combat_content_records.version_floor, excluded.version_floor)
where app_private.combat_content_records.content_kind = 'tag';

-- Extend the installed finite list, retaining earlier approved additions regardless of order.
do $attack_tag_allowlist$
declare ids text[];
begin
  select array_agg(distinct id order by id) into ids
  from unnest(app_private.content_presentation_tag_ids_v1() || array['weak-point', 'spike', 'ruin']) id;
  execute format(
    'create or replace function app_private.content_presentation_tag_ids_v1() returns text[] language sql immutable set search_path='''' as %L',
    format('select %L::text[]', ids)
  );
end;
$attack_tag_allowlist$;

revoke all on function app_private.content_presentation_tag_ids_v1() from public, anon, authenticated, service_role;

commit;
