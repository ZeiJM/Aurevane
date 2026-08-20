begin;

create or replace function public.materialize_training_report_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  report_id uuid,
  character_id uuid,
  user_id uuid,
  focus text,
  config_version integer,
  window_started_at timestamptz,
  window_ended_at timestamptz,
  elapsed_seconds bigint,
  credited_direct_seconds bigint,
  full_rate_seconds bigint,
  reduced_rate_seconds bigint,
  requested_character_xp bigint,
  direct_xp_cap_reached boolean,
  rested_momentum_seconds bigint,
  rested_momentum_gain integer,
  rested_momentum_cap_reached boolean,
  status text,
  created_at timestamptz,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  return query
  select
    report.report_id,
    report.character_id,
    report.user_id,
    report.focus,
    report.config_version,
    report.window_started_at,
    report.window_ended_at,
    report.elapsed_seconds,
    report.credited_direct_seconds,
    report.full_rate_seconds,
    report.reduced_rate_seconds,
    report.requested_character_xp,
    report.direct_xp_cap_reached,
    report.rested_momentum_seconds,
    report.rested_momentum_gain,
    report.rested_momentum_cap_reached,
    report.status,
    report.created_at,
    report.claimed_at
  from public.materialize_training_report_v2(p_user_id, p_character_id) report;
end;
$$;

comment on function public.materialize_training_report_v1(uuid, uuid) is
  'Backward-compatible P1.6 Training Report projection. Delegates authoritative materialization to v2 so legacy callers preserve frozen-report, planned-window, and one-absence semantics while receiving the original v1 result shape.';

revoke all on function public.materialize_training_report_v1(uuid, uuid) from public;
revoke all on function public.materialize_training_report_v1(uuid, uuid) from anon;
revoke all on function public.materialize_training_report_v1(uuid, uuid) from authenticated;
grant execute on function public.materialize_training_report_v1(uuid, uuid) to service_role;

commit;
