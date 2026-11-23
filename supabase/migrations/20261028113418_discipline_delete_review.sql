begin;

-- Deleted content uses the existing current-catalogue tombstone. Executable
-- versions, captured builds and audit facts are never removed or rewritten.
alter table app_private.combat_content_records
 add column deleted_at timestamptz,
 add column deletion_review_token text,
 add column deletion_keys text[];

create function app_private.guard_deleted_content_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='combat_content_records' then
  if old.deleted_at is not null then
   raise exception using errcode='22023',message='COMBAT_CONTENT_DELETED';
  end if;
 elsif exists(select 1 from app_private.combat_content_records r where r.content_key=new.content_key and r.deleted_at is not null) then
  raise exception using errcode='22023',message='COMBAT_CONTENT_DELETED';
 end if;
 return new;
end; $$;
create trigger deleted_content_guard before update on app_private.combat_content_records
 for each row execute function app_private.guard_deleted_content_v1();
create trigger deleted_content_guard before insert or update on app_private.combat_content_drafts
 for each row execute function app_private.guard_deleted_content_v1();
create trigger deleted_content_guard before insert or update on app_private.combat_content_publications
 for each row execute function app_private.guard_deleted_content_v1();

-- Ownership comes from intrinsic source/pair metadata, not an arbitrary linked
-- Skill. Shared powers are included for review but external references block.
create function app_private.discipline_deletion_keys_v1(p_key text)
returns table(content_key text) language sql stable security definer set search_path='' as $$
 select r.content_key from app_private.combat_content_records r
 left join app_private.combat_content_drafts d on d.content_key=r.content_key
 left join app_private.combat_content_publications p on p.content_key=r.content_key
 left join app_private.combat_content_versions v on v.id=p.version_id
 where r.lifecycle<>'archived' and (
  r.content_key=p_key or (r.content_kind in ('skill','essence','resonance') and (
   (r.builtin_source_discipline_id=p_key and (r.content_kind='skill' or (d.content_key is null and p.content_key is null)))
   or d.definition->>'sourceDisciplineId'=p_key or v.definition->>'sourceDisciplineId'=p_key
   or d.definition->'disciplinePair' ? p_key or v.definition->'disciplinePair' ? p_key
   or exists(select 1 from app_private.phase4_skill_catalog s where s.skill_id=r.content_key and s.discipline_id=p_key)
   or exists(select 1 from app_private.combat_content_builtin_selections b where b.content_key=r.content_key
    and p_key=any(string_to_array(b.selection_key,'+'))
    and d.content_key is null and p.content_key is null)
  ))
 ) order by r.content_key;
$$;

create function app_private.discipline_deletion_impact_v1(p_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare keys text[]; records jsonb; blockers jsonb; all_blockers jsonb; result jsonb;
begin
 if not exists(select 1 from app_private.combat_content_records where content_key=p_key and content_kind='discipline' and lifecycle<>'archived') then
  raise exception using errcode='22023',message='COMBAT_CONTENT_NOT_FOUND';
 end if;
 select array_agg(content_key order by content_key) into keys from app_private.discipline_deletion_keys_v1(p_key);
 if cardinality(keys)>257 then raise exception using errcode='22023',message='DISCIPLINE_DELETE_REVIEW_LIMIT'; end if;
 select jsonb_agg(jsonb_build_object('contentKey',r.content_key,'contentKind',r.content_kind,'revision',r.revision,
  'name',coalesce(nullif(d.definition->>'name',''),nullif(v.definition->>'name',''),r.builtin_name,r.content_key)) order by r.content_key)
 into records from app_private.combat_content_records r
 left join app_private.combat_content_drafts d on d.content_key=r.content_key
 left join app_private.combat_content_publications p on p.content_key=r.content_key
 left join app_private.combat_content_versions v on v.id=p.version_id where r.content_key=any(keys);
 with uses as (
  select k as content_key,b.kind,b.key from unnest(keys) k cross join lateral app_private.combat_content_blockers_v1(k) b
  where not (b.kind in ('content-link','definition-current','definition-draft') and b.key=any(keys))
   and not (b.kind='phase4-catalogue' and b.key=any(keys))
   and not (b.kind in ('builtin-essence-selection','builtin-resonance-selection') and p_key=any(string_to_array(b.key,'+')))
  union select p_key,'player-grant',g.target_user_id::text from app_private.discipline_player_grants g where g.discipline_id=p_key and g.revoked_at is null
  union select p_key,'builtin-prerequisite',p.discipline_id from app_private.discipline_mastery_prerequisites p
   join app_private.combat_content_records r on r.content_key=p.discipline_id and r.lifecycle<>'archived'
   where p.required_discipline_id=p_key and p.discipline_id<>p_key
   and not exists(select 1 from app_private.combat_content_publications pub where pub.content_key=p.discipline_id)
 ), named as (
  select distinct u.content_key,u.kind,u.key,
   coalesce((select c.name from public.characters c where
    (u.kind='player-grant' and c.user_id::text=u.key) or
    (u.kind in ('active-discipline','personal-core-profile','earned-skill','equipped-skill','saved-loadout','discipline-skill-grant') and c.id::text=split_part(u.key,':',1))
    order by c.slot_index,c.id limit 1),
    (select coalesce(nullif(d.definition->>'name',''),nullif(v.definition->>'name',''),r.builtin_name) from app_private.combat_content_records r
     left join app_private.combat_content_drafts d on d.content_key=r.content_key
     left join app_private.combat_content_publications p on p.content_key=r.content_key
     left join app_private.combat_content_versions v on v.id=p.version_id where r.content_key=u.key),u.key) as name
   from uses u
 ) select coalesce(jsonb_agg(jsonb_build_object('contentKey',content_key,'kind',kind,'key',key,'name',name) order by content_key,kind,key),'[]') into all_blockers from named;
 select coalesce(jsonb_agg(b),'[]') into blockers from (select value b from jsonb_array_elements(all_blockers) limit 100) bounded;
 result:=jsonb_build_object('records',records,'blockers',blockers,'blockerCount',jsonb_array_length(all_blockers));
 -- Full impact, not merely the visible first page, participates in stale review detection.
 return result||jsonb_build_object('token',md5(records::text||all_blockers::text));
end; $$;

create function public.review_discipline_deletion_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_content_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id);
 perform app_private.lock_current_discipline_selection_v1();
 return app_private.discipline_deletion_impact_v1(p_content_key);
end; $$;

create function public.delete_discipline_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_content_key text,p_review_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare impact jsonb; keys text[]; previous app_private.combat_content_records;
begin
 perform app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('combat-catalogue-publication',0));
 select * into previous from app_private.combat_content_records where content_key=p_content_key for update;
 if previous.content_kind='discipline' and previous.deleted_at is not null and previous.deletion_review_token=p_review_token then
  return jsonb_build_object('deletedKeys',previous.deletion_keys);
 end if;
 impact:=app_private.discipline_deletion_impact_v1(p_content_key);
 if p_review_token is distinct from impact->>'token' then
  raise exception using errcode='PT409',message='DISCIPLINE_DELETE_REVIEW_CHANGED';
 end if;
 if (impact->>'blockerCount')::integer>0 then raise exception using errcode='22023',message='COMBAT_CONTENT_DEPENDENCIES'; end if;
 select array_agg(r->>'contentKey' order by r->>'contentKey') into keys from jsonb_array_elements(impact->'records') r;
 -- The exclusive catalogue lock serializes content, grants, active selections,
 -- earned Skills and saved loadouts through their existing admission guards.
 update app_private.combat_content_records set lifecycle='archived',deleted_at=clock_timestamp(),
  deletion_review_token=p_review_token,deletion_keys=keys,restore_pending=false,revision=revision+1,
  updated_by=p_actor_user_id,updated_at=clock_timestamp() where content_key=any(keys);
 delete from app_private.combat_content_links where parent_key=any(keys) or child_key=any(keys);
 delete from app_private.combat_content_drafts where content_key=any(keys);
 delete from app_private.combat_content_publications where content_key=any(keys);
 delete from app_private.phase4_skill_catalog where skill_id=any(keys) or discipline_id=p_content_key;
 delete from app_private.combat_content_builtin_selections where content_key=any(keys) and p_content_key=any(string_to_array(selection_key,'+'));
 delete from app_private.discipline_mastery_prerequisites where discipline_id=p_content_key;
 return jsonb_build_object('deletedKeys',keys);
end; $$;

-- Keep the existing transactional activity hook; label permanent deletion honestly.
do $migration$
declare d text; old text:=$before$'Archived content'$before$;
begin
 d:=pg_get_functiondef('app_private.capture_master_content_archive_activity_v1()'::regprocedure);
 if strpos(d,old)=0 then raise exception 'DISCIPLINE_DELETE_ACTIVITY_PREDECESSOR_CONFLICT'; end if;
 execute replace(d,old,$after$case when new.deleted_at is null then 'Archived content' else 'Deleted content' end$after$);
end; $migration$;

revoke all on function app_private.guard_deleted_content_v1(),app_private.discipline_deletion_keys_v1(text),app_private.discipline_deletion_impact_v1(text) from public,anon,authenticated,service_role;
revoke all on function public.review_discipline_deletion_v1(uuid,uuid,text),public.delete_discipline_v1(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_discipline_deletion_v1(uuid,uuid,text),public.delete_discipline_v1(uuid,uuid,text,text) to service_role;
commit;
