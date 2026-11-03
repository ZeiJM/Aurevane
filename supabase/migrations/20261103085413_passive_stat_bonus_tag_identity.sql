begin;

-- Only source identity metadata is new. Published definitions and retained drafts stay literal.
insert into app_private.combat_content_records (
  content_key, content_kind, lifecycle, version_floor, builtin_version, builtin_name,
  builtin_source_discipline_id
)
values ('tag.stat-bonus', 'tag', 'active', 1, 1, 'Stat Bonus', null)
on conflict (content_key) do nothing;

-- Passive stats use the existing canonical behavior validator and source resolver.
-- They are always ongoing/instant; no global timed-effect vocabulary is widened.
do $passive_stat_identity$
declare ids text[];
begin
  ids := app_private.content_presentation_tag_ids_v1();
  if not ('stat-bonus' = any(ids)) then
    execute format(
      'create or replace function app_private.content_presentation_tag_ids_v1() returns text[] language sql immutable set search_path='''' as %L',
      'select ' || quote_literal(array_append(ids, 'stat-bonus')) || '::text[]'
    );
  end if;
end;
$passive_stat_identity$;

commit;
