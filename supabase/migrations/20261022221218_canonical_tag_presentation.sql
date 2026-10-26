begin;
-- Wording remains subordinate to the finite implemented Tag registry; this table creates no handler.
create function app_private.content_tag_snapshot_v1(d jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('contentKey',d->'id','contentVersion',d->'contentVersion','tagId',d->'tagId','name',d->'name','compact',d->'description','full',d->'explanation');
$$;
create function app_private.bind_content_tag_presentation_v1(d jsonb,capture_current boolean,depth integer default 0) returns jsonb
language plpgsql stable set search_path='' as $$
declare result jsonb:=d; entry record; ref jsonb; expected jsonb; selected jsonb;
begin
 if depth>64 then raise exception using errcode='22023',message='CONTENT_TAG_DEPTH_INVALID'; end if;
 if jsonb_typeof(d)='array' then
  select coalesce(jsonb_agg(app_private.bind_content_tag_presentation_v1(e.value,capture_current,depth+1) order by e.ordinality),'[]') into result from jsonb_array_elements(d) with ordinality e;
 elsif jsonb_typeof(d)='object' then
  if d ? 'tagPresentation' then
   if jsonb_typeof(d->'tagPresentation')<>'array' or jsonb_array_length(d->'tagPresentation')>19 or not (d ? 'behaviors') then raise exception using errcode='22023',message='CONTENT_TAG_REFERENCE_INVALID'; end if;
   for ref in select value from jsonb_array_elements(d->'tagPresentation') loop
    select app_private.content_tag_snapshot_v1(v.definition) into expected from app_private.combat_content_versions v where v.content_kind='tag' and v.content_key=ref->>'contentKey' and v.content_version::text=ref->>'contentVersion';
    if expected is null or expected<>ref then raise exception using errcode='22023',message='CONTENT_TAG_REFERENCE_INVALID'; end if;
   end loop;
   if (select count(*)<>count(distinct e->>'tagId') from jsonb_array_elements(d->'tagPresentation') e) then raise exception using errcode='22023',message='CONTENT_TAG_REFERENCE_INVALID'; end if;
  end if;
  for entry in select * from jsonb_each(d) where key<>'tagPresentation' loop
   result:=jsonb_set(result,array[entry.key],app_private.bind_content_tag_presentation_v1(entry.value,capture_current,depth+1));
  end loop;
  if capture_current and jsonb_typeof(d->'behaviors')='array' then
   select coalesce(jsonb_agg(app_private.content_tag_snapshot_v1(v.definition) order by v.content_key),'[]') into selected
   from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id
   where v.content_kind='tag' and v.definition->'enabled'='true'::jsonb and v.definition->>'tagId' in (
    select e->'payload'->>'type' from jsonb_array_elements(d->'behaviors') b cross join lateral jsonb_array_elements(case when jsonb_typeof(b->'effects')='array' then b->'effects' else '[]'::jsonb end) e);
   if selected<>'[]'::jsonb or d ? 'tagPresentation' then result:=jsonb_set(result,'{tagPresentation}',selected); end if;
  end if;
 end if;
 return result;
end; $$;
create function app_private.validate_content_tag_presentation_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare d jsonb:=new.definition; word text;
begin
 if new.content_kind='tag' then
  if d->>'tagId' not in ('move','damage','pierce','healing','percentage-recovery','resource-change','apply-status','remove-status','return-to-turn-start','create-terrain','displace','poison','burn','bleed','barrier-change','copy-statuses','sensory','summon','damage-bonus') or d->>'tagId' is null or d->>'id' is distinct from 'tag.'||(d->>'tagId') then raise exception using errcode='22023',message='CONTENT_TAG_ID_INVALID'; end if;
  foreach word in array array['name','description','explanation'] loop
   if jsonb_typeof(d->word) is distinct from 'string' or length(d->>word) not between 1 and (case word when 'name' then 120 when 'description' then 240 else 2000 end) or d->>word<>btrim(d->>word) or d->>word ~ '[<>{}[:cntrl:]]' then raise exception using errcode='22023',message='CONTENT_TAG_TEXT_INVALID'; end if;
  end loop;
 end if;
 new.definition:=app_private.bind_content_tag_presentation_v1(d,tg_table_name='combat_content_versions');
 return new;
end; $$;
create trigger combat_content_draft_tag_presentation before insert or update on app_private.combat_content_drafts for each row execute function app_private.validate_content_tag_presentation_v1();
create trigger combat_content_version_tag_presentation before insert on app_private.combat_content_versions for each row execute function app_private.validate_content_tag_presentation_v1();
revoke all on function app_private.content_tag_snapshot_v1(jsonb),app_private.bind_content_tag_presentation_v1(jsonb,boolean,integer),app_private.validate_content_tag_presentation_v1() from public,anon,authenticated,service_role;
-- Enable only Tag presentation publication through the existing complete-record CAS protocol.
do $migration$
declare source text; old text:=$old$if r.content_kind in ('item','ascension','severence','tag')$old$;
begin
 source:=pg_get_functiondef('public.publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer)'::regprocedure);
 if strpos(source,old)=0 then raise exception 'CONTENT_TAG_PUBLICATION_PREDECESSOR_CONFLICT'; end if;
 execute replace(source,old,$new$if r.content_kind in ('item','ascension','severence')$new$);
end; $migration$;
commit;
