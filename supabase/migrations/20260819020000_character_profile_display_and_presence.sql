begin;

-- A2 feedback: cosmetic profile image display and authenticated online-character presence.
-- Both tables are server-managed only. Browser clients receive data through authenticated app routes.

create table if not exists public.character_profile_display (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text null,
  updated_at timestamptz not null default now(),
  constraint character_profile_display_image_url_length check (
    image_url is null or char_length(image_url) <= 2048
  )
);

create unique index if not exists character_profile_display_user_character_idx
  on public.character_profile_display(user_id, character_id);

alter table public.character_profile_display enable row level security;
revoke all on table public.character_profile_display from public, anon, authenticated;
grant select, insert, update, delete on table public.character_profile_display to service_role;

create table if not exists public.character_presence (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create index if not exists character_presence_last_seen_idx
  on public.character_presence(last_seen_at desc);
create index if not exists character_presence_user_idx
  on public.character_presence(user_id);

alter table public.character_presence enable row level security;
revoke all on table public.character_presence from public, anon, authenticated;
grant select, insert, update, delete on table public.character_presence to service_role;

create or replace function public.touch_character_presence_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  if not exists (
    select 1
    from public.characters c
    where c.id = p_character_id
      and c.user_id = p_user_id
      and not exists (
        select 1
        from app_private.character_deletion_requests d
        where d.character_id = c.id
      )
  ) then
    raise exception 'CHARACTER_NOT_PLAYABLE';
  end if;

  insert into public.character_presence (character_id, user_id, last_seen_at)
  values (p_character_id, p_user_id, v_now)
  on conflict (character_id) do update
    set user_id = excluded.user_id,
        last_seen_at = excluded.last_seen_at;

  return v_now;
end;
$$;

create or replace function public.list_online_characters_v1()
returns table (
  character_id uuid,
  character_name text,
  character_level integer,
  last_seen_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select c.id, c.name, c.level, p.last_seen_at
  from public.character_presence p
  join public.characters c on c.id = p.character_id
  where p.last_seen_at >= now() - interval '10 minutes'
    and not exists (
      select 1
      from app_private.character_deletion_requests d
      where d.character_id = c.id
    )
  order by p.last_seen_at desc, c.name asc;
$$;

revoke all on function public.touch_character_presence_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_online_characters_v1() from public, anon, authenticated;
grant execute on function public.touch_character_presence_v1(uuid, uuid) to service_role;
grant execute on function public.list_online_characters_v1() to service_role;

commit;
