begin;

-- Public character directory for the authenticated Online Users surface.
-- The function intentionally exposes character identity plus presence timing only; account ownership
-- and all private progression/economy data remain server-only.
create or replace function public.list_character_presence_directory_v1()
returns table (
  character_id uuid,
  character_name text,
  character_level integer,
  last_seen_at timestamptz,
  is_online boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    c.id,
    c.name,
    c.level,
    p.last_seen_at,
    coalesce(p.last_seen_at >= now() - interval '10 minutes', false) as is_online
  from public.characters c
  left join public.character_presence p on p.character_id = c.id
  where not exists (
    select 1
    from app_private.character_deletion_requests d
    where d.character_id = c.id
  )
  order by p.last_seen_at desc nulls last, c.name asc;
$$;

revoke all on function public.list_character_presence_directory_v1() from public, anon, authenticated;
grant execute on function public.list_character_presence_directory_v1() to service_role;

commit;
