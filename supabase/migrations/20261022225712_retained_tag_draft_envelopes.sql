begin;
-- Retained drafts keep their original stable identity and 4000-character description envelope.
-- Handler membership and complete-record validation still apply to every draft write.
-- Only publication creates a canonical public snapshot; its constraints remain unchanged.
create or replace function app_private.validate_content_tag_presentation_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare d jsonb:=new.definition; word text;
begin
 if new.content_kind='tag' then
  if d->>'tagId' not in ('move','damage','pierce','healing','percentage-recovery','resource-change','apply-status','remove-status','return-to-turn-start','create-terrain','displace','poison','burn','bleed','barrier-change','copy-statuses','sensory','summon','damage-bonus') or d->>'tagId' is null then raise exception using errcode='22023',message='CONTENT_TAG_ID_INVALID'; end if;
  if tg_table_name='combat_content_versions' then
   if d->>'id' is distinct from 'tag.'||(d->>'tagId') then raise exception using errcode='22023',message='CONTENT_TAG_ID_INVALID'; end if;
   foreach word in array array['name','description','explanation'] loop
    if jsonb_typeof(d->word) is distinct from 'string' or length(d->>word) not between 1 and (case word when 'name' then 120 when 'description' then 240 else 2000 end) or d->>word<>btrim(d->>word) or d->>word ~ '[<>{}[:cntrl:]]' then raise exception using errcode='22023',message='CONTENT_TAG_TEXT_INVALID'; end if;
   end loop;
  end if;
 end if;
 new.definition:=app_private.bind_content_tag_presentation_v1(d,tg_table_name='combat_content_versions');
 return new;
end; $$;
-- CREATE OR REPLACE preserves the existing private ACL and both installed triggers.
commit;
