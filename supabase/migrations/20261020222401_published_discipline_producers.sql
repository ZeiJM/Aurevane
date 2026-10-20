begin;

-- Current selection is explicit. Physical historical definitions and Core profiles remain pinned.
create table app_private.discipline_current_definitions (
 discipline_id text primary key,
 definition_version integer not null,
 foreign key (discipline_id,definition_version) references app_private.discipline_definitions(discipline_id,definition_version)
);
alter table app_private.discipline_current_definitions enable row level security;
revoke all on table app_private.discipline_current_definitions from public,anon,authenticated,service_role;
insert into app_private.discipline_current_definitions
 select discipline_id,max(definition_version) from app_private.discipline_definitions group by discipline_id;

create function app_private.current_discipline_definitions_v1()
returns setof app_private.discipline_definitions language sql stable security definer set search_path='' as $$
 select d.* from app_private.discipline_current_definitions c
 join app_private.discipline_definitions d using(discipline_id,definition_version)
 where not exists(select 1 from app_private.combat_content_records r where r.content_key=d.discipline_id and r.lifecycle='archived');
$$;

create function app_private.validate_authored_discipline_unlock_v1(d jsonb,p_self text,p_depth integer default 0)
returns void language plpgsql immutable set search_path='' as $$
declare r jsonb;
begin
 if p_depth>8 or jsonb_typeof(d) is distinct from 'object' then raise exception using errcode='22023',message='DISCIPLINE_UNLOCK_UNSUPPORTED'; end if;
 case d->>'kind'
 when 'always' then
  if d<>'{"kind":"always"}'::jsonb then raise exception using errcode='22023',message='DISCIPLINE_UNLOCK_UNSUPPORTED'; end if;
 when 'mastery' then
  if not d ?& array['kind','disciplineId','minimumStage'] or exists(select 1 from jsonb_object_keys(d) k where k not in ('kind','disciplineId','minimumStage'))
   or jsonb_typeof(d->'disciplineId') is distinct from 'string' or (d->>'disciplineId') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' or d->>'disciplineId'=p_self
   or jsonb_typeof(d->'minimumStage') is distinct from 'number' or (d->>'minimumStage') !~ '^[1-5]$' then raise exception using errcode='22023',message='DISCIPLINE_UNLOCK_UNSUPPORTED'; end if;
 when 'rekindling' then
  if not d ?& array['kind','minimumCount'] or exists(select 1 from jsonb_object_keys(d) k where k not in ('kind','minimumCount'))
   or jsonb_typeof(d->'minimumCount') is distinct from 'number' or (d->>'minimumCount') !~ '^[1-3]$' then raise exception using errcode='22023',message='DISCIPLINE_UNLOCK_UNSUPPORTED'; end if;
 when 'all' then
  if exists(select 1 from jsonb_object_keys(d) k where k not in ('kind','rules')) or jsonb_typeof(d->'rules') is distinct from 'array' then raise exception using errcode='22023',message='DISCIPLINE_UNLOCK_UNSUPPORTED'; end if;
  if jsonb_array_length(d->'rules') not between 1 and 32 then raise exception using errcode='22023',message='DISCIPLINE_UNLOCK_UNSUPPORTED'; end if;
  for r in select value from jsonb_array_elements(d->'rules') loop perform app_private.validate_authored_discipline_unlock_v1(r,p_self,p_depth+1); end loop;
 else raise exception using errcode='22023',message='DISCIPLINE_UNLOCK_UNSUPPORTED';
 end case;
end; $$;

create function app_private.validate_authored_discipline_envelope_v1(d jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare s jsonb; a text; seen text[]:='{}';
begin
 if not d ?& array['atlas','skillStages','essenceId','resonanceSelections'] then raise exception using errcode='22023',message='DISCIPLINE_PUBLICATION_INCOMPLETE'; end if;
 if d->'unlock' is distinct from '{"kind":"unavailable"}'::jsonb then perform app_private.validate_authored_discipline_unlock_v1(d->'unlock',d->>'id'); end if;
 if jsonb_typeof(d->'atlas') is distinct from 'object' then raise exception using errcode='22023',message='DISCIPLINE_ATLAS_INVALID'; end if;
 if not (d->'atlas') ?& array['family','band','disclosure','power']
  or exists(select 1 from jsonb_object_keys(d->'atlas') k where k not in ('family','band','disclosure','power'))
  or jsonb_typeof(d->'atlas'->'family') is distinct from 'string' or d->'atlas'->>'family' not in ('foundation','martial','hybrid','mage','support')
  or jsonb_typeof(d->'atlas'->'band') is distinct from 'string' or d->'atlas'->>'band' not in ('foundation','first-journey','rekindling-1','rekindling-2','rekindling-3')
  or d->'atlas'->>'disclosure' is distinct from 'open' or jsonb_typeof(d->'atlas'->'power') is distinct from 'object'
 then raise exception using errcode='22023',message='DISCIPLINE_ATLAS_INVALID'; end if;
 if exists(select 1 from jsonb_object_keys(d->'atlas'->'power') k where k not in ('reliability','flexibility','setup','ruleAccess','execution')) then raise exception using errcode='22023',message='DISCIPLINE_ATLAS_INVALID'; end if;
 foreach a in array array['reliability','flexibility','setup','ruleAccess','execution'] loop
  if jsonb_typeof(d->'atlas'->'power'->a) is distinct from 'number' or (d->'atlas'->'power'->>a) !~ '^[1-5]$' then raise exception using errcode='22023',message='DISCIPLINE_ATLAS_INVALID'; end if;
 end loop;
 if jsonb_typeof(d->'linkedSkills') is distinct from 'array' or jsonb_typeof(d->'skillStages') is distinct from 'array' then raise exception using errcode='22023',message='DISCIPLINE_SKILL_STAGES_INVALID'; end if;
 if jsonb_array_length(d->'skillStages')<>jsonb_array_length(d->'linkedSkills') or jsonb_array_length(d->'skillStages')>256 then raise exception using errcode='22023',message='DISCIPLINE_SKILL_STAGES_INVALID'; end if;
 for s in select value from jsonb_array_elements(d->'skillStages') loop
  if jsonb_typeof(s) is distinct from 'object' then raise exception using errcode='22023',message='DISCIPLINE_SKILL_STAGES_INVALID'; end if;
  if not s ?& array['skillId','minimumStage'] or exists(select 1 from jsonb_object_keys(s) k where k not in ('skillId','minimumStage'))
   or jsonb_typeof(s->'skillId') is distinct from 'string' or (s->>'skillId')=any(seen)
   or not (d->'linkedSkills') @> jsonb_build_array(s->'skillId')
   or jsonb_typeof(s->'minimumStage') is distinct from 'number' or (s->>'minimumStage') !~ '^[1-5]$' then raise exception using errcode='22023',message='DISCIPLINE_SKILL_STAGES_INVALID'; end if;
  seen:=array_append(seen,s->>'skillId');
 end loop;
 if d->'essenceId'<>'null'::jsonb and (jsonb_typeof(d->'essenceId') is distinct from 'string' or (d->>'essenceId') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$') then raise exception using errcode='22023',message='DISCIPLINE_ESSENCE_INVALID'; end if;
 if jsonb_typeof(d->'resonanceSelections') is distinct from 'array' then raise exception using errcode='22023',message='DISCIPLINE_RESONANCE_INVALID'; end if;
 if jsonb_array_length(d->'resonanceSelections')>256 then raise exception using errcode='22023',message='DISCIPLINE_RESONANCE_INVALID'; end if;
 seen:='{}';
 for s in select value from jsonb_array_elements(d->'resonanceSelections') loop
  if jsonb_typeof(s) is distinct from 'object' then raise exception using errcode='22023',message='DISCIPLINE_RESONANCE_INVALID'; end if;
  if not s ?& array['withDisciplineId','resonanceId'] or exists(select 1 from jsonb_object_keys(s) k where k not in ('withDisciplineId','resonanceId'))
   or jsonb_typeof(s->'withDisciplineId') is distinct from 'string' or (s->>'withDisciplineId') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
   or s->>'withDisciplineId'=d->>'id' or (s->>'withDisciplineId')=any(seen)
   or jsonb_typeof(s->'resonanceId') is distinct from 'string' or (s->>'resonanceId') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
   then raise exception using errcode='22023',message='DISCIPLINE_RESONANCE_INVALID'; end if;
  seen:=array_append(seen,s->>'withDisciplineId');
 end loop;
end; $$;

-- Preserve the accepted finite checks for all other kinds and retained old Discipline drafts.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('app_private.validate_noncombat_content_v1(text,jsonb)'::regprocedure);
 old:=$before$begin
 if p_kind not in$before$;
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_VALIDATION_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,$after$begin
 if p_kind='discipline' and d ?| array['atlas','skillStages','essenceId','resonanceSelections'] then
  perform app_private.validate_authored_discipline_envelope_v1(d);
  d:=jsonb_set(d-array['atlas','skillStages','essenceId','resonanceSelections'],'{unlock}','{"kind":"unavailable"}'::jsonb);
 end if;
 if p_kind not in$after$);
end; $migration$;

create function app_private.project_published_discipline_v1(p_version_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v app_private.combat_content_versions; d jsonb; s jsonb; source_id text; pair jsonb; other_selection text; offsets jsonb;
begin
 select * into v from app_private.combat_content_versions where id=p_version_id and content_kind='discipline';
 if not found then raise exception using errcode='22023',message='DISCIPLINE_PUBLICATION_UNAVAILABLE'; end if;
 d:=v.definition;
 perform app_private.validate_noncombat_content_v1('discipline',d);
 perform app_private.validate_authored_discipline_envelope_v1(d);
 if d->'unlock'='{"kind":"unavailable"}'::jsonb then raise exception using errcode='22023',message='DISCIPLINE_PUBLICATION_INCOMPLETE'; end if;
 if exists(
  with recursive rules(r) as (
   select d->'unlock' union all select child from rules cross join lateral jsonb_array_elements(case when rules.r->>'kind'='all' then rules.r->'rules' else '[]'::jsonb end) child
  ) select 1 from rules where r->>'kind'='mastery' and not exists(select 1 from app_private.current_discipline_definitions_v1() c where c.discipline_id=r->>'disciplineId')
 ) then raise exception using errcode='22023',message='DISCIPLINE_PREREQUISITE_UNAVAILABLE'; end if;
 if length(d->>'name')>80 or length(d->>'description')>240 then raise exception using errcode='22023',message='DISCIPLINE_PRESENTATION_LIMIT'; end if;
 for s in select value from jsonb_array_elements(d->'skillStages') loop
  if not exists(select 1 from app_private.combat_content_records r where r.content_key=s->>'skillId' and r.content_kind='skill' and r.lifecycle='active'
    and (exists(select 1 from app_private.combat_content_publications p where p.content_key=r.content_key) or exists(select 1 from app_private.phase4_skill_catalog c where c.skill_id=r.content_key)))
  then raise exception using errcode='22023',message='DISCIPLINE_SKILL_UNAVAILABLE'; end if;
 end loop;
 if d->'essenceId'<>'null'::jsonb then
  select coalesce(cv.definition->>'sourceDisciplineId',r.builtin_source_discipline_id) into source_id
  from app_private.combat_content_records r left join app_private.combat_content_publications p on p.content_key=r.content_key left join app_private.combat_content_versions cv on cv.id=p.version_id
  where r.content_key=d->>'essenceId' and r.content_kind='essence' and r.lifecycle='active';
  if source_id is distinct from v.content_key then raise exception using errcode='22023',message='DISCIPLINE_ESSENCE_UNAVAILABLE'; end if;
 end if;
 for s in select value from jsonb_array_elements(d->'resonanceSelections') loop
  if not exists(select 1 from app_private.current_discipline_definitions_v1() c where c.discipline_id=s->>'withDisciplineId') then raise exception using errcode='22023',message='DISCIPLINE_RESONANCE_PARTNER_UNAVAILABLE'; end if;
  pair:=jsonb_build_array(least(v.content_key,s->>'withDisciplineId'),greatest(v.content_key,s->>'withDisciplineId'));
  if not exists(select 1 from app_private.combat_content_records r left join app_private.combat_content_publications p on p.content_key=r.content_key left join app_private.combat_content_versions cv on cv.id=p.version_id
   where r.content_key=s->>'resonanceId' and r.content_kind='resonance' and r.lifecycle='active'
    and (cv.definition->'disciplinePair'=pair or (cv.id is null and exists(select 1 from app_private.combat_content_builtin_selections b where b.content_key=r.content_key and b.kind='builtin-resonance-selection' and b.selection_key=concat(pair->>0,'+',pair->>1)))))
   then raise exception using errcode='22023',message='DISCIPLINE_RESONANCE_UNAVAILABLE'; end if;
  select entry->>'resonanceId' into other_selection from app_private.combat_content_publications p join app_private.combat_content_versions cv on cv.id=p.version_id cross join lateral jsonb_array_elements(cv.definition->'resonanceSelections') entry
   where p.content_key=s->>'withDisciplineId' and p.content_kind='discipline' and entry->>'withDisciplineId'=v.content_key;
  if other_selection is not null and other_selection<>s->>'resonanceId' then raise exception using errcode='22023',message='DISCIPLINE_RESONANCE_SELECTION_CONFLICT'; end if;
 end loop;
 -- Current offsets, where any exist, are retained; new identities have no invented derived-stat offsets.
 select p.stat_offsets into offsets from app_private.current_discipline_definitions_v1() c join app_private.discipline_primary_profiles p on p.discipline_id=c.discipline_id and p.profile_version=c.primary_profile_version where c.discipline_id=v.content_key;
 insert into app_private.discipline_primary_profiles(discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap)
 values(v.content_key,v.content_version,coalesce(offsets,'{}'),d->'core',array(select jsonb_array_elements_text(d->'focus')),40);
 insert into app_private.discipline_definitions(discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version)
 values(v.content_key,v.content_version,d->>'name',d->>'description',(d->>'enabled')::boolean and (d->>'enabledForPrimary')::boolean,(d->>'enabled')::boolean and (d->>'enabledForSecondary')::boolean,v.content_version);

end; $$;

create function app_private.select_published_discipline_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v app_private.combat_content_versions;
begin
 if new.content_kind<>'discipline' then return new; end if;
 select * into v from app_private.combat_content_versions where id=new.version_id;
 if v.content_kind is distinct from 'discipline' or v.content_key is distinct from new.content_key then raise exception using errcode='22023',message='DISCIPLINE_PUBLICATION_UNAVAILABLE'; end if;
 insert into app_private.discipline_current_definitions values(v.content_key,v.content_version)
 on conflict(discipline_id) do update set definition_version=excluded.definition_version;
 return new;
end; $$;
create trigger discipline_current_publication after insert or update on app_private.combat_content_publications for each row execute function app_private.select_published_discipline_v1();

create function app_private.authored_discipline_unlock_satisfied_v1(p_character_id uuid,d jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 case d->>'kind'
 when 'always' then return true;
 when 'mastery' then return app_private.discipline_mastery_stage_v1(p_character_id,d->>'disciplineId') >= (d->>'minimumStage')::integer;
 when 'rekindling' then return exists(select 1 from public.characters where id=p_character_id and greatest(progression_cycle-1,0)>=(d->>'minimumCount')::integer);
 when 'all' then return not exists(select 1 from jsonb_array_elements(d->'rules') r where not app_private.authored_discipline_unlock_satisfied_v1(p_character_id,r));
 else return false;
 end case;
end; $$;

do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('app_private.discipline_release_unlocked_v1(uuid,text)'::regprocedure);
 old:=$before$  and not exists (
    select 1
    from app_private.discipline_mastery_prerequisites requirement$before$;
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_PREREQUISITE_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,$after$  and case when exists(select 1 from app_private.combat_content_publications p where p.content_kind='discipline' and p.content_key=p_discipline_id)
  then (select app_private.authored_discipline_unlock_satisfied_v1(p_character_id,v.definition->'unlock') from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id where p.content_kind='discipline' and p.content_key=p_discipline_id)
  else not exists (
    select 1
    from app_private.discipline_mastery_prerequisites requirement$after$);
 old:=$before$  );
$function$$before$;
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_PREREQUISITE_END_CONFLICT'; end if;
 d:=replace(d,old,$after$  ) end;
$function$$after$);
 execute d;
end; $migration$;

-- Modify only the saved-revision publisher after its existing actor/catalogue/draft/base checks.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer)'::regprocedure);
 old:=$before$if r.content_kind in ('item','ascension','severence','discipline','tag')$before$;
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_PUBLICATION_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,$after$if r.content_kind in ('item','ascension','severence','tag')$after$);
 old:=$before$ if v_next=2147483647 then$before$;
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_FLOOR_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,$after$ if r.content_kind='discipline' then
  v_next:=greatest(v_next,coalesce((select max(definition_version) from app_private.discipline_definitions where discipline_id=p_content_key),0),coalesce((select max(profile_version) from app_private.discipline_primary_profiles where discipline_id=p_content_key),0));
 end if;
 if v_next=2147483647 then$after$);
 old:=$before$ v_author:=d.updated_by;$before$;
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_PROJECTION_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,$after$ if r.content_kind='discipline' then perform app_private.project_published_discipline_v1(v_id); end if;
 v_author:=d.updated_by;$after$);
 execute d;
end; $migration$;

-- Ordinary catalogue selection consumes the explicit current pointer, not max physical history.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.get_character_discipline_catalog_v2(uuid,uuid)'::regprocedure);
 old:='from app_private.discipline_definitions definition';
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_CATALOGUE_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,'from app_private.current_discipline_definitions_v1() definition');
end; $migration$;

-- Current admission takes the same shared NONBLOCKING catalogue lock. A writer
-- already holding a character lock must retry rather than invert archive's order.
create function app_private.lock_current_discipline_selection_v1()
returns void language plpgsql security definer set search_path='' as $$
begin
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('combat-catalogue-publication',0)) then raise exception using errcode='40001',message='COMBAT_CONTENT_ADMISSION_RETRY'; end if;
end; $$;

do $migration$
declare d text; old text; signature text;
begin
 foreach signature in array array[
  'public.change_character_disciplines_v2(uuid,uuid,bigint,boolean,text,boolean,text,uuid,text)',
  'public.change_character_disciplines_v3(uuid,uuid,bigint,boolean,text,boolean,text,uuid,text)',
  'app_private.provision_character_active_build_v1()',
  'app_private.provision_character_personal_attributes_v1()'
 ] loop
  d:=pg_get_functiondef(signature::regprocedure);
  old:=E'begin\n';
  if strpos(d,old)=0 then raise exception 'DISCIPLINE_ADMISSION_PREDECESSOR_CONFLICT: %',signature; end if;
  d:=replace(d,old,old||E'  perform app_private.lock_current_discipline_selection_v1();\n');
  -- Restrict only unpinned current selections; historical replay and unchanged sides retain exact joins.
  d:=replace(d,E'from app_private.discipline_definitions definition\n    where definition.discipline_id = p_primary_discipline_id',E'from app_private.current_discipline_definitions_v1() definition\n    where definition.discipline_id = p_primary_discipline_id');
  d:=replace(d,E'from app_private.discipline_definitions definition\n      where definition.discipline_id = p_secondary_discipline_id',E'from app_private.current_discipline_definitions_v1() definition\n      where definition.discipline_id = p_secondary_discipline_id');
  d:=replace(d,E'from app_private.discipline_definitions definition\n  where definition.discipline_id = new.foundation_discipline_id',E'from app_private.current_discipline_definitions_v1() definition\n  where definition.discipline_id = new.foundation_discipline_id');
  execute d;
 end loop;
 d:=pg_get_functiondef('public.get_primary_discipline_catalog_v1()'::regprocedure);
 old:='from app_private.discipline_definitions definition';
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_PRIMARY_CATALOGUE_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,'from app_private.current_discipline_definitions_v1() definition');
 d:=pg_get_functiondef('public.get_character_discipline_atlas_progress_v1(uuid,uuid)'::regprocedure);
 old:='from app_private.discipline_definitions';
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_ATLAS_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,'from app_private.current_discipline_definitions_v1()');
 d:=pg_get_functiondef('app_private.guard_combat_content_admission_v1()'::regprocedure);
 old:=$before$else v_keys:=array[v_row->>'skill_id',v_row->>'source_discipline_id',v_row->>'discipline_id']; end if;$before$;
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_ADMISSION_KEYS_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,$after$else v_keys:=array[v_row->>'skill_id',v_row->>'source_discipline_id',v_row->>'discipline_id',v_row->>'primary_discipline_id',v_row->>'secondary_discipline_id']; end if;$after$);
 d:=pg_get_functiondef('app_private.combat_content_blockers_v1(text)'::regprocedure);
 old:=$before$ select 'content-link'$before$;
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_BLOCKERS_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,$after$ select 'active-discipline',character_id::text from app_private.character_active_builds where primary_discipline_id=p_key or secondary_discipline_id=p_key
 union all select 'personal-core-profile',character_id::text from app_private.character_attribute_personal_allocations where primary_discipline_id=p_key
 union all select 'content-link'$after$);
 -- Extend the existing bounded reference index for actual new producer relationships.
 d:=pg_get_functiondef('app_private.content_reference_targets_v1(jsonb)'::regprocedure);
 old:=$before$('sourceDisciplineId','skillId','abilityId','statusId','effectProfileId')$before$;
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_REFERENCES_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,$after$('sourceDisciplineId','skillId','abilityId','statusId','effectProfileId','disciplineId','withDisciplineId','essenceId','resonanceId')$after$);
end; $migration$;
create trigger combat_content_admission before insert or update on app_private.character_active_builds for each row execute function app_private.guard_combat_content_admission_v1();
create trigger combat_content_admission before insert or update on app_private.character_attribute_personal_allocations for each row execute function app_private.guard_combat_content_admission_v1();
revoke all on function app_private.lock_current_discipline_selection_v1() from public,anon,authenticated,service_role;

revoke all on function app_private.select_published_discipline_v1(),app_private.authored_discipline_unlock_satisfied_v1(uuid,jsonb),app_private.current_discipline_definitions_v1(),app_private.validate_authored_discipline_unlock_v1(jsonb,text,integer),app_private.validate_authored_discipline_envelope_v1(jsonb),app_private.project_published_discipline_v1(uuid) from public,anon,authenticated,service_role;
-- One canonical unordered-pair selection. Discipline records are declarations;
-- an omitted declaration cannot erase the other side's explicit current choice.
create function app_private.current_resonance_selection_key_v1(a text,b text)
returns text language plpgsql stable security definer set search_path='' as $$
declare da jsonb; db jsonb; ka text; kb text; selected_key text;
begin
 if b is null or a=b then return null; end if;
 perform app_private.assert_combat_content_current_v1(array[a,b]);
 select v.definition into da from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id where p.content_key=a and p.content_kind='discipline';
 select v.definition into db from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id where p.content_key=b and p.content_kind='discipline';
 if da is not null then select r->>'resonanceId' into ka from jsonb_array_elements(da->'resonanceSelections') r where r->>'withDisciplineId'=b; end if;
 if db is not null then select r->>'resonanceId' into kb from jsonb_array_elements(db->'resonanceSelections') r where r->>'withDisciplineId'=a; end if;
 if ka is not null and kb is not null and ka<>kb then raise exception using errcode='22023',message='DISCIPLINE_RESONANCE_SELECTION_CONFLICT',detail=least(a,b)||'+'||greatest(a,b); end if;
 if da is not null or db is not null then return coalesce(ka,kb); end if;
 select content_key into selected_key from app_private.combat_content_builtin_selections where kind='builtin-resonance-selection' and selection_key=least(a,b)||'+'||greatest(a,b);
 return selected_key;
end; $$;
create function app_private.current_essence_selection_key_v1(a text,b text)
returns text language plpgsql stable security definer set search_path='' as $$
declare d jsonb; selected_key text;
begin
 if b is not null then return null; end if;
 perform app_private.assert_combat_content_current_v1(array[a]);
 select v.definition into d from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id where p.content_key=a and p.content_kind='discipline';
 if d is not null then return d->>'essenceId'; end if;
 select content_key into selected_key from app_private.combat_content_builtin_selections where kind='builtin-essence-selection' and selection_key=a;
 return selected_key;
end; $$;

create or replace function app_private.resolve_resonance_reference_v1(p_primary_discipline_id text,p_secondary_discipline_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k text; r app_private.combat_content_records; v app_private.combat_content_versions; n integer; pair jsonb;
begin
 k:=app_private.current_resonance_selection_key_v1(p_primary_discipline_id,p_secondary_discipline_id);
 if k is null then return null; end if;
 perform app_private.assert_combat_content_current_v1(array[k]);
 select * into r from app_private.combat_content_records where content_key=k and content_kind='resonance';
 if not found then raise exception using errcode='22023',message='COMBAT_CONTENT_SELECTION_UNAVAILABLE'; end if;
 select cv.* into v from app_private.combat_content_publications p join app_private.combat_content_versions cv on cv.id=p.version_id where p.content_key=k and p.content_kind='resonance';
 pair:=jsonb_build_array(least(p_primary_discipline_id,p_secondary_discipline_id),greatest(p_primary_discipline_id,p_secondary_discipline_id));
 if v.id is not null then
  if v.definition->'enabled'='false'::jsonb then raise exception using errcode='22023',message='COMBAT_CONTENT_SELECTION_DISABLED'; end if;
  if v.definition->'enabled' is distinct from 'true'::jsonb or v.definition->>'id' is distinct from k or v.definition->'disciplinePair' is distinct from pair then raise exception using errcode='22023',message='COMBAT_CONTENT_SELECTION_INVALID'; end if;
  n:=v.content_version;
 else
  if r.lifecycle<>'active' or r.builtin_version is null then raise exception using errcode='22023',message='COMBAT_CONTENT_SELECTION_UNAVAILABLE'; end if;
  if not exists(select 1 from app_private.combat_content_builtin_selections where content_key=k and kind='builtin-resonance-selection' and selection_key=concat(pair->>0,'+',pair->>1)) then raise exception using errcode='22023',message='COMBAT_CONTENT_SELECTION_INVALID'; end if;
  n:=r.builtin_version;
 end if;
 return jsonb_build_object('resonanceId',k,'contentVersion',n,'disciplinePair',pair);
end; $$;
create or replace function app_private.resolve_essence_reference_v1(p_primary_discipline_id text,p_secondary_discipline_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k text; r app_private.combat_content_records; v app_private.combat_content_versions; n integer;
begin
 k:=app_private.current_essence_selection_key_v1(p_primary_discipline_id,p_secondary_discipline_id);
 if k is null then return null; end if;
 perform app_private.assert_combat_content_current_v1(array[k]);
 select * into r from app_private.combat_content_records where content_key=k and content_kind='essence';
 if not found then raise exception using errcode='22023',message='COMBAT_CONTENT_SELECTION_UNAVAILABLE'; end if;
 select cv.* into v from app_private.combat_content_publications p join app_private.combat_content_versions cv on cv.id=p.version_id where p.content_key=k and p.content_kind='essence';
 if v.id is not null then
  if v.definition->'enabled'='false'::jsonb or v.definition->'skill'->'enabled'='false'::jsonb then raise exception using errcode='22023',message='COMBAT_CONTENT_SELECTION_DISABLED'; end if;
  if v.definition->'enabled' is distinct from 'true'::jsonb or v.definition->>'essenceId' is distinct from k
   or v.definition->>'sourceDisciplineId' is distinct from p_primary_discipline_id or v.definition->'skill'->>'id' is distinct from k
   or v.definition->'skill'->'contentVersion' is distinct from to_jsonb(v.content_version)
   then raise exception using errcode='22023',message='COMBAT_CONTENT_SELECTION_INVALID'; end if;
  n:=v.content_version;
 else
  if r.lifecycle<>'active' or r.builtin_version is null then raise exception using errcode='22023',message='COMBAT_CONTENT_SELECTION_UNAVAILABLE'; end if;
  if r.builtin_source_discipline_id is distinct from p_primary_discipline_id then raise exception using errcode='22023',message='COMBAT_CONTENT_SELECTION_INVALID'; end if;
  n:=r.builtin_version;
 end if;
 return jsonb_build_object('essenceId',k,'contentVersion',n,'sourceDisciplineId',p_primary_discipline_id,'skillId',k,'skillContentVersion',n);
end; $$;

create function public.read_current_discipline_selection_v1(p_primary_discipline_id text,p_secondary_discipline_id text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('selectionVersion',1,
  'catalogueToken',public.read_combat_content_catalogue_v1()->>'token',
  'resonance',app_private.resolve_resonance_reference_v1(p_primary_discipline_id,p_secondary_discipline_id),
  'essence',app_private.resolve_essence_reference_v1(p_primary_discipline_id,p_secondary_discipline_id));
$$;
revoke all on function public.read_current_discipline_selection_v1(text,text) from public,anon,authenticated;
grant execute on function public.read_current_discipline_selection_v1(text,text) to service_role;
revoke all on function app_private.current_resonance_selection_key_v1(text,text),app_private.current_essence_selection_key_v1(text,text) from public,anon,authenticated,service_role;
commit;
