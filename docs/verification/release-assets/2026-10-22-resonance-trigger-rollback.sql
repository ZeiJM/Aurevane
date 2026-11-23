-- Atomic pointer rollback for exactly 13 Resonance trigger repairs.
-- Preserve immutable history; release token must be refreshed immediately prior to rollback.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
select app_private.lock_combat_content_catalogue_v1('__EXPECTED_CATALOGUE_TOKEN__');
do $trigger_rollback$
declare
  rows jsonb := $rollback_data$[{"id":"resonance.bastion-vanguard.linked-sequence","beforeVersion":8,"afterVersion":9},{"id":"resonance.chronist-ironfist.linked-sequence","beforeVersion":11,"afterVersion":12},{"id":"resonance.cinderweaver-ravager.linked-sequence","beforeVersion":11,"afterVersion":12},{"id":"resonance.edgedancer-ironfist.linked-sequence","beforeVersion":8,"afterVersion":9},{"id":"resonance.edgedancer-shadehand.linked-sequence","beforeVersion":10,"afterVersion":11},{"id":"resonance.edgedancer-vanguard.linked-sequence","beforeVersion":10,"afterVersion":11},{"id":"resonance.frostweaver-ravager.linked-sequence","beforeVersion":11,"afterVersion":12},{"id":"resonance.ironfist-ravager.linked-sequence","beforeVersion":11,"afterVersion":12},{"id":"resonance.ironfist-shadehand.broken-rhythm","beforeVersion":10,"afterVersion":11},{"id":"resonance.ravager-shadehand.linked-sequence","beforeVersion":11,"afterVersion":12},{"id":"resonance.ravager-stormsinger.linked-sequence","beforeVersion":11,"afterVersion":12},{"id":"resonance.shadehand-stormsinger.linked-sequence","beforeVersion":11,"afterVersion":12},{"id":"resonance.shadehand-vanguard.broken-line","beforeVersion":10,"afterVersion":11}]$rollback_data$::jsonb;
  entry jsonb;
  actor uuid;
  current_version int;
begin
  if jsonb_array_length(rows) <> 13
      or (select count(*) from app_private.combat_content_versions) <> 1110
      or (select count(*) from app_private.combat_content_publications) <> 294
      or (select count(*) from app_private.combat_content_publications where content_kind='resonance') <> 136
      or exists(select 1 from app_private.combat_content_drafts)
  then raise exception 'RESONANCE_TRIGGER_ROLLBACK_INVENTORY_CHANGED'; end if;
  if (select count(*) from app_private.master_panel_role_assignments where role='game-owner' and enabled) <> 1
  then raise exception 'RESONANCE_TRIGGER_ROLLBACK_OWNER_UNVERIFIED'; end if;
  select user_id into actor from app_private.master_panel_role_assignments
    where role='game-owner' and enabled limit 1;
  perform app_private.assert_game_owner_v1(actor);
  for entry in select value from jsonb_array_elements(rows) loop
    select v.content_version into current_version
    from app_private.combat_content_publications p
    join app_private.combat_content_versions v on v.id=p.version_id
    where p.content_key=entry->>'id' and p.content_kind='resonance';
    if current_version is distinct from (entry->>'afterVersion')::int
    then raise exception 'RESONANCE_TRIGGER_ROLLBACK_SOURCE_CHANGED: %',entry->>'id'; end if;
    if not exists(
      select 1 from app_private.combat_content_versions v
      where v.content_key=entry->>'id' and v.content_kind='resonance'
      and v.content_version=(entry->>'beforeVersion')::int
    ) then raise exception 'RESONANCE_TRIGGER_ROLLBACK_BEFORE_MISSING: %',entry->>'id'; end if;
  end loop;
  for entry in select value from jsonb_array_elements(rows) loop
    perform public.set_combat_content_publication_v1(actor,entry->>'id','resonance',(entry->>'beforeVersion')::int);
  end loop;
  if exists(
    select 1 from jsonb_array_elements(rows) verify_entry
    join app_private.combat_content_publications p on p.content_key=verify_entry->>'id'
    join app_private.combat_content_versions v on v.id=p.version_id
    where v.content_version is distinct from (verify_entry->>'beforeVersion')::int
  ) then raise exception 'RESONANCE_TRIGGER_ROLLBACK_READBACK_FAILED'; end if;
end
$trigger_rollback$;
commit;
