-- PREPARED ROLLBACK for 2026-10-22 Resonance quality publication (72 pointers).
-- Only use after publication; leave every immutable historical definition untouched.
-- Fill __EXPECTED_CATALOGUE_TOKEN__ with a fresh current token from public catalogue.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';
select app_private.lock_combat_content_catalogue_v1('__EXPECTED_CATALOGUE_TOKEN__');
do $quality_rollback$
declare
  rows jsonb := $rollback_data$[{"id":"resonance.aetherist-shadehand.veiled-conduit","priorVersion":9,"newVersion":10},{"id":"resonance.bastion-tidecaller.linked-sequence","priorVersion":10,"newVersion":11},{"id":"resonance.chronist-farstrider.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.chronist-frostweaver.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.chronist-ironfist.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.chronist-runeblade.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.chronist-stormsinger.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.chronist-tidecaller.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.chronist-vanguard.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.chronist-wildwarden.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.cinderweaver-dawnshield.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.cinderweaver-farstrider.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.cinderweaver-frostweaver.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.cinderweaver-ironfist.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.cinderweaver-lifebinder.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.cinderweaver-ravager.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.cinderweaver-stormsinger.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.cinderweaver-tidecaller.linked-sequence","priorVersion":10,"newVersion":11},{"id":"resonance.cinderweaver-vanguard.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.cinderweaver-wildwarden.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.dawnshield-frostweaver.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.dawnshield-lifebinder.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.dawnshield-shadehand.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.dawnshield-stormsinger.linked-sequence","priorVersion":10,"newVersion":11},{"id":"resonance.dawnshield-tidecaller.linked-sequence","priorVersion":10,"newVersion":11},{"id":"resonance.edgedancer-frostweaver.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.edgedancer-lifebinder.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.edgedancer-runeblade.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.edgedancer-shadehand.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.edgedancer-stormsinger.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.edgedancer-tidecaller.linked-sequence","priorVersion":10,"newVersion":11},{"id":"resonance.edgedancer-vanguard.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.edgedancer-wildwarden.linked-sequence","priorVersion":10,"newVersion":11},{"id":"resonance.farstrider-frostweaver.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.farstrider-ravager.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.farstrider-stormsinger.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.farstrider-tidecaller.linked-sequence","priorVersion":10,"newVersion":11},{"id":"resonance.farstrider-vanguard.covering-break","priorVersion":9,"newVersion":10},{"id":"resonance.farstrider-wildwarden.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.frostweaver-ironfist.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.frostweaver-ravager.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.frostweaver-runeblade.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.frostweaver-shadehand.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.frostweaver-stormsinger.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.frostweaver-tidecaller.linked-sequence","priorVersion":10,"newVersion":11},{"id":"resonance.frostweaver-wildwarden.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.ironfist-ravager.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.ironfist-runeblade.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.ironfist-shadehand.broken-rhythm","priorVersion":8,"newVersion":9},{"id":"resonance.ironfist-tidecaller.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.ironfist-vanguard.tempered-response","priorVersion":9,"newVersion":10},{"id":"resonance.lifebinder-shadehand.mercy-in-shadow","priorVersion":9,"newVersion":10},{"id":"resonance.lifebinder-stormsinger.linked-sequence","priorVersion":10,"newVersion":11},{"id":"resonance.ravager-shadehand.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.ravager-stormsinger.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.ravager-tidecaller.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.ravager-vanguard.linked-sequence","priorVersion":10,"newVersion":11},{"id":"resonance.ravager-wildwarden.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.runeblade-shadehand.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.runeblade-stormsinger.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.runeblade-tidecaller.linked-sequence","priorVersion":10,"newVersion":11},{"id":"resonance.runeblade-vanguard.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.runeblade-wildwarden.linked-sequence","priorVersion":8,"newVersion":9},{"id":"resonance.shadehand-stormsinger.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.shadehand-tidecaller.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.shadehand-vanguard.broken-line","priorVersion":8,"newVersion":9},{"id":"resonance.shadehand-wildwarden.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.stormsinger-tidecaller.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.stormsinger-vanguard.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.stormsinger-wildwarden.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.tidecaller-vanguard.linked-sequence","priorVersion":9,"newVersion":10},{"id":"resonance.tidecaller-wildwarden.linked-sequence","priorVersion":9,"newVersion":10}]$rollback_data$::jsonb;
  row jsonb;
  actor uuid;
  receipt record;
begin
  if (select count(*) from app_private.master_panel_role_assignments where role='game-owner' and enabled) <> 1
    or (select count(*) from app_private.combat_content_versions) <> 1025
    or (select count(*) from app_private.combat_content_publications) <> 294
    or (select count(*) from app_private.combat_content_publications where content_kind='resonance') <> 136
    or exists(select 1 from app_private.combat_content_drafts)
  then raise exception 'RESONANCE_ROLLBACK_INVENTORY_CHANGED'; end if;
  select user_id into actor from app_private.master_panel_role_assignments
    where role='game-owner' and enabled limit 1;
  perform app_private.assert_game_owner_v1(actor);
  for row in select value from jsonb_array_elements(rows) loop
    if not exists (
      select 1 from app_private.combat_content_publications p
      join app_private.combat_content_versions v on v.id=p.version_id
      where p.content_kind='resonance' and p.content_key=row->>'id'
      and v.content_version=(row->>'newVersion')::int
    ) or not exists (
      select 1 from app_private.combat_content_versions v
      where v.content_key=row->>'id' and v.content_kind='resonance'
      and v.content_version=(row->>'priorVersion')::int
    ) then raise exception 'RESONANCE_ROLLBACK_SOURCE_CHANGED: %', row->>'id'; end if;
  end loop;
  for row in select value from jsonb_array_elements(rows) loop
    perform public.set_combat_content_publication_v2(
      actor,row->>'id','resonance',(row->>'priorVersion')::int,
      public.read_combat_content_catalogue_v1()->>'token'
    );
  end loop;
  if exists(
    select 1 from jsonb_array_elements(rows) row
    join app_private.combat_content_publications p on p.content_key=row->>'id'
    join app_private.combat_content_versions v on v.id=p.version_id
    where v.content_version is distinct from (row->>'priorVersion')::int
  ) then raise exception 'RESONANCE_ROLLBACK_READBACK_FAILED'; end if;
end
$quality_rollback$;
commit;
