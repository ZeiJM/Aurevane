begin;

create function public.jsonb_object_length(p_value jsonb)
returns integer
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select count(*)::integer
  from pg_catalog.jsonb_object_keys(p_value);
$$;

comment on function public.jsonb_object_length(jsonb) is
  'Temporary migration-only compatibility helper. Removed immediately after the Primary Core profile constraint is hardened.';

revoke all on function public.jsonb_object_length(jsonb) from public;
revoke all on function public.jsonb_object_length(jsonb) from anon;
revoke all on function public.jsonb_object_length(jsonb) from authenticated;
grant execute on function public.jsonb_object_length(jsonb) to service_role;

commit;
