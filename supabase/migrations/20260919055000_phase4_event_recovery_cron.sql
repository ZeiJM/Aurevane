begin;

create table app_private.event_recovery_state (
  singleton boolean primary key default true check (singleton),
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_processed_count integer not null default 0 check (last_processed_count >= 0),
  last_action_count integer not null default 0 check (last_action_count >= 0),
  last_error_count integer not null default 0 check (last_error_count >= 0),
  last_error_at timestamptz,
  last_error_code text
);

insert into app_private.event_recovery_state (singleton)
values (true)
on conflict (singleton) do nothing;

alter table app_private.event_recovery_state enable row level security;
revoke all on table app_private.event_recovery_state
  from public, anon, authenticated, service_role;
grant select on table app_private.event_recovery_state to service_role;

comment on table app_private.event_recovery_state is
  'Singleton health projection for bounded server-owned Event recovery runs. No player/browser authority.';

create or replace function app_private.freeze_event_phase_clock_on_resume_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_run app_private.event_runs%rowtype;
begin
  if new.from_status <> 'paused' or new.to_status <> 'live' then
    return new;
  end if;

  select *
  into v_run
  from app_private.event_runs as run
  where run.id = new.run_id
  for update;

  if not found or v_run.paused_at is null then
    return new;
  end if;

  update app_private.event_run_phases as phase
  set
    started_at = case
      when phase.started_at is null then null
      else phase.started_at + (new.occurred_at - v_run.paused_at)
    end,
    state_version = case
      when phase.started_at is null then phase.state_version
      else phase.state_version + 1
    end
  where phase.run_id = new.run_id
    and phase.phase_id = v_run.current_phase_id
    and phase.phase_status = 'live';

  update app_private.event_runs as run
  set
    paused_at = null,
    updated_at = greatest(run.updated_at, new.occurred_at)
  where run.id = new.run_id;

  return new;
end;
$$;

create trigger freeze_event_phase_clock_on_resume_v1
after insert on app_private.event_run_transitions
for each row execute function app_private.freeze_event_phase_clock_on_resume_v1();

create or replace function app_private.recover_event_phase_transition_v1(
  p_run_id uuid,
  p_expected_state_version bigint
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_run app_private.event_runs%rowtype;
  v_current app_private.event_run_phases%rowtype;
  v_next app_private.event_run_phases%rowtype;
  v_definition jsonb;
  v_transition jsonb;
  v_transition_type text;
  v_objective_id text;
  v_objective_status text;
  v_due boolean := false;
  v_now timestamptz := clock_timestamp();
  v_next_version bigint;
begin
  select *
  into v_run
  from app_private.event_runs as run
  where run.id = p_run_id
  for update;

  if not found
    or v_run.run_mode <> 'production'
    or v_run.lifecycle_status <> 'live'
    or v_run.state_version <> p_expected_state_version
    or v_run.current_phase_id is null
  then
    return 'noop';
  end if;

  select *
  into v_current
  from app_private.event_run_phases as phase
  where phase.run_id = p_run_id
    and phase.phase_id = v_run.current_phase_id
  for update;

  if not found or v_current.phase_status <> 'live' then
    return 'noop';
  end if;

  select version.definition
  into v_definition
  from app_private.event_definition_versions as version
  where version.id = v_run.definition_version_id
    and version.event_key = v_run.event_key;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'EVENT_RUN_PINNED_DEFINITION_UNAVAILABLE';
  end if;

  select phase.value -> 'transition'
  into v_transition
  from jsonb_array_elements(v_definition -> 'phases') as phase(value)
  where phase.value ->> 'id' = v_current.phase_id
  limit 1;

  if v_transition is null then
    raise exception using
      errcode = '55000',
      message = 'EVENT_RUN_PINNED_PHASE_UNAVAILABLE';
  end if;

  v_transition_type := v_transition ->> 'type';

  if v_transition_type = 'manual' then
    return 'noop';
  elsif v_transition_type = 'elapsed' then
    if v_current.started_at is not null then
      v_due :=
        extract(epoch from (v_now - v_current.started_at))::numeric
        >= (v_transition ->> 'afterSeconds')::numeric;
    end if;
  elsif v_transition_type = 'scheduled' then
    v_due := (v_transition ->> 'at')::timestamptz <= v_now;
  elsif v_transition_type = 'objective-threshold' then
    v_objective_id := v_transition ->> 'objectiveId';
    select objective.objective_status
    into v_objective_status
    from app_private.event_run_objectives as objective
    where objective.run_id = p_run_id
      and objective.phase_id = v_current.phase_id
      and objective.objective_id = v_objective_id;

    v_due := found and v_objective_status = 'completed';
  else
    raise exception using
      errcode = '55000',
      message = 'EVENT_RUN_PINNED_TRANSITION_INVALID';
  end if;

  if not v_due then
    return 'noop';
  end if;

  select *
  into v_next
  from app_private.event_run_phases as phase
  where phase.run_id = p_run_id
    and phase.ordinal > v_current.ordinal
  order by phase.ordinal
  limit 1
  for update;

  update app_private.event_run_objectives as objective
  set
    objective_status = case
      when objective.objective_status = 'completed' then 'completed'
      else 'failed'
    end,
    state_version = objective.state_version + 1,
    updated_at = v_now
  where objective.run_id = p_run_id
    and objective.phase_id = v_current.phase_id
    and objective.objective_status in ('inactive','active');

  update app_private.event_run_phases as phase
  set
    phase_status = 'completed',
    completed_at = v_now,
    state_version = phase.state_version + 1
  where phase.run_id = p_run_id
    and phase.phase_id = v_current.phase_id;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'EVENT_RECOVERY_PHASE_UPDATE_FAILED';
  end if;

  if v_next.run_id is null then
    perform public.transition_event_run_v1(
      p_run_id,
      p_expected_state_version,
      gen_random_uuid(),
      'resolving',
      'Automatic recovery completed final authored phase'
    );
    return 'resolving';
  end if;

  if v_next.phase_status <> 'pending' then
    raise exception using
      errcode = '55000',
      message = 'EVENT_RECOVERY_NEXT_PHASE_INVALID';
  end if;

  update app_private.event_run_phases as phase
  set
    phase_status = 'live',
    started_at = coalesce(phase.started_at, v_now),
    state_version = phase.state_version + 1
  where phase.run_id = p_run_id
    and phase.phase_id = v_next.phase_id;

  update app_private.event_run_objectives as objective
  set
    objective_status = 'active',
    state_version = objective.state_version + 1,
    updated_at = v_now
  where objective.run_id = p_run_id
    and objective.phase_id = v_next.phase_id
    and objective.objective_status = 'inactive';

  v_next_version := p_expected_state_version + 1;

  update app_private.event_runs as run
  set
    current_phase_id = v_next.phase_id,
    state_version = v_next_version,
    updated_at = v_now
  where run.id = p_run_id;

  insert into app_private.event_run_phase_advances (
    run_id,
    idempotency_key,
    from_phase_id,
    to_phase_id,
    resulting_state_version,
    reason,
    occurred_at
  ) values (
    p_run_id,
    gen_random_uuid(),
    v_current.phase_id,
    v_next.phase_id,
    v_next_version,
    'Automatic recovery applied authored ' || v_transition_type || ' transition',
    v_now
  );

  return 'advanced';
end;
$$;

revoke all on function app_private.recover_event_phase_transition_v1(uuid,bigint)
  from public, anon, authenticated, service_role;

create or replace function app_private.recover_due_event_runs_v1(
  p_limit integer default 50
)
returns table (
  processed_count integer,
  action_count integer,
  error_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_candidate record;
  v_run app_private.event_runs%rowtype;
  v_transition record;
  v_phase_action text;
  v_processed integer := 0;
  v_actions integer := 0;
  v_errors integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using
      errcode = '22023',
      message = 'EVENT_RECOVERY_LIMIT_INVALID';
  end if;

  update app_private.event_recovery_state
  set
    last_started_at = v_now,
    last_error_code = null
  where singleton = true;

  for v_candidate in
    select run.id
    from app_private.event_runs as run
    where run.run_mode = 'production'
      and run.lifecycle_status in ('scheduled','live','paused','resolving')
      and (
        run.lifecycle_status <> 'scheduled'
        or run.scheduled_start_at is null
        or run.scheduled_start_at <= v_now
        or (run.scheduled_end_at is not null and run.scheduled_end_at <= v_now)
      )
    order by coalesce(run.scheduled_start_at, run.created_at), run.id
    limit p_limit
    for update skip locked
  loop
    v_processed := v_processed + 1;

    begin
      select *
      into v_run
      from app_private.event_runs as run
      where run.id = v_candidate.id
      for update;

      if v_run.lifecycle_status = 'scheduled' then
        if v_run.scheduled_end_at is not null
          and v_run.scheduled_end_at <= v_now
        then
          select *
          into v_transition
          from public.transition_event_run_v1(
            v_run.id,
            v_run.state_version,
            gen_random_uuid(),
            'cancelled',
            'Automatic recovery cancelled an expired scheduled run'
          );
          v_actions := v_actions + 1;
        elsif v_run.scheduled_start_at is null
          or v_run.scheduled_start_at <= v_now
        then
          select *
          into v_transition
          from public.transition_event_run_v1(
            v_run.id,
            v_run.state_version,
            gen_random_uuid(),
            'live',
            'Automatic recovery started a due scheduled run'
          );

          update app_private.event_run_phases as phase
          set
            phase_status = 'live',
            started_at = coalesce(phase.started_at, v_now),
            state_version = phase.state_version + 1
          where phase.run_id = v_run.id
            and phase.phase_id = v_run.current_phase_id
            and phase.phase_status = 'pending';

          if not found then
            raise exception using
              errcode = '55000',
              message = 'EVENT_RECOVERY_CURRENT_PHASE_NOT_PENDING';
          end if;

          update app_private.event_run_objectives as objective
          set
            objective_status = 'active',
            state_version = objective.state_version + 1,
            updated_at = v_now
          where objective.run_id = v_run.id
            and objective.phase_id = v_run.current_phase_id
            and objective.objective_status = 'inactive';

          v_actions := v_actions + 1;
        end if;
      elsif v_run.lifecycle_status = 'live' then
        if v_run.scheduled_end_at is not null
          and v_run.scheduled_end_at <= v_now
        then
          select *
          into v_transition
          from public.transition_event_run_v1(
            v_run.id,
            v_run.state_version,
            gen_random_uuid(),
            'resolving',
            'Automatic recovery reached the scheduled run end'
          );
          v_actions := v_actions + 1;
        else
          v_phase_action := app_private.recover_event_phase_transition_v1(
            v_run.id,
            v_run.state_version
          );
          if v_phase_action <> 'noop' then
            v_actions := v_actions + 1;
          end if;
        end if;
      end if;
    exception
      when others then
        v_errors := v_errors + 1;
        update app_private.event_recovery_state
        set
          last_error_at = clock_timestamp(),
          last_error_code = sqlstate
        where singleton = true;
        raise warning 'Event recovery failed for run % with SQLSTATE %', v_candidate.id, sqlstate;
    end;
  end loop;

  update app_private.event_recovery_state
  set
    last_completed_at = clock_timestamp(),
    last_processed_count = v_processed,
    last_action_count = v_actions,
    last_error_count = v_errors
  where singleton = true;

  return query select v_processed, v_actions, v_errors;
end;
$$;

revoke all on function app_private.recover_due_event_runs_v1(integer)
  from public, anon, authenticated, service_role;

create or replace function app_private.configure_event_recovery_cron_v1(
  p_enabled boolean
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, cron
as $$
declare
  v_job_id bigint;
  v_existing record;
begin
  for v_existing in
    select jobid
    from cron.job
    where jobname = 'aurevane-event-recovery-v1'
  loop
    perform cron.unschedule(v_existing.jobid);
  end loop;

  if not p_enabled then
    return null;
  end if;

  select cron.schedule(
    'aurevane-event-recovery-v1',
    '* * * * *',
    'select app_private.recover_due_event_runs_v1(50);'
  )
  into v_job_id;

  return v_job_id;
end;
$$;

revoke all on function app_private.configure_event_recovery_cron_v1(boolean)
  from public, anon, authenticated, service_role;

comment on function app_private.recover_due_event_runs_v1(integer) is
  'Bounded server-owned recovery pass for due scheduled/live persistent Event Runs. Intended for Supabase Cron and deterministic manual verification.';
comment on function app_private.configure_event_recovery_cron_v1(boolean) is
  'Release-only cron configuration helper. The migration does not activate the Production recovery job automatically.';

commit;
