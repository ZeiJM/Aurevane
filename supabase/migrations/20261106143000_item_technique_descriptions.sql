begin;

-- Additive grammar only: authored successors use normal authority; history stays literal.
create function app_private.assert_item_technique_description_shape_v1(d jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare binding record; purpose text;
 trim_characters text := E' \t\n\r\f' || chr(11) || chr(160) || chr(5760) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279);
begin
 for binding in select * from jsonb_each(case when jsonb_typeof(d->'actions')='object' then d->'actions' else '{}'::jsonb end) loop
  if not (binding.value ? 'description') then continue; end if;
  purpose := binding.value->>'description';
  if binding.key<>'support' or d->>'itemClass' is distinct from 'weapon'
   or jsonb_typeof(binding.value->'description') is distinct from 'string'
   or char_length(purpose) not between 1 and 400
   or purpose is distinct from btrim(purpose,trim_characters)
   or purpose ~ ('[' || chr(1) || '-' || chr(31) || chr(127) || ']') then
   raise exception using errcode='22023',message='ITEM_DESCRIPTION_INVALID';
  end if;
 end loop;
end; $$;

do $$
declare src text; anchor text;
begin
 src:=pg_get_functiondef('app_private.assert_runtime_item_shape_v1(jsonb)'::regprocedure);
 anchor:='(role.value-''behaviorId''-''name''-''media'')';
 if strpos(src,anchor)=0 then raise exception 'Item binding whitelist anchor changed'; end if;
 src:=replace(src,anchor,'(role.value-''behaviorId''-''name''-''media''-''description'')');
 anchor:='begin';
 src:=replace(src,anchor,anchor||E'\n perform app_private.assert_item_technique_description_shape_v1(d);');
 execute src;
end; $$;
revoke all on function app_private.assert_item_technique_description_shape_v1(jsonb) from public,anon,authenticated,service_role;
commit;
