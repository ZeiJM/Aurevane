begin;

-- P4.13 closes the original kernel bootstrap grants. After the Event Builder
-- exists, service_role reads projections and invokes guarded RPCs; it does not
-- publish definitions or mutate run/phase/objective state directly.
revoke insert on table app_private.event_templates from service_role;
revoke insert on table app_private.event_definition_versions from service_role;
revoke insert, update on table app_private.event_publications from service_role;
revoke insert on table app_private.event_runs from service_role;
revoke insert, update on table app_private.event_run_phases from service_role;
revoke insert, update on table app_private.event_run_objectives from service_role;

comment on table app_private.event_templates is
  'Private Event identity catalog. Writes occur only inside protected Event authoring RPCs.';
comment on table app_private.event_publications is
  'Current immutable Event Definition pointer. Writes occur only inside protected Event publication RPCs.';
comment on table app_private.event_run_phases is
  'Authoritative Event phase state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';
comment on table app_private.event_run_objectives is
  'Authoritative Event objective state. Writes occur only inside protected scheduling/contribution/lifecycle operations.';

commit;
