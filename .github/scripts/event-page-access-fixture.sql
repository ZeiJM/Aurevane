-- Disposable local fixture. Every change uses the real protected Owner API.
do $event_page_access$
declare
  owner_id uuid := current_setting('event_fixture.owner')::uuid;
  defaults jsonb;
  pages jsonb;
  restored_pages text := current_setting('event_fixture.restore_pages',true);
begin
  defaults := public.read_master_panel_role_defaults_v1(owner_id);
  pages := defaults->'roles'->'event-staff';
  if restored_pages is not null and restored_pages<>'' then
    pages := restored_pages::jsonb;
  elsif current_setting('event_fixture.enabled')::boolean then
    if not pages ? 'events' then pages := pages || '["events"]'::jsonb; end if;
  else
    select coalesce(jsonb_agg(page),'[]'::jsonb) into pages
    from jsonb_array_elements(pages) page where page<>'"events"'::jsonb;
  end if;
  perform public.save_master_panel_role_defaults_v1(owner_id,(defaults->>'revision')::bigint,
    jsonb_set(defaults->'roles','{event-staff}',pages));
end;
$event_page_access$;
