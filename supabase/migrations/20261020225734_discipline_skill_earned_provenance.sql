begin;

-- One learned identity/version remains authoritative. Eligibility is an attached
-- per-Discipline fact, never a second competing Skill definition or inventory.
create table app_private.character_discipline_skill_grants (
 character_id uuid not null,
 skill_id text not null,
 eligibility_discipline_id text not null check(eligibility_discipline_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
 granted_at timestamptz not null,
 grant_source_kind text not null check(grant_source_kind in ('system','gameplay','support','owner','migration')),
 grant_source_id text not null check(length(grant_source_id) between 1 and 160),
 earned_at timestamptz,
 earned_source_kind text,
 earned_source_id text,
 primary key(character_id,skill_id,eligibility_discipline_id),
 foreign key(character_id,skill_id) references app_private.character_skill_unlocks(character_id,skill_id) on delete cascade,
 check((earned_at is null and earned_source_kind is null and earned_source_id is null) or
  (earned_at is not null and earned_source_kind is not null and earned_source_kind in ('system','gameplay','support','owner','migration') and earned_source_id is not null and length(earned_source_id) between 1 and 160))
);
alter table app_private.character_discipline_skill_grants enable row level security;
revoke all on table app_private.character_discipline_skill_grants from public,anon,authenticated,service_role;
insert into app_private.character_discipline_skill_grants
 select character_id,skill_id,source_discipline_id,learned_at,source_kind,source_id,
 case when source_kind='support' and source_id='discipline-testing-open:v1' then null else learned_at end,
 case when source_kind='support' and source_id='discipline-testing-open:v1' then null else source_kind end,
 case when source_kind='support' and source_id='discipline-testing-open:v1' then null else source_id end
 from app_private.character_skill_unlocks;

create function app_private.grant_discipline_skill_v1(p_character uuid,p_skill text,p_version integer,p_source text,p_eligibility text,p_kind text,p_provenance text,p_earned boolean)
returns void language plpgsql security definer set search_path='' as $$
declare learned app_private.character_skill_unlocks; granted timestamptz:=clock_timestamp();
begin
 if p_skill is null or p_skill !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' or p_source is null or p_source !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
 or p_eligibility is null or p_eligibility !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' or p_version is null or p_version<1
 or p_kind is null or p_kind not in ('system','gameplay','support','owner','migration') or p_provenance is null or length(p_provenance) not between 1 and 160 or p_earned is null
 then raise exception using errcode='22023',message='SKILL_UNLOCK_PROVENANCE_INVALID'; end if;
 perform app_private.lock_current_discipline_selection_v1();
 perform app_private.assert_combat_content_current_v1(array[p_skill,p_source,p_eligibility]);
 insert into app_private.character_skill_unlocks(character_id,skill_id,skill_content_version,source_discipline_id,learned_at,source_kind,source_id)
 values(p_character,p_skill,p_version,p_source,granted,p_kind,p_provenance) on conflict(character_id,skill_id) do nothing;
 select * into strict learned from app_private.character_skill_unlocks where character_id=p_character and skill_id=p_skill;
 if learned.source_discipline_id<>p_source then raise exception using errcode='22023',message='SKILL_UNLOCK_CONFLICT'; end if;
 -- Existing learned version and intrinsic provenance are never rewritten by a link.
 insert into app_private.character_discipline_skill_grants as existing values(p_character,p_skill,p_eligibility,granted,p_kind,p_provenance,
 case when p_earned then granted end,case when p_earned then p_kind end,case when p_earned then p_provenance end)
 on conflict(character_id,skill_id,eligibility_discipline_id) do update set
 earned_at=coalesce(existing.earned_at,excluded.earned_at),earned_source_kind=coalesce(existing.earned_source_kind,excluded.earned_source_kind),earned_source_id=coalesce(existing.earned_source_id,excluded.earned_source_id);
end; $$;

create function app_private.current_discipline_skill_catalog_v1(p_discipline text)
returns table(skill_id text,content_version integer,source_discipline_id text,minimum_stage integer)
language plpgsql stable security definer set search_path='' as $$
declare d jsonb; entry jsonb; r app_private.combat_content_records; v app_private.combat_content_versions;
begin
 select cv.definition into d from app_private.combat_content_publications p join app_private.combat_content_versions cv on cv.id=p.version_id where p.content_key=p_discipline and p.content_kind='discipline';
 if d is null then
  return query select c.skill_id,c.content_version,c.discipline_id,c.minimum_stage::integer from app_private.phase4_skill_catalog c where c.discipline_id=p_discipline;
  return;
 end if;
 if d->'enabled' is distinct from 'true'::jsonb then return; end if;
 for entry in select value from jsonb_array_elements(d->'skillStages') loop
  select * into r from app_private.combat_content_records where content_key=entry->>'skillId' and content_kind='skill' and lifecycle='active';
  if not found then raise exception using errcode='22023',message='DISCIPLINE_SKILL_UNAVAILABLE'; end if;
  select cv.* into v from app_private.combat_content_publications p join app_private.combat_content_versions cv on cv.id=p.version_id where p.content_key=r.content_key and p.content_kind='skill';
  if v.id is not null then
   if v.definition->'enabled' is distinct from 'true'::jsonb or v.definition->>'id' is distinct from r.content_key or jsonb_typeof(v.definition->'sourceDisciplineId') is distinct from 'string'
   then raise exception using errcode='22023',message='DISCIPLINE_SKILL_UNAVAILABLE'; end if;
   skill_id:=r.content_key; content_version:=v.content_version; source_discipline_id:=v.definition->>'sourceDisciplineId';
  else
   if r.builtin_version is null or r.builtin_source_discipline_id is null then raise exception using errcode='22023',message='DISCIPLINE_SKILL_UNAVAILABLE'; end if;
   skill_id:=r.content_key; content_version:=r.builtin_version; source_discipline_id:=r.builtin_source_discipline_id;
  end if;
  minimum_stage:=(entry->>'minimumStage')::integer; return next;
 end loop;
end; $$;

create or replace function app_private.provision_mastery_skills_v1(p_character_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare d text; candidate record; earned boolean;
begin
 perform app_private.lock_current_discipline_selection_v1();
 for d in select primary_discipline_id from app_private.character_active_builds where character_id=p_character_id
 union select secondary_discipline_id from app_private.character_active_builds where character_id=p_character_id and secondary_discipline_id is not null loop
  for candidate in select * from app_private.current_discipline_skill_catalog_v1(d) loop
   earned:=app_private.discipline_release_unlocked_v1(p_character_id,d) and app_private.discipline_mastery_stage_v1(p_character_id,d)>=candidate.minimum_stage;
   if earned or app_private.discipline_testing_open_v1() then
    perform app_private.grant_discipline_skill_v1(p_character_id,candidate.skill_id,candidate.content_version,candidate.source_discipline_id,d,
     case when earned then 'gameplay' else 'support' end,case when earned then 'discipline-mastery:v1' else 'discipline-testing-open:v1' end,earned);
   end if;
  end loop;
 end loop;
end; $$;

-- Preserve the actual native grant API, including its exact-version replay guard.
-- An explicit native grant attaches only native eligibility to the learned row.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.record_character_skill_unlock_v1(uuid,text,integer,text,text,text)'::regprocedure);
 old:=E'    return query\n';
 if strpos(d,old)=0 then raise exception 'EARNED_NATIVE_REPLAY_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,$after$    perform app_private.grant_discipline_skill_v1(p_character_id,p_skill_id,p_skill_content_version,p_source_discipline_id,p_source_discipline_id,p_source_kind,p_source_id,not(p_source_kind='support' and p_source_id='discipline-testing-open:v1'));
    return query
$after$);
 old:='  get diagnostics v_rows_inserted = row_count;';
 if strpos(d,old)=0 then raise exception 'EARNED_NATIVE_GRANT_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,old||$after$
  perform app_private.grant_discipline_skill_v1(p_character_id,p_skill_id,p_skill_content_version,p_source_discipline_id,p_source_discipline_id,p_source_kind,p_source_id,not(p_source_kind='support' and p_source_id='discipline-testing-open:v1'));
$after$);
 execute d;
end; $migration$;

-- Baseline foundation provisioning keeps its existing all-Skill entitlement;
-- authored foundations instead use the published stage declarations.
create or replace function app_private.provision_active_discipline_skills_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare candidate record;
begin
 for candidate in select c.* from app_private.phase4_skill_catalog c
  where c.discipline_id in ('vanguard','lifebinder','aetherist','farstrider','shadehand','ironfist')
  and c.discipline_id in (new.primary_discipline_id,new.secondary_discipline_id)
  and not exists(select 1 from app_private.combat_content_publications p where p.content_kind='discipline' and p.content_key=c.discipline_id)
 loop
  perform app_private.grant_discipline_skill_v1(new.character_id,candidate.skill_id,candidate.content_version,candidate.discipline_id,candidate.discipline_id,'system','active-discipline-provisioning:v1',true);
 end loop;
 perform app_private.provision_mastery_skills_v1(new.character_id);
 return new;
end; $$;

-- Extend the existing actual archive/admission guard to the attached grant facts.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('app_private.guard_combat_content_admission_v1()'::regprocedure);
 old:=$before$v_row->>'secondary_discipline_id']; end if;$before$;
 if strpos(d,old)=0 then raise exception 'EARNED_ADMISSION_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,$after$v_row->>'secondary_discipline_id',v_row->>'eligibility_discipline_id']; end if;$after$);
 d:=pg_get_functiondef('app_private.combat_content_blockers_v1(text)'::regprocedure);
 old:=$before$ select 'content-link'$before$;
 if strpos(d,old)=0 then raise exception 'EARNED_BLOCKER_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,$after$ select 'discipline-skill-grant',character_id::text||':'||skill_id||':'||eligibility_discipline_id from app_private.character_discipline_skill_grants where skill_id=p_key or eligibility_discipline_id=p_key
 union all select 'content-link'$after$);
end; $migration$;
create trigger combat_content_admission before insert or update on app_private.character_discipline_skill_grants for each row execute function app_private.guard_combat_content_admission_v1();
revoke all on function app_private.grant_discipline_skill_v1(uuid,text,integer,text,text,text,text,boolean),app_private.current_discipline_skill_catalog_v1(text) from public,anon,authenticated,service_role;

-- All eligibility-aware consumers share this join. The legacy row's intrinsic
-- identity/version remains the only learned Skill authority.
create function app_private.character_discipline_skill_availability_v1(p_character uuid)
returns table(skill_id text,skill_content_version integer,source_discipline_id text,eligibility_discipline_id text,learned_at timestamptz,granted_at timestamptz,earned_at timestamptz,grant_source_kind text,grant_source_id text,earned_source_kind text,earned_source_id text)
language sql stable security definer set search_path='' as $$
 select l.skill_id,l.skill_content_version,l.source_discipline_id,g.eligibility_discipline_id,l.learned_at,g.granted_at,g.earned_at,g.grant_source_kind,g.grant_source_id,g.earned_source_kind,g.earned_source_id
 from app_private.character_skill_unlocks l join app_private.character_discipline_skill_grants g using(character_id,skill_id) where l.character_id=p_character;
$$;
create function public.get_character_learned_skills_v2(p_user_id uuid,p_character_id uuid)
returns table(skill_id text,skill_content_version integer,source_discipline_id text,eligibility_discipline_id text,learned_at timestamptz,granted_at timestamptz,earned_at timestamptz,grant_source_kind text,grant_source_id text,earned_source_kind text,earned_source_id text)
language sql stable security definer set search_path='' as $$
 select a.* from app_private.character_discipline_skill_availability_v1(p_character_id) a
 where exists(select 1 from app_private.character_active_builds b where b.character_id=p_character_id and b.user_id=p_user_id)
 order by a.learned_at,a.skill_id,a.eligibility_discipline_id;
$$;
revoke all on function app_private.character_discipline_skill_availability_v1(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_character_learned_skills_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_character_learned_skills_v2(uuid,uuid) to service_role;

-- Old native-only transports must not infer native eligibility from a learned
-- row that was first acquired solely through a different Discipline.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.get_character_learned_skills_v1(uuid,uuid)'::regprocedure);
 old:='from app_private.character_skill_unlocks unlock';
 if strpos(d,old)=0 then raise exception 'EARNED_NATIVE_READER_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,old||E'
  join app_private.character_discipline_skill_grants grant_fact on grant_fact.character_id=unlock.character_id and grant_fact.skill_id=unlock.skill_id and grant_fact.eligibility_discipline_id=unlock.source_discipline_id');
 execute d;
 d:=pg_get_functiondef('public.save_character_discipline_skill_loadout_v1(uuid,uuid,bigint,jsonb,uuid,text)'::regprocedure);
 old:='and unlock.source_discipline_id = v_source_discipline_id';
 if strpos(d,old)=0 then raise exception 'EARNED_NATIVE_SAVE_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,old||E'
        and exists(select 1 from app_private.character_discipline_skill_grants g where g.character_id=unlock.character_id and g.skill_id=unlock.skill_id and g.eligibility_discipline_id=v_source_discipline_id)');
end; $migration$;


alter table app_private.character_build_discipline_skills add column eligibility_discipline_id text;
update app_private.character_build_discipline_skills set eligibility_discipline_id=source_discipline_id;
alter table app_private.character_build_discipline_skills add constraint equipped_eligibility_format check(eligibility_discipline_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$');
create function app_private.default_native_skill_eligibility_v1()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.eligibility_discipline_id is null then new.eligibility_discipline_id:=new.source_discipline_id; end if;
 return new;
end; $$;
create trigger native_skill_eligibility before insert on app_private.character_build_discipline_skills for each row execute function app_private.default_native_skill_eligibility_v1();
alter table app_private.character_build_discipline_skills alter column eligibility_discipline_id set not null;

create function app_private.resolve_skill_eligibility_v1(p_character uuid,r jsonb,p_primary text,p_secondary text)
returns text language plpgsql stable security definer set search_path='' as $$
declare candidate text; choices text[];
begin
 if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'skillId') is distinct from 'string' or (r->>'skillId') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
 or jsonb_typeof(r->'sourceDisciplineId') is distinct from 'string' or (r->>'sourceDisciplineId') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
 or jsonb_typeof(r->'contentVersion') is distinct from 'number' or (r->>'contentVersion') !~ '^[1-9][0-9]{0,9}$' or (r->>'contentVersion')::numeric>2147483647
 then raise exception using errcode='22023',message='SKILL_LOADOUT_REFERENCE_INVALID'; end if;
 if r ? 'eligibilityDisciplineId' then
  if jsonb_typeof(r->'eligibilityDisciplineId') is distinct from 'string' or (r->>'eligibilityDisciplineId') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' then raise exception using errcode='22023',message='SKILL_LOADOUT_REFERENCE_INVALID'; end if;
  candidate:=r->>'eligibilityDisciplineId';
 end if;
 select array_agg(a.eligibility_discipline_id order by a.eligibility_discipline_id) into choices
 from app_private.character_discipline_skill_availability_v1(p_character) a
 where a.skill_id=r->>'skillId' and a.skill_content_version=(r->>'contentVersion')::integer and a.source_discipline_id=r->>'sourceDisciplineId'
 and (a.eligibility_discipline_id=p_primary or a.eligibility_discipline_id=p_secondary);
 if candidate is null then
  if coalesce(cardinality(choices),0)=0 then raise exception using errcode='22023',message='DISCIPLINE_SKILL_NOT_LEARNED'; end if;
  if cardinality(choices)>1 then raise exception using errcode='22023',message='DISCIPLINE_SKILL_ELIGIBILITY_REQUIRED'; end if;
  return choices[1];
 end if;
 if candidate<>p_primary and candidate is distinct from p_secondary then raise exception using errcode='22023',message='DISCIPLINE_SKILL_SOURCE_INACTIVE'; end if;
 if choices is null or not candidate=any(choices) then raise exception using errcode='22023',message='DISCIPLINE_SKILL_NOT_LEARNED'; end if;
 return candidate;
end; $$;

do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.save_character_discipline_skill_loadout_v1(uuid,uuid,bigint,jsonb,uuid,text)'::regprocedure);
 old:='  v_source_discipline_id text;';
 if strpos(d,old)=0 then raise exception 'EARNED_EQUIP_DECLARATION_CONFLICT'; end if;
 d:=replace(d,old,old||E'
  v_eligibility text;');
 old:='  v_count := jsonb_array_length(p_skills);';
 if strpos(d,old)=0 then raise exception 'EARNED_EQUIP_NORMALIZATION_CONFLICT'; end if;
 d:=replace(d,old,$after$  if jsonb_array_length(p_skills)>4 then raise exception using errcode='22023',message='DISCIPLINE_SKILL_CAPACITY_EXCEEDED'; end if;
  select coalesce(jsonb_agg(element || jsonb_build_object('eligibilityDisciplineId',app_private.resolve_skill_eligibility_v1(p_character_id,element,v_build.primary_discipline_id,v_build.secondary_discipline_id)) order by ordinality),'[]'::jsonb)
  into p_skills from jsonb_array_elements(p_skills) with ordinality as selected(element,ordinality);
$after$||old);
 old:=$before$    v_source_discipline_id := v_entry ->> 'sourceDisciplineId';$before$;
 if strpos(d,old)=0 then raise exception 'EARNED_EQUIP_REFERENCE_CONFLICT'; end if;
 d:=replace(d,old,old||$after$
    v_eligibility := v_entry ->> 'eligibilityDisciplineId';$after$);
 d:=replace(d,'if v_source_discipline_id = v_build.primary_discipline_id then','if v_eligibility = v_build.primary_discipline_id then');
 d:=replace(d,'and v_source_discipline_id = v_build.secondary_discipline_id then','and v_eligibility = v_build.secondary_discipline_id then');
 old:=$before$      from app_private.character_skill_unlocks unlock
      where unlock.character_id = p_character_id$before$;
 if strpos(d,old)=0 then raise exception 'EARNED_EQUIP_AUTHORITY_CONFLICT'; end if;
 d:=replace(d,old,$after$      from app_private.character_discipline_skill_availability_v1(p_character_id) unlock
      where unlock.eligibility_discipline_id=v_eligibility$after$);
 old:=$before$        and exists(select 1 from app_private.character_discipline_skill_grants g where g.character_id=unlock.character_id and g.skill_id=unlock.skill_id and g.eligibility_discipline_id=v_source_discipline_id)$before$;
 if strpos(d,old)=0 then raise exception 'EARNED_EQUIP_NATIVE_GUARD_CONFLICT'; end if;
 d:=replace(d,old,'');
 old:=E'    source_discipline_id,
    equipped_at';
 if strpos(d,old)=0 then raise exception 'EARNED_EQUIP_INSERT_CONFLICT'; end if;
 d:=replace(d,old,E'    source_discipline_id,
    eligibility_discipline_id,
    equipped_at');
 old:=$before$    element ->> 'sourceDisciplineId',
    v_saved_at$before$;
 if strpos(d,old)=0 then raise exception 'EARNED_EQUIP_INSERT_VALUE_CONFLICT'; end if;
 d:=replace(d,old,$after$    element ->> 'sourceDisciplineId',
    element ->> 'eligibilityDisciplineId',
    v_saved_at$after$);
 execute d;
end; $migration$;

-- Preserve selected eligibility when a build changes; retain the existing order
-- while applying the same four-total/three-per-side current mixed capacity.
create or replace function app_private.prune_character_discipline_skill_loadout_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare kept jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('skillId',x.skill_id,'contentVersion',x.skill_content_version,'sourceDisciplineId',x.source_discipline_id,'eligibilityDisciplineId',x.eligibility_discipline_id,'equippedAt',x.equipped_at) order by x.slot_index),'[]'::jsonb)
 into kept from (
  select ranked.* from (
   select equipped.*,row_number() over(partition by equipped.eligibility_discipline_id order by equipped.slot_index) side_rank from app_private.character_build_discipline_skills equipped where equipped.character_id=new.character_id
  ) ranked where (ranked.eligibility_discipline_id=new.primary_discipline_id or ranked.eligibility_discipline_id=new.secondary_discipline_id)
  and ranked.side_rank<=case when new.secondary_discipline_id is null then 4 else 3 end
  order by ranked.slot_index limit 4
 ) x;
 delete from app_private.character_build_discipline_skills where character_id=new.character_id;
 insert into app_private.character_build_discipline_skills(character_id,slot_index,skill_id,skill_content_version,source_discipline_id,eligibility_discipline_id,equipped_at)
 select new.character_id,ordinality::smallint,element->>'skillId',(element->>'contentVersion')::integer,element->>'sourceDisciplineId',element->>'eligibilityDisciplineId',(element->>'equippedAt')::timestamptz
 from jsonb_array_elements(kept) with ordinality as selected(element,ordinality);
 return new;
end; $$;

-- Actual serialization paths retain the intrinsic source and selected eligibility.
do $migration$
declare d text; old text; signature text;
begin
 foreach signature in array array[
 'public.save_character_discipline_skill_loadout_v1(uuid,uuid,bigint,jsonb,uuid,text)',
 'public.save_character_build_loadout_v1(uuid,uuid,smallint,text,bigint,uuid,text)',
 'public.activate_character_build_loadout_v1(uuid,uuid,smallint,bigint,uuid,text)',
 'public.get_character_committed_build_snapshot_v1(uuid,uuid)',
 'public.get_character_committed_build_snapshot_v2(uuid,uuid)'
 ] loop
  d:=pg_get_functiondef(signature::regprocedure);
  old:=$before$'sourceDisciplineId', equipped.source_discipline_id$before$;
  if strpos(d,old)=0 then raise exception 'EARNED_SERIALIZATION_PREDECESSOR_CONFLICT: %',signature; end if;
  execute replace(d,old,old||$after$,'eligibilityDisciplineId',equipped.eligibility_discipline_id$after$);
 end loop;
 -- Stored historical omission means intrinsic/native eligibility. Materialize it
 -- only in the activation's local working value, never rewrite the saved history.
 d:=pg_get_functiondef('public.activate_character_build_loadout_v1(uuid,uuid,smallint,bigint,uuid,text)'::regprocedure);
 old:='  v_change_primary :=';
 if strpos(d,old)=0 then raise exception 'EARNED_SAVED_ACTIVATION_PREDECESSOR_CONFLICT'; end if;
 d:=replace(d,old,$after$  select coalesce(jsonb_agg(case when element ? 'eligibilityDisciplineId' then element else element || jsonb_build_object('eligibilityDisciplineId',element->'sourceDisciplineId') end order by ordinality),'[]'::jsonb)
  into v_loadout.discipline_skills from jsonb_array_elements(v_loadout.discipline_skills) with ordinality as selected(element,ordinality);
  v_change_primary :=$after$);
 execute d;
end; $migration$;
create function public.get_character_discipline_skill_loadout_v2(p_user_id uuid,p_character_id uuid)
returns table(slot_index smallint,skill_id text,skill_content_version integer,source_discipline_id text,eligibility_discipline_id text,equipped_at timestamptz)
language sql stable security definer set search_path='' as $$
 select e.slot_index,e.skill_id,e.skill_content_version,e.source_discipline_id,e.eligibility_discipline_id,e.equipped_at from app_private.character_build_discipline_skills e join app_private.character_active_builds b on b.character_id=e.character_id where b.user_id=p_user_id and b.character_id=p_character_id order by e.slot_index;
$$;
revoke all on function public.get_character_discipline_skill_loadout_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_character_discipline_skill_loadout_v2(uuid,uuid) to service_role;
revoke all on function app_private.default_native_skill_eligibility_v1(),app_private.resolve_skill_eligibility_v1(uuid,jsonb,text,text) from public,anon,authenticated,service_role;
commit;
