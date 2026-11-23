begin;

-- The playable look has its own pointer. Existing URL and default portrait settings are fallbacks.
alter table public.character_profile_display
  add column appearance_image_url text,
  add column pending_appearance_image_url text;

update public.character_profile_display
set appearance_image_url = image_url, image_url = null
where image_url like '/api/media/appearance/1/%/neutral.svg';

drop index public.character_profile_display_manual_appearance_unique;
create unique index character_profile_display_active_look_unique
  on public.character_profile_display (appearance_image_url)
  where appearance_image_url is not null;
create unique index character_profile_display_pending_look_unique
  on public.character_profile_display (pending_appearance_image_url)
  where pending_appearance_image_url is not null;

create or replace function app_private.bump_character_appearance_revision_v1()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.appearance_revision :=
      (new.appearance_image_url is not null or new.pending_appearance_image_url is not null)::integer;
  elsif new.appearance_image_url is distinct from old.appearance_image_url
     or new.pending_appearance_image_url is distinct from old.pending_appearance_image_url then
    new.appearance_revision := old.appearance_revision + 1;
  else
    new.appearance_revision := old.appearance_revision;
  end if;
  return new;
end;
$$;

create function public.commit_character_appearance_v2(
  p_user_id uuid, p_character_id uuid, p_expected_revision integer, p_image_url text
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_revision integer;
  v_current_url text;
  v_pending_url text;
  v_battle_active boolean;
begin
  if p_image_url is null
    or p_image_url !~ '^/api/media/appearance/1/[a-z]+(\.[a-z]+){11}/neutral\.svg$'
    or p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'CHARACTER_APPEARANCE_INVALID';
  end if;

  perform 1 from public.characters c
    where c.id = p_character_id and c.user_id = p_user_id
      and not exists (
        select 1 from app_private.character_deletion_requests d where d.character_id = c.id
      )
    for no key update;
  if not found then
    raise exception using errcode = '42501', message = 'CHARACTER_NOT_PLAYABLE';
  end if;

  select d.appearance_revision, d.appearance_image_url, d.pending_appearance_image_url
    into v_revision, v_current_url, v_pending_url
    from public.character_profile_display d where d.character_id = p_character_id;
  v_revision := coalesce(v_revision, 0);
  if p_image_url = v_pending_url or (p_image_url = v_current_url and v_pending_url is null) then
    return jsonb_build_object('revision', v_revision, 'imageUrl', v_current_url, 'pendingImageUrl', v_pending_url);
  end if;
  if p_expected_revision <> v_revision then
    raise exception using errcode = 'PT409', message = 'CHARACTER_APPEARANCE_STALE';
  end if;

  -- Serialize claims for this URL across both columns. Moving a reserved URL to active does not
  -- change which character owns that claim, and the unique indexes guard writes to each column.
  perform pg_advisory_xact_lock(hashtextextended(p_image_url, 640491));
  if exists (
    select 1 from public.character_profile_display d where d.character_id <> p_character_id
      and (d.appearance_image_url = p_image_url or d.pending_appearance_image_url = p_image_url)
  ) then
    raise exception using errcode = '23505', message = 'CHARACTER_APPEARANCE_DUPLICATE';
  end if;

  v_battle_active := exists (
    select 1 from app_private.battle_participants p
    join app_private.battle_sessions s on s.id = p.battle_session_id
    where p.character_id = p_character_id and p.user_id = p_user_id
      and p.participant_role = 'player' and s.lifecycle = 'active'
  );
  if v_battle_active then
    v_pending_url := case when p_image_url is distinct from v_current_url then p_image_url end;
  else
    v_current_url := p_image_url;
    v_pending_url := null;
  end if;
  insert into public.character_profile_display as d
    (character_id, user_id, appearance_image_url, pending_appearance_image_url, updated_at)
    values (p_character_id, p_user_id, v_current_url, v_pending_url, clock_timestamp())
    on conflict (character_id) do update set
      appearance_image_url = excluded.appearance_image_url,
      pending_appearance_image_url = excluded.pending_appearance_image_url,
      updated_at = excluded.updated_at
    returning d.appearance_revision into v_revision;
  return jsonb_build_object('revision', v_revision, 'imageUrl', v_current_url, 'pendingImageUrl', v_pending_url);
end;
$$;

-- Keep the character creation wrapper's original transaction and return shape.
create or replace function public.commit_character_appearance_v1(
  p_user_id uuid, p_character_id uuid, p_expected_revision integer, p_image_url text
)
returns integer
language sql security definer set search_path = '' as $$
  select (public.commit_character_appearance_v2(
    p_user_id, p_character_id, p_expected_revision, p_image_url
  )->>'revision')::integer;
$$;

create or replace function app_private.capture_battle_character_appearance_v1()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.character_id is not null then
    new.appearance_captured := true;
    -- Serialize the capture against appearance confirmation and activation for this character.
    perform 1 from public.characters c where c.id = new.character_id for no key update;
    select coalesce(d.appearance_image_url, d.image_url,
      '/api/media/starter-portrait/' || c.portrait_ref)
    into new.appearance_image_url
    from public.characters c
    left join public.character_profile_display d on d.character_id = c.id and d.user_id = c.user_id
    where c.id = new.character_id and c.user_id = new.user_id;
  end if;
  return new;
end;
$$;

create function app_private.activate_pending_battle_appearances_v1()
returns trigger
language plpgsql set search_path = '' as $$
declare
  v_character_id uuid;
begin
  for v_character_id in
    select distinct p.character_id from app_private.battle_participants p
      where p.battle_session_id = new.id and p.participant_role = 'player'
        and p.character_id is not null
      order by p.character_id
  loop
    perform 1 from public.characters c where c.id = v_character_id for no key update;
    if not exists (
      select 1 from app_private.battle_participants p
      join app_private.battle_sessions s on s.id = p.battle_session_id
      where p.character_id = v_character_id and p.participant_role = 'player'
        and s.id <> new.id and s.lifecycle = 'active'
    ) then
      update public.character_profile_display
        set appearance_image_url = pending_appearance_image_url, pending_appearance_image_url = null,
          updated_at = clock_timestamp()
        where character_id = v_character_id and pending_appearance_image_url is not null;
    end if;
  end loop;
  return null;
end;
$$;

create trigger activate_pending_battle_appearances
  after update of lifecycle on app_private.battle_sessions
  for each row when (old.lifecycle = 'active' and new.lifecycle in ('completed', 'abandoned'))
  execute function app_private.activate_pending_battle_appearances_v1();

revoke all on function public.commit_character_appearance_v2(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.commit_character_appearance_v2(uuid, uuid, integer, text) to service_role;
revoke all on function app_private.activate_pending_battle_appearances_v1() from public, anon, authenticated;

commit;
