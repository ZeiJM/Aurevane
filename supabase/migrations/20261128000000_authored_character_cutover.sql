begin;

set local lock_timeout = '5s';

-- Snapshot the verified catalogue for this release. Sync it with the
-- sync-cutover command of scripts/media/authored_character_catalogue.py.
create temporary table authored_appearance_pool (
  url text primary key,
  gender text not null check (gender in ('f', 'm')),
  draw_order double precision not null default random()
) on commit drop;

insert into pg_temp.authored_appearance_pool (url, gender)
select '/api/media/appearance/7/' || roster.key || '.v' || variants.number || '/neutral.svg',
       split_part(reverse(roster.key), '-', 2)
from (values
  -- BEGIN VERIFIED AUTHORED CHARACTERS
  ('elf-f-0001'),
  ('elf-f-0002'),
  ('elf-f-0003'),
  ('elf-f-0004'),
  ('elf-f-0005'),
  ('elf-f-0006'),
  ('elf-m-0001'),
  ('elf-m-0002'),
  ('elf-m-0003'),
  ('elf-m-0004'),
  ('elf-m-0005'),
  ('elf-m-0006'),
  ('fae-f-0001'),
  ('fae-f-0002'),
  ('fae-f-0003'),
  ('fae-f-0004'),
  ('fae-f-0005'),
  ('fae-f-0006'),
  ('fae-m-0001'),
  ('fae-m-0002'),
  ('fae-m-0003'),
  ('fae-m-0004'),
  ('fae-m-0005'),
  ('fae-m-0006'),
  ('human-f-0001'),
  ('human-f-0002'),
  ('human-f-0003'),
  ('human-f-0004'),
  ('human-f-0005'),
  ('human-f-0006'),
  ('human-m-0001'),
  ('human-m-0002'),
  ('human-m-0003'),
  ('human-m-0004'),
  ('human-m-0005'),
  ('human-m-0006'),
  ('mountain-orc-f-0001'),
  ('mountain-orc-f-0002'),
  ('mountain-orc-f-0003'),
  ('mountain-orc-f-0004'),
  ('mountain-orc-f-0005'),
  ('mountain-orc-f-0006'),
  ('mountain-orc-m-0001'),
  ('mountain-orc-m-0002'),
  ('mountain-orc-m-0003'),
  ('mountain-orc-m-0004'),
  ('mountain-orc-m-0005'),
  ('mountain-orc-m-0006')
  -- END VERIFIED AUTHORED CHARACTERS
) as roster(key)
cross join (values (1), (2)) as variants(number);

create function pg_temp.draw_authored_appearance(p_gender text)
returns text language plpgsql set search_path = '' as $$
declare chosen text;
begin
  delete from pg_temp.authored_appearance_pool
  where url = (
    select url from pg_temp.authored_appearance_pool
    where p_gender is null or gender = p_gender
    order by draw_order, url
    limit 1
  )
  returning url into chosen;
  if chosen is null then
    raise exception 'AUTHORED_APPEARANCE_POOL_EXHAUSTED: %', coalesce(p_gender, 'unspecified');
  end if;
  return chosen;
end;
$$;

lock table public.characters, public.character_profile_display in share row exclusive mode;

do $cutover$
declare
  player record;
  current_url text;
  queued_url text;
begin
  if exists (
    select 1 from pg_temp.authored_appearance_pool
    where not app_private.valid_authored_player_appearance_url_v1(url)
  ) then
    raise exception 'AUTHORED_APPEARANCE_CUTOVER_INVALID_CATALOGUE';
  end if;

  -- Keep exact appearance claims exclusive across active and queued player looks.
  delete from pg_temp.authored_appearance_pool
  where url in (
    select appearance_image_url from public.character_profile_display
    union select pending_appearance_image_url from public.character_profile_display
  );

  for player in
    select c.id, c.user_id, d.appearance_image_url, d.pending_appearance_image_url,
           coalesce(
             case c.presentation_id when 'masculine' then 'm' when 'feminine' then 'f' end,
             case
               when d.appearance_image_url ~ '^/api/media/appearance/[456]/(f[0-9]{2}(soft|keen)?|(fit)?(pinescout|ranger))[.]' then 'f'
               when d.appearance_image_url ~ '^/api/media/appearance/[456]/(m[0-9]{2}(soft|keen)?|(fit)?(scout|guard|elder))[.]' then 'm'
             end,
             case
               when c.portrait_ref like 'portrait.adventure.female-%' or c.portrait_ref in (
                 'portrait.starter.wayfarer-02', 'portrait.starter.wayfarer-05', 'portrait.starter.wayfarer-06',
                 'portrait.starter.wayfarer-07', 'portrait.starter.wayfarer-09', 'portrait.starter.wayfarer-11',
                 'portrait.starter.wayfarer-16', 'portrait.starter.wayfarer-17', 'portrait.starter.wayfarer-21',
                 'portrait.starter.wayfarer-23', 'portrait.starter.wayfarer-26', 'portrait.starter.wayfarer-30'
               ) then 'f'
               when c.portrait_ref like 'portrait.adventure.male-%' or c.portrait_ref in (
                 'portrait.starter.wayfarer-03', 'portrait.starter.wayfarer-04', 'portrait.starter.wayfarer-08',
                 'portrait.starter.wayfarer-10', 'portrait.starter.wayfarer-13', 'portrait.starter.wayfarer-14',
                 'portrait.starter.wayfarer-15', 'portrait.starter.wayfarer-22', 'portrait.starter.wayfarer-27',
                 'portrait.starter.wayfarer-29', 'portrait.starter.wayfarer-33', 'portrait.starter.wayfarer-40'
               ) then 'm'
             end
           ) as gender
    from public.characters c
    left join public.character_profile_display d on d.character_id = c.id
    where (
      not app_private.valid_authored_player_appearance_url_v1(d.appearance_image_url)
      or (d.pending_appearance_image_url is not null
          and not app_private.valid_authored_player_appearance_url_v1(d.pending_appearance_image_url))
    )
    and not exists (
      select 1 from app_private.character_deletion_requests deletion where deletion.character_id = c.id
    )
    order by gender nulls last, c.id
  loop
    current_url := player.appearance_image_url;
    queued_url := player.pending_appearance_image_url;
    if not app_private.valid_authored_player_appearance_url_v1(current_url) then
      current_url := pg_temp.draw_authored_appearance(player.gender);
    end if;
    if queued_url is not null and not app_private.valid_authored_player_appearance_url_v1(queued_url) then
      queued_url := pg_temp.draw_authored_appearance(player.gender);
    end if;

    -- A release assignment is free. The profile trigger advances its revision
    -- and existing battle participants continue to use their captured appearance.
    insert into public.character_profile_display
      (character_id, user_id, appearance_image_url, pending_appearance_image_url, updated_at)
    values (player.id, player.user_id, current_url, queued_url, clock_timestamp())
    on conflict (character_id) do update set
      appearance_image_url = excluded.appearance_image_url,
      pending_appearance_image_url = excluded.pending_appearance_image_url,
      updated_at = excluded.updated_at;
  end loop;
end;
$cutover$;

-- Characters using the shared starter look still pin an authored portrait in a new battle.
create or replace function app_private.capture_battle_character_appearance_v1()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.character_id is not null then
    new.appearance_captured := true;
    perform 1 from public.characters c where c.id = new.character_id for no key update;
    select coalesce(
      d.appearance_image_url,
      '/api/media/appearance/7/human-' ||
      case when c.presentation_id = 'masculine' then 'm' else 'f' end ||
      '-0001.v1/neutral.svg'
    )
    into new.appearance_image_url
    from public.characters c
    left join public.character_profile_display d on d.character_id = c.id and d.user_id = c.user_id
    where c.id = new.character_id and c.user_id = new.user_id;
  end if;
  return new;
end;
$$;

commit;
