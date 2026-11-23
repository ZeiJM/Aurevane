begin;

-- Additive grammar only: no sources, publications, inventory or historical bodies change.
create function app_private.assert_item_technique_media_shape_v1(d jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare binding record; m jsonb; a jsonb; n record; crop jsonb;
begin
 for binding in select * from jsonb_each(case when jsonb_typeof(d->'actions')='object' then d->'actions' else '{}'::jsonb end) loop
  if not (binding.value ? 'media') then continue; end if;
  m:=binding.value->'media';
  if binding.key<>'support' or d->>'itemClass' is distinct from 'weapon' or jsonb_typeof(m) is distinct from 'object' or (m-'artworkId'-'artwork')<>'{}'::jsonb then raise exception using errcode='22023',message='ITEM_MEDIA_INVALID'; end if;
  if m ? 'artworkId' and (jsonb_typeof(m->'artworkId') is distinct from 'string' or char_length(m->>'artworkId')>160 or (m->>'artworkId') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$') then raise exception using errcode='22023',message='ITEM_MEDIA_INVALID'; end if;
  if not m ? 'artwork' then continue; end if;
  a:=m->'artwork'; crop:=a->'crop';
  if jsonb_typeof(a) is distinct from 'object' or (a-'id'-'checksum'-'byteLength'-'kind'-'contentType'-'width'-'height'-'sourceWidth'-'sourceHeight'-'crop')<>'{}'::jsonb
   or not a ?& array['id','checksum','byteLength','kind','contentType','width','height','sourceWidth','sourceHeight','crop']
   or a->>'kind' is distinct from 'image' or a->>'contentType' is distinct from 'image/png'
   or jsonb_typeof(a->'id') is distinct from 'string' or (a->>'id') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or jsonb_typeof(a->'checksum') is distinct from 'string' or (a->>'checksum') !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(crop) is distinct from 'object' or (crop-'x'-'y'-'size')<>'{}'::jsonb or not crop ?& array['x','y','size'] then raise exception using errcode='22023',message='ITEM_MEDIA_INVALID'; end if;
  for n in select * from jsonb_each(a-'id'-'checksum'-'kind'-'contentType'-'crop') loop
   if jsonb_typeof(n.value) is distinct from 'number' or n.value::text !~ '^[1-9][0-9]*$' or n.value::text::numeric>(case when n.key='byteLength' then 2097152 else 4096 end) then raise exception using errcode='22023',message='ITEM_MEDIA_INVALID'; end if;
  end loop;
  for n in select * from jsonb_each(crop) loop
   if jsonb_typeof(n.value) is distinct from 'number' or n.value::text !~ '^[0-9]+$' or n.value::text::numeric>(case when n.key='size' then 4096 else 4095 end) then raise exception using errcode='22023',message='ITEM_MEDIA_INVALID'; end if;
  end loop;
  if (a->>'width')::numeric<>(a->>'height')::numeric or (crop->>'size')::numeric<(a->>'width')::numeric or (crop->>'x')::numeric+(crop->>'size')::numeric>(a->>'sourceWidth')::numeric or (crop->>'y')::numeric+(crop->>'size')::numeric>(a->>'sourceHeight')::numeric then raise exception using errcode='22023',message='ITEM_MEDIA_INVALID'; end if;
 end loop;
end; $$;

do $$
declare src text; anchor text;
begin
 src:=pg_get_functiondef('app_private.assert_runtime_item_shape_v1(jsonb)'::regprocedure);
 anchor:='(role.value-''behaviorId''-''name'')';
 if strpos(src,anchor)=0 then raise exception 'Item binding whitelist anchor changed'; end if;
 src:=replace(src,anchor,'(role.value-''behaviorId''-''name''-''media'')');
 anchor:='begin';
 src:=replace(src,anchor,anchor||E'\n perform app_private.assert_item_technique_media_shape_v1(d);');
 execute src;
end; $$;
-- Existing recursive finalized-media guards cover nested actions.support.media exactly.
-- Existing seed authority also compares full descriptors with finalized server assets.
revoke all on function app_private.assert_item_technique_media_shape_v1(jsonb) from public,anon,authenticated,service_role;
commit;
