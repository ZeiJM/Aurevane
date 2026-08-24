begin;

create extension if not exists pg_cron;

create table app_private.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null,
  delete_after timestamptz not null,
  constraint account_deletion_request_delay check (
    delete_after = requested_at + interval '24 hours'
  )
);

create index account_deletion_requests_due_idx
  on app_private.account_deletion_requests (delete_after, user_id);

comment on table app_private.account_deletion_requests is
  'Server-authoritative 24-hour whole-account deletion grace state. Browser roles have no direct access.';

revoke all on table app_private.account_deletion_requests from public, anon, authenticated;
grant select on table app_private.account_deletion_requests to service_role;

create or replace function app_private.finalize_account_deletion_for_user_v1(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
declare
  v_request app_private.account_deletion_requests%rowtype;
  v_deleted boolean := false;
begin
  select * into v_request
  from app_private.account_deletion_requests request
  where request.user_id = p_user_id
  for update;

  if not found or v_request.delete_after > clock_timestamp() then
    return false;
  end if;

  -- A battle snapshot/event can contain participant state even when another player owns the
  -- battle session. Delete every battle the departing account participated in so no recoverable
  -- battle payload remains linked to that player's characters or actions.
  delete from app_private.battle_sessions session
  where session.owner_user_id = p_user_id
     or exists (
       select 1
       from app_private.battle_participants participant
       where participant.battle_session_id = session.id
         and participant.user_id = p_user_id
     );

  -- Idempotency records intentionally use a textual actor key instead of a foreign key, so they
  -- must be purged explicitly before the auth identity is removed.
  delete from app_private.idempotency_records
  where actor_key = 'user:' || p_user_id::text;

  -- Supabase supports direct deletion from auth.users. Every AUREVANE user-owned table is linked
  -- directly or transitively by ON DELETE CASCADE, so this removes the login identity/email,
  -- sessions, player profile, characters, progression, training, presence, PvP ownership and chat,
  -- session leases, validation events, and the deletion request itself in one transaction.
  delete from auth.users
  where id = p_user_id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function app_private.finalize_account_deletion_for_user_v1(uuid)
  from public, anon, authenticated;

create or replace function app_private.finalize_due_account_deletions_v1()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
declare
  v_user_id uuid;
  v_count integer := 0;
begin
  for v_user_id in
    select request.user_id
    from app_private.account_deletion_requests request
    where request.delete_after <= clock_timestamp()
    order by request.delete_after, request.user_id
    for update skip locked
  loop
    if app_private.finalize_account_deletion_for_user_v1(v_user_id) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function app_private.finalize_due_account_deletions_v1()
  from public, anon, authenticated;

create or replace function public.get_account_deletion_state_v1(
  p_user_id uuid
)
returns table (requested_at timestamptz, delete_after timestamptz)
language sql
security definer
set search_path = pg_catalog, public, app_private
as $$
  select request.requested_at, request.delete_after
  from app_private.account_deletion_requests request
  where request.user_id = p_user_id;
$$;

create or replace function public.request_account_deletion_v1(
  p_user_id uuid
)
returns table (requested_at timestamptz, delete_after timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_request app_private.account_deletion_requests%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_NOT_FOUND';
  end if;

  select * into v_request
  from app_private.account_deletion_requests request
  where request.user_id = p_user_id
  for update;

  if found then
    return query select v_request.requested_at, v_request.delete_after;
    return;
  end if;

  insert into app_private.account_deletion_requests (user_id, requested_at, delete_after)
  values (p_user_id, v_now, v_now + interval '24 hours')
  returning * into v_request;

  return query select v_request.requested_at, v_request.delete_after;
end;
$$;

create or replace function public.cancel_account_deletion_v1(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
declare
  v_request app_private.account_deletion_requests%rowtype;
begin
  select * into v_request
  from app_private.account_deletion_requests request
  where request.user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  if v_request.delete_after <= clock_timestamp() then
    perform app_private.finalize_account_deletion_for_user_v1(p_user_id);
    return false;
  end if;

  delete from app_private.account_deletion_requests
  where user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.get_account_deletion_state_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.request_account_deletion_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.cancel_account_deletion_v1(uuid)
  from public, anon, authenticated;

grant execute on function public.get_account_deletion_state_v1(uuid) to service_role;
grant execute on function public.request_account_deletion_v1(uuid) to service_role;
grant execute on function public.cancel_account_deletion_v1(uuid) to service_role;

-- Finalization runs independently of browser activity. The five-minute cadence preserves the full
-- 24-hour grace period while bounding normal execution delay to at most a few minutes.
do $$
declare
  v_existing_job_id bigint;
begin
  select jobid into v_existing_job_id
  from cron.job
  where jobname = 'aurevane-finalize-account-deletions';

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'aurevane-finalize-account-deletions',
    '*/5 * * * *',
    'select app_private.finalize_due_account_deletions_v1();'
  );
end;
$$;

commit;
