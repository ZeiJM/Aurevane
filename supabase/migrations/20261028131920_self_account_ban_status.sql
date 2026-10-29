begin;

-- Only a trusted server may call this with its cryptographically verified
-- session subject. This exposes no account identity or moderation history and
-- deliberately does not establish a gameplay lease or grant gameplay access.
create function public.read_account_ban_status_v1(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare until_value timestamptz; current_reason text; active boolean; permanent boolean;
begin
 select banned_until into until_value from auth.users where id=p_user_id and email_confirmed_at is not null;
 if not found then raise exception using errcode='42501',message='ACCOUNT_IDENTITY_REQUIRED'; end if;
 active:=coalesce(until_value>statement_timestamp(),false);
 permanent:=active and until_value='9999-12-31T23:59:59Z'::timestamptz;
 if active then
   select case when a.after_until=until_value then a.reason end into current_reason
   from app_private.master_moderation_audit a where a.target_user_id=p_user_id order by a.id desc limit 1;
 end if;
 return jsonb_build_object('active',active,'permanent',permanent,
   'expiresAt',case when active and not permanent then until_value else null end,
   'reason',case when active then coalesce(current_reason,'No reason recorded. Contact support for details.') else null end,
   'serverTime',statement_timestamp());
end; $$;
revoke all on function public.read_account_ban_status_v1(uuid) from public,anon,authenticated;
grant execute on function public.read_account_ban_status_v1(uuid) to service_role;

commit;
