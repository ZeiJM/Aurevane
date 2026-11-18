begin;

-- Server-owned, durable one-minute pre-rotation return from Uncharted realms.
-- Ordinary client rendering and timers never decide whether a player stays.
-- The deadline is pinned in authoritative world state and cannot be extended
-- by stale browser commands, a missed cron pass, or an offline login.

create function app_private.world_void_private_sector_v1(p_sector_id text)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select coalesce(p_sector_id like 'void:%' or p_sector_id like 'uncharted-%', false);
$$;

create function app_private.world_void_cutoff_v1(p_now_ms bigint)
returns bigint language sql stable strict set search_path = pg_catalog as $$
  select (app_private.world_void_rotation_v1(p_now_ms)->>'nextRollAt')::bigint - 60000;
$$;

create function app_private.world_void_return_due_v1(p_state jsonb, p_now_ms bigint)
returns boolean language plpgsql stable set search_path = '' as $$
declare
  v_sector text := p_state#>>'{position,sectorId}';
  v_rotation jsonb;
  v_cutoff bigint;
  v_saved bigint;
begin
  if not app_private.world_void_private_sector_v1(v_sector) then return false; end if;
  v_rotation := app_private.world_void_rotation_v1(p_now_ms);
  v_cutoff := (v_rotation->>'nextRollAt')::bigint - 60000;
  v_saved := nullif(p_state->>'voidReturnAt','')::bigint;
  return p_now_ms >= least(coalesce(v_saved,v_cutoff),v_cutoff)
    or (p_state->>'voidEntryRealm' is not null
      and p_state->>'voidEntryRealm' is distinct from v_rotation->>'realmId')
    or (v_sector like 'void:%'
      and split_part(v_sector,':',2) is distinct from v_rotation->>'realmId')
    or (p_state->>'warpedPhase' is not null
      and (p_state->>'warpedPhase')::bigint is distinct from
        app_private.world_warped_phase_v1(p_now_ms));
end;
$$;

create function app_private.world_void_mark_state_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new_id text := new.state#>>'{position,sectorId}';
  v_old_id text;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_rotation jsonb;
  v_cutoff bigint;
  v_return_at bigint;
  v_entry_realm text;
begin
  if not app_private.world_void_private_sector_v1(v_new_id) then
    new.state := new.state - 'voidReturnAt' - 'voidEntryRealm';
    return new;
  end if;
  v_rotation := app_private.world_void_rotation_v1(v_now_ms);
  v_cutoff := (v_rotation->>'nextRollAt')::bigint - 60000;
  if tg_op = 'UPDATE' then
    v_old_id := old.state#>>'{position,sectorId}';
  end if;
  if app_private.world_void_private_sector_v1(v_old_id) then
    v_return_at := least(
      coalesce((old.state->>'voidReturnAt')::bigint,
        (new.state->>'voidReturnAt')::bigint, v_cutoff),
      v_cutoff
    );
    v_entry_realm := coalesce(
      old.state->>'voidEntryRealm',
      case when v_old_id like 'void:%' then split_part(v_old_id,':',2)
        else v_rotation->>'realmId' end
    );
  else
    v_return_at := v_cutoff;
    v_entry_realm := case when v_new_id like 'void:%' then
      split_part(v_new_id,':',2) else v_rotation->>'realmId' end;
  end if;
  new.state := new.state || jsonb_build_object(
    'voidReturnAt', v_return_at, 'voidEntryRealm', v_entry_realm
  );
  return new;
end;
$$;
create trigger world_void_mark_state_v1
before insert or update of state on app_private.character_world_state
for each row execute function app_private.world_void_mark_state_v1();

-- Upgrade already saved private characters. Infer the earliest due deadline
-- from their last authoritative activity, rather than granting an additional
-- full rotation to somebody who was offline over a missed boundary.
with cadence as (
  select warped_shift_minutes::bigint * 60000 as period_ms,
    app_private.world_void_cutoff_v1(
      floor(extract(epoch from clock_timestamp()) * 1000)::bigint
    ) as current_cutoff,
    app_private.world_void_rotation_v1(
      floor(extract(epoch from clock_timestamp()) * 1000)::bigint
    )->>'realmId' as current_realm
  from app_private.world_environment_settings where singleton
)
update app_private.character_world_state w
set state = w.state || jsonb_build_object(
  'voidReturnAt', least(
    cadence.current_cutoff,
    case when isfinite(w.last_seen_at) then
      (floor(
        (extract(epoch from w.last_seen_at) * 1000) / cadence.period_ms
      )::bigint + 1) * cadence.period_ms - 60000
    else cadence.current_cutoff end
  ),
  'voidEntryRealm',
    case when w.sector_id like 'void:%' then split_part(w.sector_id,':',2)
      else cadence.current_realm end,
  'version', (w.state->>'version')::bigint + 1
),
last_command_id = null, last_command_fingerprint = null
from cadence
where app_private.world_void_private_sector_v1(w.sector_id);

-- The ordinary movement command validates against the *locked database clock*.
-- A request planned before the cutoff cannot sneak a private step past it.
create function app_private.world_void_private_commit_blocked_v1(
  p_before jsonb, p_after jsonb, p_now_ms bigint
) returns boolean language plpgsql stable set search_path = '' as $$
declare v_next text := p_after#>>'{position,sectorId}';
  v_rotation jsonb;
begin
  if not app_private.world_void_private_sector_v1(v_next) then return false; end if;
  if app_private.world_void_return_due_v1(p_before,p_now_ms) then return true; end if;
  v_rotation := app_private.world_void_rotation_v1(p_now_ms);
  if p_now_ms >= (v_rotation->>'nextRollAt')::bigint - 60000 then return true; end if;
  if v_next like 'void:%'
    and split_part(v_next,':',2) is distinct from v_rotation->>'realmId' then
    return true;
  end if;
  return false;
end;
$$;

do $migration$
declare definition text;
begin
  definition := pg_get_functiondef(
    'public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)'::regprocedure
  );
  if strpos(definition,
    'v_now:=floor(extract(epoch from clock_timestamp())*1000);') = 0
  then raise exception 'WORLD_VOID_COMMIT_PREDECESSOR'; end if;
  definition := replace(definition,
    'v_now:=floor(extract(epoch from clock_timestamp())*1000);',
    'v_now:=floor(extract(epoch from clock_timestamp())*1000);' || chr(10) ||
    ' if app_private.world_void_private_commit_blocked_v1(v_world.state,p_next_state,v_now) then' ||
    ' raise exception ''WORLD_VOID_RETURN_DUE'' using errcode = ''PT409''; end if;');
  execute definition;
end;
$migration$;

-- The same account -> character -> world lock order as movement and ferry,
-- with nonblocking acquisition for cron and conflict/retry safety.
create function app_private.settle_world_void_return_v1(
  p_user_id uuid, p_character_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_world app_private.character_world_state%rowtype;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_next jsonb;
begin
  if not exists(
    select 1 from app_private.character_world_state w
    join public.characters c on c.id = w.character_id
    where w.character_id = p_character_id and c.user_id = p_user_id
      and app_private.world_void_private_sector_v1(w.sector_id)
      and app_private.world_void_return_due_v1(w.state,v_now_ms)
  ) then return false; end if;
  if not pg_try_advisory_xact_lock(hashtextextended(p_user_id::text,1)) then
    return false;
  end if;
  perform 1 from public.characters c
    where c.id = p_character_id and c.user_id = p_user_id
    for update skip locked;
  if not found or exists(
    select 1 from app_private.character_deletion_requests d
    where d.character_id = p_character_id
  ) then return false; end if;
  select * into v_world from app_private.character_world_state w
    where w.character_id = p_character_id for update skip locked;
  if not found or not app_private.world_void_return_due_v1(v_world.state,v_now_ms)
    then return false; end if;
  if app_private.world_block_reason_v1(p_user_id,p_character_id) is not null
    or (v_world.state->'ferry' is not null
      and v_world.state->'ferry' <> 'null'::jsonb)
    then return false; end if;
  v_next := app_private.world_ferry_relocate_v1(
    v_world.state - 'warpedPhase',
    jsonb_build_object('sectorId','umbral-march','x',6,'y',4),
    (v_world.state->>'version')::bigint
  ) - 'voidReturnAt' - 'voidEntryRealm';
  update app_private.character_world_state w
    set state = v_next, last_command_id = null,
      last_command_fingerprint = null, last_seen_at = clock_timestamp()
    where w.character_id = p_character_id;
  return true;
end;
$$;

-- Reads and command admission settle missed windows even without a browser
-- timer or after offline reconnect. Ferry arrival settles first.
create or replace function public.read_world_state_v1(
  p_user_id uuid, p_character_id uuid, p_initial_state jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.settle_world_ferry_v1(p_user_id,p_character_id);
  perform app_private.settle_world_void_return_v1(p_user_id,p_character_id);
  return public.read_world_state_before_ferry_v1(p_user_id,p_character_id,p_initial_state);
end;
$$;

-- Bounded, repeatable, offline-safe scheduled work. Busy players retain their
-- persisted deadline; missed jobs and skipped locks are retried next cycle.
create function app_private.recover_due_world_void_returns_v1(p_limit integer)
returns table(scanned integer, returned integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_row record;
  v_scanned integer := 0;
  v_returned integer := 0;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_cutoff bigint := app_private.world_void_cutoff_v1(v_now_ms);
  v_realm text := app_private.world_void_rotation_v1(v_now_ms)->>'realmId';
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'WORLD_VOID_BATCH_INVALID' using errcode = '22023';
  end if;
  for v_row in
    select w.character_id, c.user_id
    from app_private.character_world_state w
    join public.characters c on c.id = w.character_id
    where app_private.world_void_private_sector_v1(w.sector_id)
      and (
        v_now_ms >= least(
          coalesce((w.state->>'voidReturnAt')::bigint,v_cutoff),v_cutoff
        )
        or (w.state->>'voidEntryRealm' is not null
          and w.state->>'voidEntryRealm' is distinct from v_realm)
        or (w.sector_id like 'void:%'
          and split_part(w.sector_id,':',2) is distinct from v_realm)
        or (w.state->>'warpedPhase' is not null
          and (w.state->>'warpedPhase')::bigint is distinct from
            app_private.world_warped_phase_v1(v_now_ms))
      )
    order by w.last_seen_at asc, w.character_id
    limit p_limit
  loop
    v_scanned := v_scanned + 1;
    if app_private.settle_world_void_return_v1(v_row.user_id,v_row.character_id)
      then v_returned := v_returned + 1; end if;
  end loop;
  return query select v_scanned,v_returned;
end;
$$;

create function app_private.configure_world_void_return_cron_v1(p_enabled boolean)
returns bigint language plpgsql security definer
set search_path = pg_catalog, app_private, cron as $$
declare v_row record; v_id bigint;
begin
  for v_row in select jobid from cron.job
    where jobname = 'aurevane-void-pre-rotation-return-v1'
  loop
    perform cron.unschedule(v_row.jobid);
  end loop;
  if not p_enabled then return null; end if;
  select cron.schedule(
    'aurevane-void-pre-rotation-return-v1','* * * * *',
    'select * from app_private.recover_due_world_void_returns_v1(250);'
  ) into v_id;
  return v_id;
end;
$$;

revoke all on function
  app_private.world_void_private_sector_v1(text),
  app_private.world_void_cutoff_v1(bigint),
  app_private.world_void_return_due_v1(jsonb,bigint),
  app_private.world_void_private_commit_blocked_v1(jsonb,jsonb,bigint),
  app_private.world_void_mark_state_v1(),
  app_private.settle_world_void_return_v1(uuid,uuid),
  app_private.recover_due_world_void_returns_v1(integer),
  app_private.configure_world_void_return_cron_v1(boolean)
  from public,anon,authenticated,service_role;
revoke all on function public.read_world_state_v1(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.read_world_state_v1(uuid,uuid,jsonb)
  to service_role;

comment on function app_private.configure_world_void_return_cron_v1(boolean)
is 'Release activation only, after staged safety checks and verified deployment readiness. The migration does not start production cron.';

commit;
