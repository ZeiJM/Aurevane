begin;

-- Tag descriptions use the existing protected complete-record writer and immutable history.
-- Seed identity/search/floor metadata only: no text publication or battle capture is changed.
insert into app_private.combat_content_records(
  content_key,content_kind,lifecycle,version_floor,builtin_version,builtin_name,
  builtin_source_discipline_id
)
select r."contentKey",r."contentKind",'active',r."versionFloor",r."contentVersion",r.name,null
from jsonb_to_recordset($tag_wording_manifest$[
  {
    "contentKey": "tag.airborne",
    "contentKind": "tag",
    "name": "Airborne",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.barrier",
    "contentKind": "tag",
    "name": "Barrier",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.bleed",
    "contentKind": "tag",
    "name": "Bleed",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.blindside",
    "contentKind": "tag",
    "name": "Blindside",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.blindside-vulnerability",
    "contentKind": "tag",
    "name": "Blindside (debuff)",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.burn",
    "contentKind": "tag",
    "name": "Burn",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.challenged",
    "contentKind": "tag",
    "name": "Taunted",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.cleanse",
    "contentKind": "tag",
    "name": "Cleanse",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.cleanse-chilled",
    "contentKind": "tag",
    "name": "Cleanse Chilled",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.conditional-cleanse",
    "contentKind": "tag",
    "name": "Conditional Cleanse",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.conductive",
    "contentKind": "tag",
    "name": "Conductive",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.copy-buffs",
    "contentKind": "tag",
    "name": "Copy Buffs",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.copy-debuffs",
    "contentKind": "tag",
    "name": "Copy Debuffs",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.covert",
    "contentKind": "tag",
    "name": "Covert",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.damage",
    "contentKind": "tag",
    "name": "Damage",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.damage-bonus",
    "contentKind": "tag",
    "name": "Damage Bonus",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.dispel",
    "contentKind": "tag",
    "name": "Dispel",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.exposed",
    "contentKind": "tag",
    "name": "Vulnerable",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.fortified",
    "contentKind": "tag",
    "name": "Fortified",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.freeze-ground",
    "contentKind": "tag",
    "name": "Freeze Ground",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.frozen",
    "contentKind": "tag",
    "name": "Chilled",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.guarded",
    "contentKind": "tag",
    "name": "Guard",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.haste",
    "contentKind": "tag",
    "name": "Haste",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.healing",
    "contentKind": "tag",
    "name": "HP Recovery (fixed amount)",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.hexed",
    "contentKind": "tag",
    "name": "Healing Down",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.hp-recovery",
    "contentKind": "tag",
    "name": "HP Recovery",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.inspired",
    "contentKind": "tag",
    "name": "Damage Up",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.invisible",
    "contentKind": "tag",
    "name": "Invisible",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.lowered-guard",
    "contentKind": "tag",
    "name": "Defenseless",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.mark",
    "contentKind": "tag",
    "name": "Marked",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.move",
    "contentKind": "tag",
    "name": "Move",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.mp-drain",
    "contentKind": "tag",
    "name": "MP Drain",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.mp-recovery",
    "contentKind": "tag",
    "name": "MP Recovery",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.mp-restore",
    "contentKind": "tag",
    "name": "MP Restore",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.pierce",
    "contentKind": "tag",
    "name": "Pierce",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.poison",
    "contentKind": "tag",
    "name": "Poison",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.pull",
    "contentKind": "tag",
    "name": "Pull",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.push",
    "contentKind": "tag",
    "name": "Push",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.reckless",
    "contentKind": "tag",
    "name": "Reckless",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.reveal",
    "contentKind": "tag",
    "name": "Reveal",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.revealed",
    "contentKind": "tag",
    "name": "Revealed",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.rewind",
    "contentKind": "tag",
    "name": "Rewind",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.root",
    "contentKind": "tag",
    "name": "Rooted",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.slow",
    "contentKind": "tag",
    "name": "Slow",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.summon",
    "contentKind": "tag",
    "name": "Summon",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.suppress",
    "contentKind": "tag",
    "name": "Suppress",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.vengeance",
    "contentKind": "tag",
    "name": "Vengeance",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.warded",
    "contentKind": "tag",
    "name": "Burn Ward",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  },
  {
    "contentKey": "tag.wet",
    "contentKind": "tag",
    "name": "Drenched",
    "contentVersion": 1,
    "versionFloor": 1,
    "sourceDisciplineId": null
  }
]$tag_wording_manifest$::jsonb)
  as r("contentKey" text,"contentKind" text,name text,"contentVersion" integer,"versionFloor" integer,"sourceDisciplineId" text)
on conflict(content_key) do update set
  builtin_version=excluded.builtin_version,
  builtin_name=excluded.builtin_name,
  version_floor=greatest(app_private.combat_content_records.version_floor,excluded.version_floor)
where app_private.combat_content_records.content_kind='tag';


-- Presentation identities remain separate from mechanical opcodes. Unknown ids create no handler.
create function app_private.content_presentation_tag_ids_v1() returns text[]
language sql immutable set search_path='' as $function$
 select array['airborne','apply-status','barrier','barrier-change','bleed','blindside','blindside-vulnerability','burn','challenged','cleanse','cleanse-chilled','conditional-cleanse','conductive','copy-buffs','copy-debuffs','copy-statuses','covert','create-terrain','damage','damage-bonus','dispel','displace','exposed','fortified','freeze-ground','frozen','guarded','haste','healing','hexed','hp-recovery','inspired','invisible','lowered-guard','mark','move','mp-drain','mp-recovery','mp-restore','percentage-recovery','pierce','poison','pull','push','reckless','remove-status','resource-change','return-to-turn-start','reveal','revealed','rewind','root','sensory','slow','summon','suppress','vengeance','warded','wet']::text[];
$function$;

create function app_private.content_effect_presentation_id_v1(p jsonb) returns text
language plpgsql immutable strict set search_path='' as $function$
declare ids jsonb:=coalesce(p->'statusIds','[]'::jsonb); positive text[]:=array['guarded','inspired','invisible','airborne','blindside','haste','fortified','warded','absorb-hp','absorb-mp','reflect','amplify'];
begin
 case p->>'type'
 when 'damage' then
  return case when p->'vengeance' is not null and p->'vengeance'<>'null'::jsonb then 'vengeance'
   when p->'shattersBarrier'='true'::jsonb or p->'piercing'='true'::jsonb then 'pierce' else 'damage' end;
 when 'apply-status' then return p->>'statusId';
 when 'percentage-recovery' then return case when p->>'resource'='mp' then 'mp-recovery' else 'hp-recovery' end;
 when 'resource-change' then return case when (p->>'delta')::numeric<0 then 'mp-drain' else 'mp-restore' end;
 when 'barrier-change' then return 'barrier';
 when 'copy-statuses' then return case when p->>'mode'='curse' then 'copy-debuffs' else 'copy-buffs' end;
 when 'remove-status' then
  if p->>'removalMode'='specified' then
   return case when jsonb_array_length(ids)>0 and not exists(select 1 from jsonb_array_elements_text(ids) x where x<>all(positive||array['covert'])) then 'dispel' else 'conditional-cleanse' end;
  end if;
  if ids='["frozen"]'::jsonb then return 'cleanse-chilled'; end if;
  return case when jsonb_array_length(ids)>0 and not exists(select 1 from jsonb_array_elements_text(ids) x where x<>all(positive)) then 'dispel' else 'cleanse' end;
 when 'sensory' then return 'reveal';
 when 'return-to-turn-start' then return 'rewind';
 when 'create-terrain' then return 'freeze-ground';
 when 'displace' then return coalesce(p->>'direction','push');
 else return p->>'type';
 end case;
end;
$function$;

create function app_private.content_tag_text_valid_v1(word text,field_name text) returns boolean
language plpgsql immutable strict set search_path='' as $function$
declare cleaned text:=word; limit_length integer; token_count integer;
begin
 limit_length:=case field_name when 'name' then 120 when 'description' then 240 when 'explanation' then 2000 end;
 if limit_length is null or length(word) not between 1 and limit_length or word<>btrim(word) then return false; end if;
 if field_name<>'name' then cleaned:=replace(cleaned,'{summary}',''); end if;
 if field_name='explanation' then cleaned:=replace(cleaned,'{details}',''); end if;
 token_count:=(length(word)-length(cleaned))/9;
 if token_count>4 or cleaned ~ '[<>{}]' then return false; end if;
 if field_name='explanation' then cleaned:=replace(cleaned,E'\n',''); end if;
 return cleaned !~ '[[:cntrl:]]';
end;
$function$;

create or replace function app_private.validate_content_tag_presentation_v1() returns trigger
language plpgsql security definer set search_path='' as $function$
declare d jsonb:=new.definition; word text;
begin
 if new.content_kind='tag' then
  if d->>'tagId' is null or not(d->>'tagId'=any(app_private.content_presentation_tag_ids_v1())) then
   raise exception using errcode='22023',message='CONTENT_TAG_ID_INVALID';
  end if;
  if tg_table_name='combat_content_versions' then
   if d->>'id' is distinct from 'tag.'||(d->>'tagId') then raise exception using errcode='22023',message='CONTENT_TAG_ID_INVALID'; end if;
   foreach word in array array['name','description','explanation'] loop
    if jsonb_typeof(d->word) is distinct from 'string' or not coalesce(app_private.content_tag_text_valid_v1(d->>word,word),false) then
     raise exception using errcode='22023',message='CONTENT_TAG_TEXT_INVALID';
    end if;
   end loop;
  end if;
 end if;
 new.definition:=app_private.bind_content_tag_presentation_v1(d,tg_table_name='combat_content_versions');
 return new;
end;
$function$;

create or replace function app_private.bind_content_tag_presentation_v1(d jsonb,capture_current boolean,depth integer default 0) returns jsonb
language plpgsql stable set search_path='' as $function$
declare result jsonb:=d; entry record; ref jsonb; expected jsonb; selected jsonb; payloads jsonb;
begin
 if depth>64 then raise exception using errcode='22023',message='CONTENT_TAG_DEPTH_INVALID'; end if;
 if jsonb_typeof(d)='array' then
  select coalesce(jsonb_agg(app_private.bind_content_tag_presentation_v1(e.value,capture_current,depth+1) order by e.ordinality),'[]') into result from jsonb_array_elements(d) with ordinality e;
 elsif jsonb_typeof(d)='object' then
  if jsonb_typeof(d->'behaviors')='array' then
   select coalesce(jsonb_agg(e->'payload'),'[]'::jsonb) into payloads
   from jsonb_array_elements(d->'behaviors') b
   cross join lateral jsonb_array_elements(case when jsonb_typeof(b->'effects')='array' then b->'effects' else '[]'::jsonb end) e;
  elsif not(d ? 'ability') and jsonb_typeof(d->'id')='string' and jsonb_typeof(d->'contentVersion')='number' then
   payloads:=case
    when jsonb_typeof(d->'effects')='array' then d->'effects'
    when jsonb_typeof(d->'trigger'->'resultEffects')='array' then d->'trigger'->'resultEffects'
    when jsonb_typeof(d->'trigger'->'payoffEffects')='array' then d->'trigger'->'payoffEffects'
    else null end;
  end if;
  if d ? 'tagPresentation' then
   if jsonb_typeof(d->'tagPresentation')<>'array' or jsonb_array_length(d->'tagPresentation')>cardinality(app_private.content_presentation_tag_ids_v1()) or payloads is null then raise exception using errcode='22023',message='CONTENT_TAG_REFERENCE_INVALID'; end if;
   for ref in select value from jsonb_array_elements(d->'tagPresentation') loop
    select app_private.content_tag_snapshot_v1(v.definition) into expected from app_private.combat_content_versions v where v.content_kind='tag' and v.content_key=ref->>'contentKey' and v.content_version::text=ref->>'contentVersion';
    if expected is null or expected<>ref then raise exception using errcode='22023',message='CONTENT_TAG_REFERENCE_INVALID'; end if;
   end loop;
   if (select count(*)<>count(distinct e->>'tagId') from jsonb_array_elements(d->'tagPresentation') e) then raise exception using errcode='22023',message='CONTENT_TAG_REFERENCE_INVALID'; end if;
  end if;
  for entry in select * from jsonb_each(d) where key<>'tagPresentation' loop
   result:=jsonb_set(result,array[entry.key],app_private.bind_content_tag_presentation_v1(entry.value,capture_current,depth+1));
  end loop;
  if capture_current and payloads is not null then
   select coalesce(jsonb_agg(app_private.content_tag_snapshot_v1(v.definition) order by v.content_key),'[]') into selected
   from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id
   where v.content_kind='tag' and v.definition->'enabled'='true'::jsonb and v.definition->>'tagId' in (
    select x.id from jsonb_array_elements(payloads) e
    cross join lateral (values(e->>'type'),(app_private.content_effect_presentation_id_v1(e))) x(id));
   if selected<>'[]'::jsonb or d ? 'tagPresentation' then result:=jsonb_set(result,'{tagPresentation}',selected); end if;
  end if;
 end if;
 return result;
end;
$function$;

revoke all on function app_private.content_presentation_tag_ids_v1(),app_private.content_effect_presentation_id_v1(jsonb),app_private.content_tag_text_valid_v1(text,text) from public,anon,authenticated,service_role;
-- CREATE OR REPLACE retains the private ACLs and the installed draft/version triggers.

commit;
