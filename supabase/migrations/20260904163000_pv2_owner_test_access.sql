begin;

create table app_private.pv2_buildcraft_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  granted_at timestamptz not null default clock_timestamp(),
  note text,
  constraint pv2_buildcraft_testers_note_length check (
    note is null or char_length(note) between 1 and 160
  )
);

comment on table app_private.pv2_buildcraft_testers is
  'Server-only allowlist for temporary PV-2 representative buildcraft preparation on a deployed environment. Membership never grants direct browser authority over build tables or privileged RPCs.';

revoke all on table app_private.pv2_buildcraft_testers from public, anon, authenticated;
grant select on table app_private.pv2_buildcraft_testers to service_role;

create or replace function public.is_pv2_buildcraft_tester_v1(
  p_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select coalesce((
    select tester.enabled
    from app_private.pv2_buildcraft_testers tester
    where tester.user_id = p_user_id
  ), false);
$$;

revoke all on function public.is_pv2_buildcraft_tester_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.is_pv2_buildcraft_tester_v1(uuid)
  to service_role;

commit;
