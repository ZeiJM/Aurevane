begin;

create table app_private.product_validation_events (
  event_id uuid primary key default gen_random_uuid(),
  event_name text not null check (
    event_name in (
      'first_combat_started',
      'first_combat_completed',
      'combat_abandoned'
    )
  ),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  battle_session_id uuid not null references app_private.battle_sessions(id) on delete cascade,
  battle_id text not null check (char_length(battle_id) between 1 and 160),
  rules_version integer not null check (rules_version > 0),
  content_version integer not null check (content_version > 0),
  battle_version bigint not null check (battle_version > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

comment on table app_private.product_validation_events is
  'Private, server-derived product-validation events. Browser roles have no direct access.';
comment on column app_private.product_validation_events.metadata is
  'Server-authored stable metadata only. Never accepts arbitrary browser analytics payloads.';

create unique index product_validation_first_combat_event_user_idx
  on app_private.product_validation_events (user_id, event_name)
  where event_name in ('first_combat_started', 'first_combat_completed');

create unique index product_validation_abandoned_session_user_idx
  on app_private.product_validation_events (battle_session_id, user_id, event_name)
  where event_name = 'combat_abandoned';

create index product_validation_event_created_idx
  on app_private.product_validation_events (event_name, created_at desc);

revoke all on table app_private.product_validation_events from public, anon, authenticated;

create or replace function app_private.capture_battle_validation_start_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_session app_private.battle_sessions%rowtype;
begin
  if new.participant_role <> 'player' or new.user_id is null then
    return new;
  end if;

  select s.* into strict v_session
  from app_private.battle_sessions s
  where s.id = new.battle_session_id;

  insert into app_private.product_validation_events (
    event_name,
    user_id,
    character_id,
    battle_session_id,
    battle_id,
    rules_version,
    content_version,
    battle_version,
    metadata
  ) values (
    'first_combat_started',
    new.user_id,
    new.character_id,
    v_session.id,
    v_session.battle_id,
    v_session.rules_version,
    v_session.content_version,
    v_session.current_version,
    jsonb_build_object(
      'battle_id', v_session.battle_id,
      'rules_version', v_session.rules_version,
      'content_version', v_session.content_version,
      'battle_version', v_session.current_version
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

create trigger battle_participant_validation_start_v1
  after insert on app_private.battle_participants
  for each row
  when (new.participant_role = 'player')
  execute function app_private.capture_battle_validation_start_v1();

create or replace function app_private.capture_battle_validation_terminal_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_event_name text;
  v_participant record;
begin
  if new.lifecycle is not distinct from old.lifecycle then
    return new;
  end if;

  if new.lifecycle = 'completed' then
    v_event_name := 'first_combat_completed';
  elsif new.lifecycle = 'abandoned' then
    v_event_name := 'combat_abandoned';
  else
    return new;
  end if;

  for v_participant in
    select p.user_id, p.character_id
    from app_private.battle_participants p
    where p.battle_session_id = new.id
      and p.participant_role = 'player'
      and p.user_id is not null
  loop
    insert into app_private.product_validation_events (
      event_name,
      user_id,
      character_id,
      battle_session_id,
      battle_id,
      rules_version,
      content_version,
      battle_version,
      metadata
    ) values (
      v_event_name,
      v_participant.user_id,
      v_participant.character_id,
      new.id,
      new.battle_id,
      new.rules_version,
      new.content_version,
      new.current_version,
      jsonb_build_object(
        'battle_id', new.battle_id,
        'rules_version', new.rules_version,
        'content_version', new.content_version,
        'battle_version', new.current_version
      )
    )
    on conflict do nothing;
  end loop;

  return new;
end;
$$;

create trigger battle_session_validation_terminal_v1
  after update of lifecycle on app_private.battle_sessions
  for each row
  when (new.lifecycle is distinct from old.lifecycle)
  execute function app_private.capture_battle_validation_terminal_v1();

revoke all on function app_private.capture_battle_validation_start_v1() from public, anon, authenticated;
revoke all on function app_private.capture_battle_validation_terminal_v1() from public, anon, authenticated;

commit;
