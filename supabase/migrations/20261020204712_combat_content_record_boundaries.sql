begin;

create function app_private.content_nonnegative_integer_v1(v jsonb)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='number' and v::text ~ '^[0-9]+$' and (v::text)::numeric<=9007199254740991,false);
$$;
-- Finite Requirement grammar, matching the existing shared parser. This only
-- validates authoring intent; no Item/transformation runtime is introduced.
create function app_private.validate_content_requirement_v1(r jsonb,depth integer default 1)
returns integer language plpgsql immutable set search_path='' as $$
declare k text:=r->>'kind'; allowed text[]; child jsonb; nodes integer:=1; n jsonb;
begin
 if depth>8 or jsonb_typeof(r) is distinct from 'object' then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 allowed:=case k
 when 'all' then array['kind','children'] when 'any' then array['kind','children']
 when 'resource-state' then array['kind','subject','resource','comparison','amount','basisPoints']
 when 'resource-threshold-crossing' then array['kind','subject','resource','direction','thresholdBasisPoints']
 when 'resource-change' then array['kind','subject','resource','direction','minimumAmount']
 when 'status-presence' then array['kind','subject','statusId','present']
 when 'prime-presence' then array['kind','subject','abilityId','present']
 when 'subject-relation' then array['kind','subject','otherSubject','relation']
 when 'event' then array['kind','eventType','phase']
 when 'action' then array['kind','classification','attackFamily','sourceDisciplineId','requiredTags'] end;
 if allowed is null or exists(select 1 from jsonb_object_keys(r) key where key<>all(allowed)) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 if k in ('all','any') then
  if jsonb_typeof(r->'children') is distinct from 'array' then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  if jsonb_array_length(r->'children') not between 1 and 127 then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  for child in select value from jsonb_array_elements(r->'children') loop
   nodes:=nodes+app_private.validate_content_requirement_v1(child,depth+1);
   if nodes>128 then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  end loop;
  return nodes;
 end if;
 if k not in ('event','action') and not coalesce(r->>'subject'=any(array['owner','selected','affected','triggering']),false) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 if k in ('resource-state','resource-threshold-crossing','resource-change') then
  if not coalesce(r->>'resource'=any(array['ap','mp','hp']),false) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  if k='resource-state' then
   if not coalesce(r->>'comparison'=any(array['at-most','at-least','less-than','more-than']),false) or (r?'amount')=(r?'basisPoints') then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
   n:=case when r?'amount' then r->'amount' else r->'basisPoints' end;
   if not app_private.content_nonnegative_integer_v1(n) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
   if r?'basisPoints' and n::text::numeric>10000 then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  elsif k='resource-change' then
   if not coalesce(r->>'direction'=any(array['gained','lost']),false) or not app_private.content_nonnegative_integer_v1(r->'minimumAmount') or r->'minimumAmount'='0'::jsonb then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  else
   if not coalesce(r->>'direction'=any(array['below','above']),false) or not app_private.content_nonnegative_integer_v1(r->'thresholdBasisPoints') then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
   if (r->>'thresholdBasisPoints')::numeric>10000 then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  end if;
 elsif k in ('status-presence','prime-presence') then
  if jsonb_typeof(r->'present') is distinct from 'boolean' then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  if k='status-presence' or r?'abilityId' then
   n:=case k when 'status-presence' then r->'statusId' else r->'abilityId' end;
   if jsonb_typeof(n) is distinct from 'string' or not coalesce(n#>>'{}' ~ '^[a-z0-9]+([._-][a-z0-9]+)*$',false) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  end if;
 elsif k='subject-relation' then
  if not coalesce(r->>'otherSubject'=any(array['owner','selected','affected','triggering']),false) or not coalesce(r->>'relation'=any(array['same-unit','ally','enemy']),false) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 elsif k='event' then
  if jsonb_typeof(r->'eventType') is distinct from 'string' or not coalesce(r->>'eventType' ~ '^[a-z0-9]+([._-][a-z0-9]+)*$',false) or not coalesce(r->>'phase'=any(array['before','after']),false) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 elsif k='action' then
  if not r ?| array['classification','attackFamily','sourceDisciplineId','requiredTags']
   or (r?'classification' and not coalesce(r->>'classification'=any(array['attack','recovery','utility']),false))
   or (r?'attackFamily' and not coalesce(r->>'attackFamily'=any(array['physical','mystic']),false))
   or (r?'sourceDisciplineId' and (jsonb_typeof(r->'sourceDisciplineId') is distinct from 'string' or not coalesce(r->>'sourceDisciplineId' ~ '^[a-z0-9]+([._-][a-z0-9]+)*$',false))) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  if r?'requiredTags' then
   if jsonb_typeof(r->'requiredTags') is distinct from 'array' then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
   if jsonb_array_length(r->'requiredTags') not between 1 and 16 or (select count(distinct value) from jsonb_array_elements(r->'requiredTags'))<>jsonb_array_length(r->'requiredTags') or exists(select 1 from jsonb_array_elements(r->'requiredTags') t where jsonb_typeof(t) is distinct from 'string' or not coalesce(t#>>'{}' ~ '^[a-z0-9]+([._-][a-z0-9]+)*$',false)) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  end if;
 end if;
 return nodes;
end; $$;

create function app_private.validate_content_command_v1(c jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare a text:=c->>'action'; allowed text[]; required text[]; key text;
begin
 allowed:=case a when 'create' then array['action','requestId','contentKind','definition','parentKey','expectedParentRevision'] when 'duplicate' then array['action','requestId','sourceKey','expectedSourceRevision'] when 'save' then array['action','expectedRevision','definition'] when 'restore' then array['action','expectedRevision','sourceVersion'] when 'archive' then array['action','expectedRevision'] when 'link' then array['action','expectedRevision','requestId','childKey'] when 'unlink' then array['action','expectedRevision','requestId','childKey'] end;
 required:=case when a='create' then array['action','requestId','contentKind','definition'] else allowed end;
 if jsonb_typeof(c) is distinct from 'object' or allowed is null or not c ?& required or exists(select 1 from jsonb_object_keys(c) k where k<>all(allowed)) then raise exception using errcode='22023',message='COMBAT_CONTENT_COMMAND_INVALID'; end if;
 if a='create' and (c?'parentKey')<>(c?'expectedParentRevision') then raise exception using errcode='22023',message='COMBAT_CONTENT_COMMAND_INVALID'; end if;
 foreach key in array array['expectedRevision','expectedSourceRevision','expectedParentRevision','sourceVersion'] loop
  if c?key and (not app_private.content_nonnegative_integer_v1(c->key) or c->key='0'::jsonb) then raise exception using errcode='22023',message='COMBAT_CONTENT_COMMAND_INVALID'; end if;
 end loop;
 foreach key in array array['parentKey','sourceKey','childKey'] loop
  if c?key and (jsonb_typeof(c->key) is distinct from 'string' or length(c->>key)>160 or not coalesce(c->>key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$',false)) then raise exception using errcode='22023',message='COMBAT_CONTENT_COMMAND_INVALID'; end if;
 end loop;
 if c?'requestId' and (jsonb_typeof(c->'requestId') is distinct from 'string' or not coalesce(c->>'requestId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',false)) then raise exception using errcode='22023',message='COMBAT_CONTENT_COMMAND_INVALID'; end if;
end; $$;
revoke all on function app_private.content_nonnegative_integer_v1(jsonb),app_private.validate_content_requirement_v1(jsonb,integer),app_private.validate_content_command_v1(jsonb) from public,anon,authenticated,service_role;

do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('app_private.validate_noncombat_content_v1(text,jsonb)'::regprocedure);
 old:='if d->>''itemClass'' not in';
 if strpos(d,old)=0 then raise exception 'CONTENT_VALIDATOR_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,$fix$if jsonb_typeof(d->'itemClass') is distinct from 'string' or jsonb_typeof(d->'usage') is distinct from 'string' or jsonb_typeof(d->'acquisition') is distinct from 'string' or d->>'itemClass' not in$fix$);
 old:=$old$  if d->'requirements'<>'null'::jsonb and (jsonb_typeof(d->'requirements')<>'object' or d->'requirements'->>'kind' is null or d->'requirements'->>'kind' not in ('all','any','resource-state','resource-crossing','event','action','status','prime','simple')) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;$old$;
 if strpos(d,old)=0 then raise exception 'CONTENT_REQUIREMENT_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,$fix$  if d->'requirements' is distinct from 'null'::jsonb then perform app_private.validate_content_requirement_v1(d->'requirements'); end if;$fix$);
 execute d;
 d:=pg_get_functiondef('public.write_combat_content_record_v1(uuid,uuid,text,jsonb)'::regprocedure);
 old:=' perform pg_catalog.pg_advisory_xact_lock';
 if strpos(d,old)=0 then raise exception 'CONTENT_COMMAND_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,E' perform app_private.validate_content_command_v1(p_command);\n perform pg_catalog.pg_advisory_xact_lock');
 old:='   v_kind:=source.content_kind;';
 if strpos(d,old)=0 then raise exception 'CONTENT_DUPLICATE_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,$fix$   if source.content_key in ('basic.move','unarmed.basic','basic.guard','basic.recover','basic.recover.mp') then raise exception using errcode='22023',message='COMBAT_CONTENT_BASIC_DUPLICATE_UNSUPPORTED'; end if;
   if source.lifecycle='archived' then raise exception using errcode='22023',message='COMBAT_CONTENT_ARCHIVED'; end if;
   v_kind:=source.content_kind;$fix$);
 execute d;
 d:=pg_get_functiondef('public.publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer)'::regprocedure);
 old:='version_floor=v_next,restore_pending=false,updated_by=';
 if strpos(d,old)=0 then raise exception 'CONTENT_ATTRIBUTION_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,'version_floor=v_next,restore_pending=false,restored_from=null,restored_by=null,updated_by=');
end; $migration$;
commit;
