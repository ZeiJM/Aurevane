begin;

create table public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.player_profiles is
  'Private account-level AUREVANE profile metadata. Character identity is stored separately when character persistence is introduced.';

alter table public.player_profiles enable row level security;

revoke all on table public.player_profiles from public;
revoke all on table public.player_profiles from anon;
revoke all on table public.player_profiles from authenticated;
grant select on table public.player_profiles to authenticated;

create policy player_profiles_select_own
on public.player_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function app_private.create_player_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.player_profiles (user_id, created_at)
  values (new.id, coalesce(new.created_at, now()))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function app_private.create_player_profile_for_new_auth_user() is
  'Creates exactly one minimal AUREVANE player profile from authoritative auth.users identity.';

revoke all on function app_private.create_player_profile_for_new_auth_user() from public;
revoke all on function app_private.create_player_profile_for_new_auth_user() from anon;
revoke all on function app_private.create_player_profile_for_new_auth_user() from authenticated;

insert into public.player_profiles (user_id, created_at)
select id, created_at
from auth.users
on conflict (user_id) do nothing;

drop trigger if exists on_auth_user_created_create_player_profile on auth.users;
create trigger on_auth_user_created_create_player_profile
after insert on auth.users
for each row execute function app_private.create_player_profile_for_new_auth_user();

commit;
