begin;

-- Keep authenticated shell and heartbeat presence work to one server-to-database round trip.
-- This preserves the existing ownership/deletion guard and the authoritative 10-minute online window.
create or replace function public.touch_character_presence_and_count_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_online_count integer;
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

  select count(*)::integer
    into v_online_count
  from public.character_presence p
  join public.characters c on c.id = p.character_id
  where p.last_seen_at >= v_now - interval '10 minutes'
    and not exists (
      select 1
      from app_private.character_deletion_requests d
      where d.character_id = c.id
    );

  return v_online_count;
end;
$$;

revoke all on function public.touch_character_presence_and_count_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.touch_character_presence_and_count_v1(uuid, uuid)
  to service_role;

commit;
