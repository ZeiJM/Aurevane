begin;

-- The finite current authoring contract is eight assigned Discipline Skills.
-- Do not rewrite immutable definitions or any captured battle data.
do $migration$
declare d text;
begin
  d:=pg_get_functiondef('app_private.validate_noncombat_content_v1(text,jsonb)'::regprocedure);
  if strpos(d, 'jsonb_array_length(d->''linkedSkills'')>256')=0 then
    raise exception 'DISCIPLINE_CAPACITY_VALIDATOR_PREDECESSOR_CONFLICT';
  end if;
  execute replace(d, 'jsonb_array_length(d->''linkedSkills'')>256', 'jsonb_array_length(d->''linkedSkills'')>8');
  d:=pg_get_functiondef('app_private.validate_discipline_envelope_before_override_v1(jsonb)'::regprocedure);
  if strpos(d, 'jsonb_array_length(d->''skillStages'')>256')=0 then
    raise exception 'DISCIPLINE_STAGE_CAPACITY_PREDECESSOR_CONFLICT';
  end if;
  execute replace(d, 'jsonb_array_length(d->''skillStages'')>256', 'jsonb_array_length(d->''skillStages'')>8');
end;
$migration$;

create or replace function app_private.bound_content_links_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb; count_skills integer;
begin
  -- Every insert path shares this parent lock, including direct trusted SQL.
  perform 1 from app_private.combat_content_records where content_key=new.parent_key for update;
  select coalesce(draft.definition,version.definition,
    public.get_builtin_discipline_definition_v1(record.content_key)) into d
  from app_private.combat_content_records record
  left join app_private.combat_content_drafts draft on draft.content_key=record.content_key
  left join app_private.combat_content_publications publication on publication.content_key=record.content_key
  left join app_private.combat_content_versions version on version.id=publication.version_id
  where record.content_key=new.parent_key;
  select count(*) into count_skills from (
    select child_key from app_private.combat_content_links where parent_key=new.parent_key
    union select jsonb_array_elements_text(coalesce(d->'linkedSkills','[]'::jsonb))
    union select new.child_key
  ) assigned;
  if count_skills>8 then
    raise exception using errcode='22023',message='COMBAT_CONTENT_LINK_LIMIT';
  end if;
  return new;
end; $$;
revoke all on function app_private.bound_content_links_v1() from public,anon,authenticated,service_role;

commit;
