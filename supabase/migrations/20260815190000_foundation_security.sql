begin;

-- Privileged implementation details belong outside the browser-exposed public schema.
create schema if not exists app_private;
comment on schema app_private is
  'Server-only AUREVANE database objects. Browser roles must not receive access.';

revoke all on schema app_private from public;
revoke all on schema app_private from anon;
revoke all on schema app_private from authenticated;
grant usage on schema app_private to service_role;

-- F0.2 deliberately creates no public application tables. Future migrations that
-- add browser-exposed tables must enable RLS in the same migration and grant only
-- the minimum privileges required for their explicit policy model.

commit;
