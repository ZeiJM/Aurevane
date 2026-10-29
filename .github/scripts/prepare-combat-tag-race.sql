-- The current migration chain seeds Tag identities. Prepare a genuine draft on
-- that record, preserving any existing publication/history and its version floor.
do $tag_race$
declare
 actor uuid:=current_setting('task13.owner')::uuid;
 saved jsonb;
 definition jsonb;
begin
 saved:=public.read_combat_content_record_v1(actor,null,'tag.damage');
 if saved is null then raise exception 'CATALOGUE_TAG_RACE_SEEDED_RECORD_REQUIRED'; end if;
 definition:=coalesce(saved#>'{current,definition}',
  '{"schemaVersion":1,"id":"tag.damage","contentVersion":1,"tagId":"damage","name":"Impact","description":"Relative power.","explanation":"Damage uses power.","sortOrder":0,"enabled":true,"media":{}}'::jsonb);
 if saved#>'{current,definition}' is not null then
  definition:=jsonb_set(definition,'{name}',to_jsonb((definition->>'name')||' reviewed'));
 end if;
 perform public.write_combat_content_record_v1(actor,null,'tag.damage',
  jsonb_build_object('action','save','expectedRevision',saved->'revision','definition',definition));
end;
$tag_race$;
