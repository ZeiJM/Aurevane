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
revoke all on table public.character_profile_display from anon, authenticated;

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
revoke all on table public.character_presence from anon, authenticated;
