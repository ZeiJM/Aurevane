create table public.site_music_configuration (
  singleton_id boolean primary key default true check (singleton_id),
  enabled boolean not null default true,
  default_track jsonb not null,
  route_overrides jsonb not null default '[]'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_music_configuration enable row level security;
revoke all on table public.site_music_configuration from anon, authenticated;

insert into public.site_music_configuration (
  singleton_id,
  enabled,
  default_track,
  route_overrides,
  revision
)
values (
  true,
  true,
  jsonb_build_object(
    'label', 'Road to Aurevane',
    'url', 'https://luazfeupwfgnilohfsya.supabase.co/storage/v1/object/public/site-music/defaults/road-to-aurevane.webm',
    'source', 'bundled',
    'loop', true
  ),
  '[]'::jsonb,
  1
)
on conflict (singleton_id) do nothing;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'site-music',
  'site-music',
  true,
  20971520,
  array[
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'audio/wav',
    'audio/x-wav'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
