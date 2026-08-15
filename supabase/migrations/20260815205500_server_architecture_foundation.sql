begin;

create table app_private.idempotency_records (
  actor_key text not null check (char_length(actor_key) between 1 and 160),
  command_name text not null check (char_length(command_name) between 1 and 160),
  idempotency_key uuid not null,
  request_fingerprint text not null check (char_length(request_fingerprint) between 1 and 160),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_key, command_name, idempotency_key)
);

comment on table app_private.idempotency_records is
  'Durable retry protection for authoritative server commands. Browser roles have no direct access.';

revoke all on table app_private.idempotency_records from public;
revoke all on table app_private.idempotency_records from anon;
revoke all on table app_private.idempotency_records from authenticated;

create or replace function public.execute_foundation_authority_probe(
  p_actor_key text,
  p_idempotency_key uuid,
  p_request_fingerprint text
)
returns table (
  receipt_id uuid,
  accepted_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_command_name constant text := 'foundation.authority_probe';
  v_receipt_id uuid := gen_random_uuid();
  v_accepted_at timestamptz := clock_timestamp();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
begin
  insert into app_private.idempotency_records (
    actor_key,
    command_name,
    idempotency_key,
    request_fingerprint,
    result
  )
  values (
    p_actor_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object(
      'receipt_id', v_receipt_id,
      'accepted_at', v_accepted_at
    )
  )
  on conflict (actor_key, command_name, idempotency_key) do nothing;

  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 1 then
    return query select v_receipt_id, v_accepted_at, false;
    return;
  end if;

  select *
  into v_existing
  from app_private.idempotency_records
  where actor_key = p_actor_key
    and command_name = v_command_name
    and idempotency_key = p_idempotency_key;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'idempotency record unavailable after conflict';
  end if;

  if v_existing.request_fingerprint <> p_request_fingerprint then
    raise exception using
      errcode = '22023',
      message = 'idempotency key reused with a different request fingerprint';
  end if;

  return query
  select
    (v_existing.result ->> 'receipt_id')::uuid,
    (v_existing.result ->> 'accepted_at')::timestamptz,
    true;
end;
$$;

comment on function public.execute_foundation_authority_probe(text, uuid, text) is
  'F0.3 non-game command proving an atomic, idempotent server-authoritative persistence boundary.';

revoke all on function public.execute_foundation_authority_probe(text, uuid, text) from public;
revoke all on function public.execute_foundation_authority_probe(text, uuid, text) from anon;
revoke all on function public.execute_foundation_authority_probe(text, uuid, text) from authenticated;
grant execute on function public.execute_foundation_authority_probe(text, uuid, text) to service_role;

commit;
