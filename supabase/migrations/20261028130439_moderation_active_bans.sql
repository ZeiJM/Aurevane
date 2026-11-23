begin;

alter table app_private.master_moderation_audit add column reviewed_revision text;

-- An exact successful Lift retry acknowledges its existing immutable receipt.
-- A later ban/edit, different actor or different reviewed revision never replays.
do $migration$
declare body text; predecessor text;
begin
 body:=pg_get_functiondef('public.write_master_moderation_v1(uuid,uuid,text,text,text,integer,boolean,uuid)'::regprocedure);
 predecessor:=$before$ if revision is distinct from p_expected_revision then$before$;
 if strpos(body,predecessor)=0 then raise exception 'BAN_LIFT_REPLAY_PREDECESSOR_CONFLICT'; end if;
 body:=replace(body,predecessor,$after$ if p_action='lift' and before_value is null and exists(
   select 1 from app_private.master_moderation_audit a
   where a.id=(select max(id) from app_private.master_moderation_audit where target_user_id=p_target_user_id)
     and a.action='lift' and a.after_until is null and a.reviewed_revision=p_expected_revision
     and a.actor_user_id=p_actor_user_id and a.actor_character_id is not distinct from p_actor_character_id
     and a.reason=trim(p_reason)) then
   return public.read_master_moderation_v1(p_actor_user_id,p_target_user_id,p_actor_character_id);
 end if;
 if revision is distinct from p_expected_revision then$after$);
 predecessor:=$before$insert into app_private.master_moderation_audit(actor_user_id,actor_character_id,target_user_id,action,reason,before_until,after_until) values(p_actor_user_id,p_actor_character_id,p_target_user_id,p_action,trim(p_reason),before_value,after_value);$before$;
 if strpos(body,predecessor)=0 then raise exception 'BAN_LIFT_AUDIT_PREDECESSOR_CONFLICT'; end if;
 body:=replace(body,predecessor,$after$insert into app_private.master_moderation_audit(actor_user_id,actor_character_id,target_user_id,action,reason,before_until,after_until,reviewed_revision) values(p_actor_user_id,p_actor_character_id,p_target_user_id,p_action,trim(p_reason),before_value,after_value,p_expected_revision);$after$);
 execute body;
end; $migration$;

create function public.list_active_master_bans_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_after_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'moderation.manage');
 with page as (
   select u.id,u.banned_until from auth.users u
   where u.email_confirmed_at is not null and u.banned_until>statement_timestamp()
     and (p_after_user_id is null or u.id>p_after_user_id)
   order by u.id limit 51
 ), shown as (select * from page order by id limit 50)
 select jsonb_build_object('bans',coalesce(jsonb_agg(jsonb_build_object(
   'userId',s.id,'characterId',c.id,'name',coalesce(c.name,'Account without a character'),
   'revision',md5(coalesce(a.id,0)::text||'|'||extract(epoch from s.banned_until)::text),
   'active',true,'permanent',s.banned_until='9999-12-31T23:59:59Z'::timestamptz,
   'expiresAt',case when s.banned_until='9999-12-31T23:59:59Z'::timestamptz then null else s.banned_until end,
   'protected',s.id=p_actor_user_id or exists(select 1 from app_private.master_panel_role_assignments roles where roles.user_id=s.id and roles.role='game-owner' and roles.enabled),
   'reason',case when a.after_until=s.banned_until then a.reason else 'No reason recorded.' end
 ) order by s.id),'[]'::jsonb),
 'nextCursor',case when (select count(*) from page)>50 then (select id::text from shown order by id desc limit 1) else null end)
 into result from shown s
 left join lateral (select ch.id,ch.name from public.characters ch where ch.user_id=s.id order by ch.id limit 1) c on true
 left join lateral (select audit.id,audit.reason,audit.after_until from app_private.master_moderation_audit audit where audit.target_user_id=s.id order by audit.id desc limit 1) a on true;
 return result;
end; $$;
revoke all on function public.list_active_master_bans_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_active_master_bans_v1(uuid,uuid,uuid) to service_role;

commit;
