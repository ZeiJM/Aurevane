begin;
-- Bounded finalized bytes are retained independently of the three-version editor window.
-- There is deliberately no update/delete/garbage-collection API.
create table app_private.combat_content_media (
 id uuid primary key default gen_random_uuid(),
 descriptor jsonb not null,
 bytes bytea not null check(octet_length(bytes) between 1 and 2097152),
 uploaded_by uuid not null,
 uploaded_actor uuid,
 created_at timestamptz not null default clock_timestamp()
);
alter table app_private.combat_content_media enable row level security;
revoke all on app_private.combat_content_media from public,anon,authenticated,service_role;
create table app_private.combat_content_media_versions (
 version_id uuid not null references app_private.combat_content_versions(id),
 media_id uuid not null references app_private.combat_content_media(id),
 primary key(version_id,media_id)
);
alter table app_private.combat_content_media_versions enable row level security;
revoke all on app_private.combat_content_media_versions from public,anon,authenticated,service_role;
create function app_private.content_media_immutable_v1() returns trigger language plpgsql set search_path='' as $$
begin raise exception using errcode='55000',message='COMBAT_CONTENT_MEDIA_IMMUTABLE'; end; $$;
create trigger content_media_immutable before update or delete on app_private.combat_content_media for each row execute function app_private.content_media_immutable_v1();
create trigger content_media_versions_immutable before update or delete on app_private.combat_content_media_versions for each row execute function app_private.content_media_immutable_v1();

create function app_private.media_u32_v1(b bytea,o integer,little boolean default true) returns bigint language sql immutable strict set search_path='' as $$
 select case when little then get_byte(b,o)::bigint+get_byte(b,o+1)::bigint*256+get_byte(b,o+2)::bigint*65536+get_byte(b,o+3)::bigint*16777216
 else get_byte(b,o)::bigint*16777216+get_byte(b,o+1)::bigint*65536+get_byte(b,o+2)::bigint*256+get_byte(b,o+3)::bigint end;
$$;
create function public.finalize_combat_content_media_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_bytes bytea,p_descriptor jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid(); d jsonb; n integer:=octet_length(p_bytes); w integer; h integer; x integer; y integer; s integer; sw integer; sh integer; channels integer; rate bigint; frames bigint;
begin
 perform app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id);
 if n is null or n not between 1 and 2097152 or jsonb_typeof(p_descriptor) is distinct from 'object' then raise exception using errcode='22023',message='COMBAT_CONTENT_MEDIA_INVALID'; end if;
 if p_descriptor->>'kind'='image' and p_descriptor->>'contentType'='image/png' then
  if n<45 or substring(p_bytes from 1 for 8)<>decode('89504e470d0a1a0a','hex') or substring(p_bytes from 13 for 4)<>convert_to('IHDR','UTF8') then raise exception using errcode='22023',message='COMBAT_CONTENT_MEDIA_TYPE_INVALID'; end if;
  w:=app_private.media_u32_v1(p_bytes,16,false); h:=app_private.media_u32_v1(p_bytes,20,false);
  x:=(p_descriptor#>>'{crop,x}')::integer; y:=(p_descriptor#>>'{crop,y}')::integer; s:=(p_descriptor#>>'{crop,size}')::integer;
  sw:=(p_descriptor->>'sourceWidth')::integer; sh:=(p_descriptor->>'sourceHeight')::integer;
  if w not between 1 and 4096 or w<>h or x is null or y is null or s is null or sw is null or sh is null or x<0 or y<0 or s<>w or sw not between 1 and 4096 or sh not between 1 and 4096 or x+s>sw or y+s>sh or p_descriptor->'crop'<>jsonb_build_object('x',x,'y',y,'size',s) then raise exception using errcode='22023',message='COMBAT_CONTENT_MEDIA_CROP_INVALID'; end if;
  d:=jsonb_build_object('kind','image','contentType','image/png','width',w,'height',h,'sourceWidth',sw,'sourceHeight',sh,'crop',jsonb_build_object('x',x,'y',y,'size',s));
 elsif p_descriptor->>'kind'='audio' and p_descriptor->>'contentType'='audio/wav' then
  -- Canonical PCM16 header plus actual frames; no trusted duration/type/size claims.
  if n<46 or substring(p_bytes from 1 for 4)<>convert_to('RIFF','UTF8') or substring(p_bytes from 9 for 8)<>convert_to('WAVEfmt ','UTF8') or substring(p_bytes from 37 for 4)<>convert_to('data','UTF8') or app_private.media_u32_v1(p_bytes,4)<>n-8 or app_private.media_u32_v1(p_bytes,16)<>16 or get_byte(p_bytes,20)<>1 or get_byte(p_bytes,21)<>0 or get_byte(p_bytes,23)<>0 or get_byte(p_bytes,34)<>16 or get_byte(p_bytes,35)<>0 then raise exception using errcode='22023',message='COMBAT_CONTENT_MEDIA_PCM16_REQUIRED'; end if;
  channels:=get_byte(p_bytes,22); rate:=app_private.media_u32_v1(p_bytes,24); frames:=n-44;
  if channels not in (1,2) or rate not in (44100,48000) or get_byte(p_bytes,32)<>channels*2 or get_byte(p_bytes,33)<>0 or app_private.media_u32_v1(p_bytes,28)<>rate*channels*2 or app_private.media_u32_v1(p_bytes,40)<>frames or frames%(channels*2)<>0 or frames>rate*channels*2*10 then raise exception using errcode='22023',message='COMBAT_CONTENT_MEDIA_AUDIO_INVALID'; end if;
  d:=jsonb_build_object('kind','audio','contentType','audio/wav','durationMs',round(frames::numeric/(channels*2)/rate*1000,3),'channels',channels,'sampleRate',rate);
 else raise exception using errcode='22023',message='COMBAT_CONTENT_MEDIA_TYPE_INVALID'; end if;
 d:=d||jsonb_build_object('id',v_id,'checksum',encode(sha256(p_bytes),'hex'),'byteLength',n);
 insert into app_private.combat_content_media(id,descriptor,bytes,uploaded_by,uploaded_actor) values(v_id,d,p_bytes,p_actor_user_id,p_actor_character_id);
 return d;
end; $$;

create function app_private.content_media_references_v1(d jsonb,depth integer default 0)
returns table(slot text,reference jsonb) language plpgsql immutable set search_path='' as $$
declare child record; item jsonb; m jsonb;
begin
 if depth>32 then raise exception using errcode='22023',message='COMBAT_CONTENT_MEDIA_NESTING_INVALID'; end if;
 if jsonb_typeof(d)='array' then
  for item in select value from jsonb_array_elements(d) loop return query select * from app_private.content_media_references_v1(item,depth+1); end loop;
 elsif jsonb_typeof(d)='object' then
  if jsonb_typeof(d->'media')='object' then
   m:=d->'media';
   if m?'artwork' then slot:='artwork';reference:=m->'artwork';return next; end if;
   if m?'audio' then slot:='audio';reference:=m->'audio';return next; end if;
  end if;
  for child in select key,value from jsonb_each(d) loop return query select * from app_private.content_media_references_v1(child.value,depth+1); end loop;
 end if;
end; $$;
create function app_private.guard_content_media_references_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare r record; asset app_private.combat_content_media;
begin
 for r in select * from app_private.content_media_references_v1(new.definition) loop
  select * into asset from app_private.combat_content_media where id::text=r.reference->>'id';
  if not found or asset.descriptor<>r.reference or (r.slot='artwork' and asset.descriptor->>'kind'<>'image') or (r.slot='audio' and (asset.descriptor->>'kind'<>'audio' or new.content_kind not in ('skill','essence','resonance'))) then raise exception using errcode='22023',message='COMBAT_CONTENT_MEDIA_REFERENCE_INVALID'; end if;
 end loop;
 return new;
end; $$;
create trigger content_media_references before insert or update on app_private.combat_content_drafts for each row execute function app_private.guard_content_media_references_v1();
create trigger content_media_references before insert on app_private.combat_content_versions for each row execute function app_private.guard_content_media_references_v1();
create function app_private.index_content_media_versions_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into app_private.combat_content_media_versions(version_id,media_id) select distinct new.id,(r.reference->>'id')::uuid from app_private.content_media_references_v1(new.definition) r on conflict do nothing;
 return new;
end; $$;
create trigger content_media_version_index after insert on app_private.combat_content_versions for each row execute function app_private.index_content_media_versions_v1();

create function public.read_published_combat_content_media_v1(p_media_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('descriptor',m.descriptor,'bytes',encode(m.bytes,'base64')) from app_private.combat_content_media m where m.id=p_media_id and exists(select 1 from app_private.combat_content_media_versions v where v.media_id=m.id);
$$;
create function public.read_combat_content_media_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_media_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id);
 if p_media_id is null then return (select coalesce(jsonb_agg(v.descriptor order by v.created_at desc),'[]'::jsonb) from (select descriptor,created_at from app_private.combat_content_media order by created_at desc,id limit 100) v); end if;
 return (select jsonb_build_object('descriptor',descriptor,'bytes',encode(bytes,'base64')) from app_private.combat_content_media where id=p_media_id);
end; $$;
revoke all on function app_private.content_media_immutable_v1(),app_private.media_u32_v1(bytea,integer,boolean),app_private.content_media_references_v1(jsonb,integer),app_private.guard_content_media_references_v1(),app_private.index_content_media_versions_v1() from public,anon,authenticated,service_role;
revoke all on function public.finalize_combat_content_media_v1(uuid,uuid,bytea,jsonb),public.read_published_combat_content_media_v1(uuid),public.read_combat_content_media_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.finalize_combat_content_media_v1(uuid,uuid,bytea,jsonb),public.read_published_combat_content_media_v1(uuid),public.read_combat_content_media_v1(uuid,uuid,uuid) to service_role;
-- Extend only the existing container artwork slot; audio remains unsupported.
do $migration$
declare source text; old text := $old$e.key<>'artworkId' or jsonb_typeof(e.value)<>'string' or (e.value#>>'{}') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'$old$;
begin
 source:=pg_get_functiondef('app_private.validate_noncombat_content_v1(text,jsonb)'::regprocedure);
 if strpos(source,old)=0 then raise exception 'CONTENT_MEDIA_CONTAINER_PREDECESSOR_CONFLICT'; end if;
 execute replace(source,old,$new$e.key not in ('artworkId','artwork') or (e.key='artworkId' and (jsonb_typeof(e.value)<>'string' or (e.value#>>'{}') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$')) or (e.key='artwork' and jsonb_typeof(e.value)<>'object')$new$);
end; $migration$;
commit;
