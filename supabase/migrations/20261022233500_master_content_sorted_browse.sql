begin;
-- Preserve the selected-actor signature/ACL and legacy key cursor. A structured
-- cursor carries ordering and the last immutable comparison values, not a row offset.
create or replace function public.list_combat_content_records_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_kind text,p_lifecycle text,p_search text,p_after text,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; selector jsonb; cursor_value jsonb; ordering text := 'key-asc';
 structured boolean := false; cursor_key text := p_after; cursor_name text; last_row jsonb;
begin
 perform app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id);
 if p_limit is null or p_limit not between 1 and 100 or length(coalesce(p_search,''))>160
  or length(coalesce(p_after,''))>2000
  or (p_kind is not null and p_kind not in ('basic','discipline-skill','skill','essence','resonance','status','effect-profile','discipline','tag','item','ascension','severence'))
  or (p_lifecycle is not null and p_lifecycle not in ('draft','active','archived')) then
  raise exception using errcode='22023',message='COMBAT_CONTENT_LIST_INVALID'; end if;
 if left(p_after,1)='{' then
  structured := true; selector := p_after::jsonb; ordering := selector->>'sort';
  cursor_value := nullif(selector->'after','null'::jsonb);
  if jsonb_typeof(selector) is distinct from 'object' or ordering is null
   or ordering not in ('key-asc','key-desc','name-asc','name-desc')
   or exists(select 1 from jsonb_object_keys(selector) k where k not in ('sort','after')) then
   raise exception using errcode='22023',message='COMBAT_CONTENT_LIST_INVALID'; end if;
  cursor_key := null;
  if cursor_value is not null then
   if jsonb_typeof(cursor_value) is distinct from 'object'
    or cursor_value->>'sort' is distinct from ordering
    or jsonb_typeof(cursor_value->'key') is distinct from 'string'
    or jsonb_typeof(cursor_value->'name') is distinct from 'string'
    or length(cursor_value->>'name')>400
    or exists(select 1 from jsonb_object_keys(cursor_value) k where k not in ('sort','key','name')) then
    raise exception using errcode='22023',message='COMBAT_CONTENT_CURSOR_INVALID'; end if;
   cursor_key := cursor_value->>'key'; cursor_name := cursor_value->>'name';
  end if;
 end if;
 if cursor_key is not null and (length(cursor_key)>160 or cursor_key !~ '^[a-z0-9]+([._-][a-z0-9]+)*$') then
  raise exception using errcode='22023',message='COMBAT_CONTENT_CURSOR_INVALID'; end if;
 with matching as (
  select r.content_key as "contentKey",r.content_kind as "contentKind",r.lifecycle,r.revision,
   coalesce(d.definition->>'name',v.definition->>'name',r.builtin_name,r.content_key) as name
  from app_private.combat_content_records r
  left join app_private.combat_content_drafts d using(content_key)
  left join app_private.combat_content_publications p using(content_key)
  left join app_private.combat_content_versions v on v.id=p.version_id
  where (p_kind is null or r.content_kind=p_kind
   or (p_kind='basic' and r.content_kind='skill' and r.content_key in ('basic.move','unarmed.basic','basic.guard','basic.recover','basic.recover.mp'))
   or (p_kind='discipline-skill' and r.content_kind='skill' and r.content_key not in ('basic.move','unarmed.basic','basic.guard','basic.recover','basic.recover.mp'))) and (p_lifecycle is null or r.lifecycle=p_lifecycle)
 ), filtered as (
  select * from matching m where
   (p_search is null or position(lower(p_search) in lower(m."contentKey"||' '||m.name))>0)
   and (cursor_key is null or
    (ordering='key-asc' and m."contentKey" collate "C">cursor_key collate "C") or
    (ordering='key-desc' and m."contentKey" collate "C"<cursor_key collate "C") or
    (ordering='name-asc' and (lower(m.name) collate "C",m."contentKey" collate "C")>(lower(cursor_name) collate "C",cursor_key collate "C")) or
    (ordering='name-desc' and (lower(m.name) collate "C"<lower(cursor_name) collate "C" or
      (lower(m.name) collate "C"=lower(cursor_name) collate "C" and m."contentKey" collate "C">cursor_key collate "C"))))
 ), numbered as (
  select f.*,row_number() over(order by
   case when ordering='name-asc' then lower(f.name) end collate "C" asc,
   case when ordering='name-desc' then lower(f.name) end collate "C" desc,
   case when ordering='key-desc' then f."contentKey" end collate "C" desc,
   f."contentKey" collate "C" asc) as ordinal from filtered f
 ) select coalesce(jsonb_agg(to_jsonb(n)-'ordinal' order by n.ordinal),'[]') into result
 from (select * from numbered order by ordinal limit p_limit) n;
 last_row := result->-1;
 return jsonb_build_object('records',result,'nextCursor',case when jsonb_array_length(result)=p_limit then
  case when structured then jsonb_build_object('sort',ordering,'key',last_row->>'contentKey','name',last_row->>'name')::text
   else last_row->>'contentKey' end else null end);
end; $$;
comment on function public.list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer) is 'Selected-actor content metadata browse; bounded global ordering with legacy key-cursor compatibility.';
commit;
