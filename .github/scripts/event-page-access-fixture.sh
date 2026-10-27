#!/usr/bin/env bash
# Sourced by disposable local native Event gates; never a hosted mutation path.
event_page_fixture_sql="$(cat "$(dirname "${BASH_SOURCE[0]}")/event-page-access-fixture.sql")"
set_event_page_access() {
  local enabled="$1"
  case "$enabled" in true|false) ;; *) echo 'Expected an Events page boolean.' >&2; return 1 ;; esac
  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
    begin;
    select set_config('event_fixture.owner','$owner_id',true),set_config('event_fixture.enabled','$enabled',true);
    set local role service_role;
    $event_page_fixture_sql
    commit;
  " >/dev/null
}
