-- Both the native PostgreSQL gate and the all-migration regression execute this
-- exact transaction body. Caller supplies the existing trusted fixture Owner.
do $proof$
declare
 actor uuid:=current_setting('task13.owner')::uuid;
 media jsonb; tag jsonb; definition jsonb; saved jsonb; first_definition jsonb;
 before_versions jsonb; before_pointers jsonb; before_drafts jsonb;
 original jsonb; original_key text;
 first_version integer; first_tag_version integer; stale_token text; n integer;
 raw bytea:=decode('524946462600000057415645666d7420100000000100010044ac0000885801000200100064617461020000000000','hex');
begin
 select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') into before_versions from app_private.combat_content_versions v;
 select coalesce(jsonb_agg(to_jsonb(p) order by content_key),'[]') into before_pointers from app_private.combat_content_publications p;
 select coalesce(jsonb_agg(to_jsonb(d) order by content_key),'[]') into before_drafts from app_private.combat_content_drafts d;
 media:=public.finalize_combat_content_media_v1(actor,null,raw,jsonb_build_object('kind','audio','contentType','audio/wav','byteLength',46,'checksum','ignored','durationMs',1000.0/44100,'channels',1,'sampleRate',44100));
 assert media->>'checksum'<> 'ignored', 'Checksum derived from bytes';
 assert public.read_published_combat_content_media_v1((media->>'id')::uuid) is null, 'Unpublished bytes private';
 begin
  perform public.finalize_combat_content_media_v1('00000000-0000-4000-8000-999999999999',null,raw,'{}');
  raise exception 'EXPECTED selected authority denial';
 exception when insufficient_privilege then assert sqlerrm='MASTER_PANEL_OPERATOR_REQUIRED'; end;
 assert not has_function_privilege('authenticated','public.finalize_combat_content_media_v1(uuid,uuid,bytea,jsonb)','execute'), 'Browser finalize denied';
 assert not has_function_privilege('authenticated','public.write_combat_content_record_v1(uuid,uuid,text,jsonb)','execute'), 'Browser write denied';
 tag:='{"schemaVersion":1,"id":"tag.damage","contentVersion":1,"tagId":"damage","name":"Impact","description":"Relative power.","explanation":"Damage uses power, not exact HP.","sortOrder":0,"enabled":true,"media":{}}';
 saved:=public.read_combat_content_record_v1(actor,null,'tag.damage');
 if saved is null then
  saved:=public.write_combat_content_record_v1(actor,null,'tag.damage',jsonb_build_object('action','create','requestId',gen_random_uuid(),'contentKind','tag','definition',tag));
 else
  saved:=public.write_combat_content_record_v1(actor,null,'tag.damage',jsonb_build_object('action','save','expectedRevision',saved->'revision','definition',tag));
 end if;
 saved:=public.publish_saved_combat_content_v1(actor,null,'tag.damage',(saved#>>'{draft,draftVersion}')::bigint,(saved#>>'{draft,baseVersion}')::integer,public.read_combat_content_catalogue_v1()->>'token',null);
 first_tag_version:=(saved#>>'{current,contentVersion}')::integer;
 definition:=jsonb_build_object('id','ci.master.media-tag','contentVersion',1,'sourceDisciplineId','vanguard','name','Complete immutable source','privateAccuracy',jsonb_build_object('kind','fixed','chanceBasisPoints',7777),'media',jsonb_build_object('audio',media),'ability','{"schemaVersion":1,"behaviors":[{"effects":[{"payload":{"type":"damage","amount":10}}]}]}'::jsonb);
 begin
  perform public.write_combat_content_record_v1(actor,null,'ci.master.forged-media',jsonb_build_object('action','create','requestId',gen_random_uuid(),'contentKind','skill','definition',jsonb_set(jsonb_set(definition,'{id}','"ci.master.forged-media"'),'{media,audio,checksum}',to_jsonb(repeat('f',64)))));
  raise exception 'EXPECTED forged media denial';
 exception when invalid_parameter_value then assert sqlerrm='COMBAT_CONTENT_MEDIA_REFERENCE_INVALID', sqlerrm; end;
 saved:=public.write_combat_content_record_v1(actor,null,'ci.master.media-tag',jsonb_build_object('action','create','requestId',gen_random_uuid(),'contentKind','skill','definition',definition));
 saved:=public.publish_saved_combat_content_v1(actor,null,'ci.master.media-tag',(saved#>>'{draft,draftVersion}')::bigint,null,public.read_combat_content_catalogue_v1()->>'token',null);
 first_version:=(saved#>>'{current,contentVersion}')::integer;
 first_definition:=saved#>'{current,definition}';
 assert first_definition#>>'{ability,tagPresentation,0,name}'='Impact', 'Published complete Tag binding';
 assert (first_definition#>>'{ability,tagPresentation,0,contentVersion}')::integer=first_tag_version, 'Exact Tag version';
 assert first_definition->'media'=definition->'media' and first_definition->'privateAccuracy'=definition->'privateAccuracy', 'Complete private definition preserved';
 assert decode(public.read_published_combat_content_media_v1((media->>'id')::uuid)->>'bytes','base64')=raw, 'Actual published bytes exact';
 stale_token:=public.read_combat_content_catalogue_v1()->>'token';
 saved:=public.read_combat_content_record_v1(actor,null,'tag.damage');
 saved:=public.write_combat_content_record_v1(actor,null,'tag.damage',jsonb_build_object('action','save','expectedRevision',saved->'revision','definition',jsonb_set(tag,'{name}','"Force"')));
 perform public.publish_saved_combat_content_v1(actor,null,'tag.damage',(saved#>>'{draft,draftVersion}')::bigint,(saved#>>'{draft,baseVersion}')::integer,public.read_combat_content_catalogue_v1()->>'token',null);
 assert stale_token<>public.read_combat_content_catalogue_v1()->>'token', 'Tag changes catalogue token';
 begin
  perform public.write_combat_content_record_v1(actor,null,'ci.master.forged-tag',jsonb_build_object('action','create','requestId',gen_random_uuid(),'contentKind','skill','definition',jsonb_set(jsonb_set(first_definition,'{id}','"ci.master.forged-tag"'),'{ability,tagPresentation,0,name}','"Forged"')));
  raise exception 'EXPECTED forged Tag denial';
 exception when invalid_parameter_value then assert sqlerrm='CONTENT_TAG_REFERENCE_INVALID',sqlerrm; end;
 saved:=public.read_combat_content_record_v1(actor,null,'ci.master.media-tag');
 saved:=public.write_combat_content_record_v1(actor,null,'ci.master.media-tag',jsonb_build_object('action','save','expectedRevision',saved->'revision','definition',first_definition));
 begin
  perform public.publish_saved_combat_content_v1(actor,null,'ci.master.media-tag',(saved#>>'{draft,draftVersion}')::bigint,first_version,stale_token,null);
  raise exception 'EXPECTED stale current token denial';
 exception when serialization_failure then assert sqlerrm='COMBAT_CONTENT_CATALOGUE_CONFLICT'; end;
 assert public.read_combat_content_record_v1(actor,null,'ci.master.media-tag')=saved, 'Failed publication preserves exact draft and current metadata';
 for n in 1..4 loop
  saved:=public.write_combat_content_record_v1(actor,null,'ci.master.media-tag',jsonb_build_object('action','save','expectedRevision',saved->'revision','definition',jsonb_set(definition,'{media}','{}')));
  saved:=public.publish_saved_combat_content_v1(actor,null,'ci.master.media-tag',(saved#>>'{draft,draftVersion}')::bigint,(saved#>>'{draft,baseVersion}')::integer,public.read_combat_content_catalogue_v1()->>'token',null);
 end loop;
 assert not exists(select 1 from jsonb_array_elements(saved->'history') h where (h->>'contentVersion')::integer=first_version), 'Source deeper than display history';
 assert (select v.definition=first_definition from public.read_combat_content_version_v1('ci.master.media-tag','skill',first_version) v), 'Deep exact definition unchanged';
 assert decode(public.read_published_combat_content_media_v1((media->>'id')::uuid)->>'bytes','base64')=raw, 'Deep media still readable';
 assert (select v.definition->>'name'='Impact' from public.read_combat_content_version_v1('tag.damage','tag',first_tag_version) v), 'Old Tag wording exact';
 assert (select jsonb_agg(to_jsonb(v) order by id) from app_private.combat_content_versions v where to_jsonb(v)->>'id' in (select x->>'id' from jsonb_array_elements(before_versions) x)) is not distinct from nullif(before_versions,'[]'), 'All earlier immutable rows retained';
 assert not exists(select 1 from jsonb_array_elements(before_pointers) old left join app_private.combat_content_publications p on p.content_key=old->>'content_key' where old->>'content_key'<>'tag.damage' and to_jsonb(p) is distinct from old), 'All unrelated pointer attribution/timestamps retained';
 assert not exists(select 1 from jsonb_array_elements(before_drafts) old left join app_private.combat_content_drafts d on d.content_key=old->>'content_key' where old->>'content_key'<>'tag.damage' and to_jsonb(d) is distinct from old), 'All unrelated draft rows retained';
 assert jsonb_array_length(current_setting('task13.originals')::jsonb)=5, 'Five actual executable originals supplied';
 for original in select value from jsonb_array_elements(current_setting('task13.originals')::jsonb) loop
  original_key:=original->>'id';
  assert original->>'contentVersion'='1', 'Original version exact';
  saved:=public.read_combat_content_record_v1(actor,null,original_key);
  saved:=public.write_combat_content_record_v1(actor,null,original_key,jsonb_build_object('action','save','expectedRevision',saved->'revision','definition',jsonb_set(original,'{name}','"Native changed Basic"')));
  saved:=public.publish_saved_combat_content_v1(actor,null,original_key,(saved#>>'{draft,draftVersion}')::bigint,(saved#>>'{draft,baseVersion}')::integer,public.read_combat_content_catalogue_v1()->>'token',1);
  first_version:=(saved#>>'{current,contentVersion}')::integer;
  select coalesce(jsonb_agg(to_jsonb(p) order by content_key),'[]') into before_pointers from app_private.combat_content_publications p;
  select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') into before_versions from app_private.combat_content_versions v;
  saved:=public.write_combat_content_record_v1(actor,null,original_key,jsonb_build_object('action','restore','expectedRevision',saved->'revision','sourceVersion',1,'sourceKind','builtin','sourceDefinition',original));
  assert saved#>'{draft,definition}'=original, 'Original hidden/text/media/execution fields exact';
  assert saved#>>'{draft,restoredSource}'='builtin', 'Honest system source';
  assert (select jsonb_agg(to_jsonb(p) order by content_key) from app_private.combat_content_publications p)=before_pointers, 'Original restore never changes pointers or timestamps';
  assert (select jsonb_agg(to_jsonb(v) order by id) from app_private.combat_content_versions v)=before_versions, 'Original restore never invents historical publication';
  saved:=public.publish_saved_combat_content_v1(actor,null,original_key,(saved#>>'{draft,draftVersion}')::bigint,first_version,public.read_combat_content_catalogue_v1()->>'token',1);
  assert (saved#>>'{current,contentVersion}')::integer>first_version and saved#>>'{current,restoredFrom}'='1' and saved#>>'{current,restoredSource}'='builtin', 'New publication distinct from original restore source';
  assert saved#>'{current,authoredBy}'='null'::jsonb and saved#>'{current,authoredAt}'='null'::jsonb, 'No invented human author/time';
 end loop;

end; $proof$;
