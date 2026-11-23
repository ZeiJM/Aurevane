begin;

-- Archive removes a current publication, so the publication INSERT/UPDATE feed
-- cannot observe it. Capture the actual lifecycle transition in the same write.
create function app_private.capture_master_content_archive_activity_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_definition jsonb; v_subject text;
begin
  if new.updated_by is null then return new; end if;
  -- This AFTER-record trigger runs before the archive producer removes its
  -- publication. Prefer the current name, then an unpublished draft's name.
  select v.definition into v_definition
    from app_private.combat_content_publications p
    join app_private.combat_content_versions v on v.id=p.version_id
    where p.content_key=new.content_key;
  if not found then
    select d.definition into v_definition from app_private.combat_content_drafts d
      where d.content_key=new.content_key;
  end if;
  v_subject:=left(coalesce(nullif(v_definition->>'name',''),nullif(v_definition->>'displayName',''),new.content_key),160);
  insert into app_private.master_panel_activity(actor,action,subject)
    values(app_private.master_activity_actor_v1(new.updated_by,null),'Archived content',v_subject);
  return new;
end;
$$;
revoke all on function app_private.capture_master_content_archive_activity_v1()
  from public,anon,authenticated,service_role;

create trigger master_activity_content_archive after update of lifecycle
on app_private.combat_content_records for each row
when (old.lifecycle is distinct from new.lifecycle and new.lifecycle='archived')
execute function app_private.capture_master_content_archive_activity_v1();

commit;
