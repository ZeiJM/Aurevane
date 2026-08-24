begin;

create table if not exists app_private.player_recent_emojis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recent_emojis text[] not null default array[]::text[],
  updated_at timestamptz not null default clock_timestamp(),
  constraint player_recent_emojis_max_count check (cardinality(recent_emojis) <= 10)
);

revoke all on table app_private.player_recent_emojis from public, anon, authenticated;
grant select, insert, update on table app_private.player_recent_emojis to service_role;

create or replace function public.get_player_recent_emojis_v1(p_user_id uuid)
returns text[]
language sql
security definer
set search_path = pg_catalog, app_private
stable
as $$
  select coalesce(
    (
      select e.recent_emojis
      from app_private.player_recent_emojis e
      where e.user_id = p_user_id
    ),
    array[]::text[]
  );
$$;

create or replace function public.save_player_recent_emojis_v1(
  p_user_id uuid,
  p_recent_emojis text[]
)
returns text[]
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_value text;
  v_result text[];
begin
  if p_user_id is null or p_recent_emojis is null or cardinality(p_recent_emojis) > 10 then
    raise exception using errcode = '22023', message = 'RECENT_EMOJIS_INVALID';
  end if;

  foreach v_value in array p_recent_emojis loop
    if v_value is null or char_length(v_value) < 1 or char_length(v_value) > 64 then
      raise exception using errcode = '22023', message = 'RECENT_EMOJIS_INVALID';
    end if;
  end loop;

  if cardinality(p_recent_emojis) <> cardinality(array(select distinct unnest(p_recent_emojis))) then
    raise exception using errcode = '22023', message = 'RECENT_EMOJIS_DUPLICATE';
  end if;

  insert into app_private.player_recent_emojis (user_id, recent_emojis, updated_at)
  values (p_user_id, p_recent_emojis, clock_timestamp())
  on conflict (user_id) do update
  set recent_emojis = excluded.recent_emojis,
      updated_at = excluded.updated_at
  returning recent_emojis into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_player_recent_emojis_v1(uuid) from public, anon, authenticated;
revoke all on function public.save_player_recent_emojis_v1(uuid, text[]) from public, anon, authenticated;
grant execute on function public.get_player_recent_emojis_v1(uuid) to service_role;
grant execute on function public.save_player_recent_emojis_v1(uuid, text[]) to service_role;

commit;
