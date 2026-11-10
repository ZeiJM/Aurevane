begin;

alter table app_private.battle_participants
  add column appearance_captured boolean not null default false,
  add column appearance_image_url text;

create function app_private.capture_battle_character_appearance_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.character_id is not null then
    new.appearance_captured := true;
    select d.image_url into new.appearance_image_url
      from public.character_profile_display d
      where d.character_id = new.character_id and d.user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger capture_battle_character_appearance
  before insert on app_private.battle_participants
  for each row execute function app_private.capture_battle_character_appearance_v1();

-- Only the service may read pins, after the canonical battle visibility check selected its roster.
-- Null is a captured fallback. Old battles without a pin retain the historical display adapter.
create function public.get_battle_character_appearances_v1(p_battle_session_id uuid)
returns table (character_id uuid, image_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.character_id, p.appearance_image_url
  from app_private.battle_participants p
  where p.battle_session_id = p_battle_session_id
    and p.appearance_captured
    and p.character_id is not null;
$$;

revoke all on function app_private.capture_battle_character_appearance_v1() from public, anon, authenticated;
revoke all on function public.get_battle_character_appearances_v1(uuid) from public, anon, authenticated;
grant execute on function public.get_battle_character_appearances_v1(uuid) to service_role;

commit;
