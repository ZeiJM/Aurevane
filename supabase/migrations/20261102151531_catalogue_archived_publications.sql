begin;

-- Archived records retain physical publication pointers for exact history, but
-- cannot also appear among the current snapshot's publications. Keep the token,
-- timing policy, archived identity list, function attributes and ACL unchanged.
do $catalogue_archive_filter$
declare
  definition text;
  predecessor constant text := 'from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id';
  replacement constant text := predecessor || ' where not exists (select 1 from app_private.combat_content_records r where r.content_key=p.content_key and r.lifecycle=''archived'')';
begin
  definition:=pg_get_functiondef('public.read_combat_content_catalogue_v1()'::regprocedure);
  if strpos(definition,replacement)=0 then
    if length(definition)-length(replace(definition,predecessor,''))<>length(predecessor) then
      raise exception 'CATALOGUE_ARCHIVE_FILTER_PREDECESSOR_CONFLICT';
    end if;
    execute replace(definition,predecessor,replacement);
  end if;
end;
$catalogue_archive_filter$;

commit;
