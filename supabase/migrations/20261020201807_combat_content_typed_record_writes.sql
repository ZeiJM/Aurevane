begin;
create function app_private.validate_noncombat_content_v1(p_kind text,d jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare v_allowed text[]:=array['schemaVersion','id','contentVersion','name','description','sortOrder','enabled','media'];
 v_key text; v_text text; v_core_total integer:=0; v_part jsonb;
begin
 if p_kind not in ('discipline','tag','item','ascension','severence') then return; end if;
 v_allowed:=v_allowed||case p_kind when 'discipline' then array['core','focus','enabledForPrimary','enabledForSecondary','linkedSkills','unlock'] when 'tag' then array['tagId','explanation'] when 'item' then array['requirements','ability','itemClass','usage','equipmentSlot','acquisition'] else array['requirements','ability','formName','transformation'] end;
 if exists(select 1 from jsonb_object_keys(d) key where key<>all(v_allowed))
  or not d ?& v_allowed or d->'schemaVersion' is distinct from '1'::jsonb
  or jsonb_typeof(d->'contentVersion') is distinct from 'number' or (d->>'contentVersion') !~ '^[1-9][0-9]{0,8}$'
  or jsonb_typeof(d->'sortOrder') is distinct from 'number' or (d->>'sortOrder') !~ '^[0-9]{1,7}$' or (d->>'sortOrder')::numeric>1000000
  or jsonb_typeof(d->'enabled') is distinct from 'boolean'
  or jsonb_typeof(d->'media') is distinct from 'object' then
  raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 foreach v_key in array array['name','description'] loop
  v_text:=d->>v_key;
  if jsonb_typeof(d->v_key) is distinct from 'string' or length(v_text) not between 1 and (case v_key when 'name' then 120 else 4000 end)
    or v_text<>btrim(v_text,E' \t\n\r'||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279))
    or v_text~'[[:cntrl:]]' then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 end loop;
 if exists(select 1 from jsonb_each(d->'media') e where e.key<>'artworkId' or jsonb_typeof(e.value)<>'string' or (e.value#>>'{}') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$') then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 if p_kind='item' then
  if d->>'itemClass' not in ('weapon','armor','accessory','consumable','tool','material','relic','key')
   or d->>'usage' not in ('active','passive','none') or d->>'acquisition'<>'unimplemented'
   or (d->'equipmentSlot'<>'null'::jsonb and (d->>'equipmentSlot' not in ('weapon','armor','accessory') or d->>'equipmentSlot'<>d->>'itemClass')) then
   raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 elsif p_kind in ('ascension','severence') then
  if jsonb_typeof(d->'formName') is distinct from 'string' or length(btrim(d->>'formName')) not between 1 and 120
   or jsonb_typeof(d->'transformation') is distinct from 'object' or d->'transformation'->>'kind' is distinct from p_kind
   or jsonb_typeof(d->'transformation'->'description') is distinct from 'string' or length(btrim(d->'transformation'->>'description')) not between 1 and 2000
   or exists(select 1 from jsonb_object_keys(d->'transformation') k where k not in ('kind','description')) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 elsif p_kind='discipline' then
  if jsonb_typeof(d->'core') is distinct from 'object' or jsonb_typeof(d->'focus') is distinct from 'array' or jsonb_array_length(d->'focus') not between 2 and 3
   or jsonb_typeof(d->'linkedSkills') is distinct from 'array' or jsonb_array_length(d->'linkedSkills')>256
   or d->'unlock' is distinct from '{"kind":"unavailable"}'::jsonb or jsonb_typeof(d->'enabledForPrimary') is distinct from 'boolean' or jsonb_typeof(d->'enabledForSecondary') is distinct from 'boolean'
   then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  foreach v_key in array array['might','finesse','vitality','agility','intellect','resolve'] loop
   if jsonb_typeof(d->'core'->v_key) is distinct from 'number' or (d->'core'->>v_key) !~ '^[1-9][0-9]?$' then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
   v_core_total:=v_core_total+(d->'core'->>v_key)::integer;
  end loop;
  if v_core_total<>31 or (select count(*) from jsonb_object_keys(d->'core'))<>6
   or (select count(distinct value) from jsonb_array_elements(d->'focus'))<>jsonb_array_length(d->'focus')
   or exists(select 1 from jsonb_array_elements_text(d->'focus') f where f not in ('might','finesse','vitality','agility','intellect','resolve'))
   or exists(select 1 from jsonb_array_elements(d->'linkedSkills') s where jsonb_typeof(s)<>'string' or (s#>>'{}') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$') then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 elsif p_kind='tag' then
  if jsonb_typeof(d->'tagId') is distinct from 'string' or length(d->>'tagId') not between 1 and 160 or jsonb_typeof(d->'explanation') is distinct from 'string' or length(btrim(d->>'explanation')) not between 1 and 2000 then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 end if;
 if p_kind in ('item','ascension','severence') then
  if d->'requirements'<>'null'::jsonb and (jsonb_typeof(d->'requirements')<>'object' or d->'requirements'->>'kind' is null or d->'requirements'->>'kind' not in ('all','any','resource-state','resource-crossing','event','action','status','prime','simple')) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
  if d->'ability'<>'null'::jsonb and (jsonb_typeof(d->'ability')<>'object' or d->'ability'->'schemaVersion' is distinct from '1'::jsonb or jsonb_typeof(d->'ability'->'behaviors') is distinct from 'array' or jsonb_array_length(d->'ability'->'behaviors') not between 1 and 16) then raise exception using errcode='22023',message='COMBAT_CONTENT_DEFINITION_INVALID'; end if;
 end if;
end; $$;
revoke all on function app_private.validate_noncombat_content_v1(text,jsonb) from public,anon,authenticated,service_role;

do $migration$
declare v_definition text; v_original text;
begin
 v_definition:=pg_get_functiondef('app_private.validate_content_record_identity_v1(text,text,jsonb)'::regprocedure);
 v_original:=E'begin\n if p_key';
 if strpos(v_definition,v_original)=0 then raise exception 'CONTENT_IDENTITY_PREDECESSOR_CONFLICT'; end if;
 execute replace(v_definition,v_original,E'begin\n perform app_private.validate_noncombat_content_v1(p_kind,p_definition);\n if p_key');
 v_definition:=pg_get_functiondef('public.write_combat_content_record_v1(uuid,uuid,text,jsonb)'::regprocedure);
 v_original:=$before$if v_action in ('create','duplicate') then
  if p_command->>'requestId'$before$;
 if strpos(v_definition,v_original)=0 then raise exception 'CONTENT_WRITE_PREDECESSOR_CONFLICT'; end if;
 v_definition:=replace(v_definition,v_original,$after$if v_action in ('create','duplicate','link','unlink') then
  if p_command->>'requestId'$after$);
 v_original:=' v_result:=app_private.combat_content_record_json_v1(p_content_key);';
 if strpos(v_definition,v_original)=0 then raise exception 'CONTENT_WRITE_PREDECESSOR_CONFLICT'; end if;
 v_definition:=replace(v_definition,v_original,$parent$
 if v_action='create' and p_command ? 'parentKey' then
  select * into source from app_private.combat_content_records where content_key=p_command->>'parentKey' for update;
  if source.content_key is null or source.revision is distinct from (p_command->>'expectedParentRevision')::bigint then raise exception using errcode='40001',message='COMBAT_CONTENT_RECORD_CONFLICT'; end if;
  if source.content_kind<>'discipline' or source.lifecycle='archived' or r.content_kind<>'skill' then raise exception using errcode='22023',message='COMBAT_CONTENT_LINK_INVALID'; end if;
  insert into app_private.combat_content_links values(source.content_key,p_content_key);
  update app_private.combat_content_records set revision=revision+1,updated_by=p_actor_user_id,updated_at=clock_timestamp() where content_key=source.content_key;
 end if;
 v_result:=app_private.combat_content_record_json_v1(p_content_key);
$parent$);
 execute v_definition;
end; $migration$;
commit;
