begin;
-- Finalized PNG output may be smaller than its original source crop.
-- Preserve source coordinates, actual PNG dimensions, byte limits, ACLs and immutable history.
create or replace function public.finalize_combat_content_media_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_bytes bytea,p_descriptor jsonb)
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
  if w not between 1 and 4096 or w<>h or x is null or y is null or s is null or sw is null or sh is null or x<0 or y<0 or s<w or sw not between 1 and 4096 or sh not between 1 and 4096 or x+s>sw or y+s>sh or p_descriptor->'crop'<>jsonb_build_object('x',x,'y',y,'size',s) then raise exception using errcode='22023',message='COMBAT_CONTENT_MEDIA_CROP_INVALID'; end if;
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
commit;
