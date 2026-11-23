begin;

-- Retain all existing validation, selected-character authorization, attribution,
-- publication triggers and lock order. Either the complete change publishes or it rolls back.
create function public.commit_combat_content_record_v1(
 p_actor_user_id uuid,p_actor_character_id uuid,p_content_key text,
 p_expected_revision bigint,p_definition jsonb,p_expected_catalogue_token text,p_version_floor integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare saved jsonb; current_definition jsonb; comparable jsonb; r app_private.combat_content_records;
begin
 perform app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id);
 perform app_private.lock_combat_content_catalogue_v1(p_expected_catalogue_token);
 select * into r from app_private.combat_content_records where content_key=p_content_key for update;
 if r.content_key is null or r.revision is distinct from p_expected_revision then
  raise exception using errcode='40001',message='COMBAT_CONTENT_RECORD_REVISION_CONFLICT';
 end if;
 select v.definition into current_definition from app_private.combat_content_publications p
 join app_private.combat_content_versions v on v.id=p.version_id where p.content_key=p_content_key;
 comparable:=jsonb_set(p_definition,'{contentVersion}',current_definition->'contentVersion');
 if r.content_kind='essence' then comparable:=jsonb_set(comparable,'{skill,contentVersion}',current_definition#>'{skill,contentVersion}'); end if;
 if current_definition is not null and comparable=current_definition and not exists(select 1 from app_private.combat_content_drafts where content_key=p_content_key) then
  return app_private.combat_content_record_json_v1(p_content_key);
 end if;
 -- Publish an already reviewed identical draft without treating restoration as
 -- new authorship. Saving an edited definition intentionally clears provenance.
 saved:=app_private.combat_content_record_json_v1(p_content_key);
 if saved#>'{draft,definition}' is distinct from p_definition then
  saved:=public.write_combat_content_record_v1(p_actor_user_id,p_actor_character_id,p_content_key,
   jsonb_build_object('action','save','expectedRevision',p_expected_revision,'definition',p_definition));
 end if;
 return public.publish_saved_combat_content_v1(p_actor_user_id,p_actor_character_id,p_content_key,
  (saved#>>'{draft,draftVersion}')::bigint,(saved#>>'{draft,baseVersion}')::integer,
  public.read_combat_content_catalogue_token_v1(),p_version_floor);
end; $$;
revoke all on function public.commit_combat_content_record_v1(uuid,uuid,text,bigint,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.commit_combat_content_record_v1(uuid,uuid,text,bigint,jsonb,text,integer) to service_role;

commit;
