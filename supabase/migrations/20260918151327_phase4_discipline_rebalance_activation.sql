begin;

-- PREPARE ONLY. Applying this migration never changes the current Skill catalog,
-- learned/equipped versions, enabled Essence version, saved loadout source JSON,
-- or any frozen battle snapshot. Activation is a separate service-role RPC that
-- must run only after the matching application build is READY.
create table app_private.phase4_discipline_rebalance_publication (
  release_id text primary key check (release_id = 'phase4-discipline-rebalance-v1'),
  activated_at timestamptz,
  result jsonb
);

create table app_private.phase4_discipline_rebalance_skill_versions (
  skill_id text primary key,
  previous_version integer not null check (previous_version > 0),
  content_version integer not null check (content_version = previous_version + 1)
);

alter table app_private.phase4_discipline_rebalance_publication enable row level security;
alter table app_private.phase4_discipline_rebalance_skill_versions enable row level security;

revoke all on table
  app_private.phase4_discipline_rebalance_publication,
  app_private.phase4_discipline_rebalance_skill_versions
from public, anon, authenticated, service_role;

grant select on table
  app_private.phase4_discipline_rebalance_publication,
  app_private.phase4_discipline_rebalance_skill_versions
to service_role;

insert into app_private.phase4_discipline_rebalance_publication(release_id)
values ('phase4-discipline-rebalance-v1');

-- Stage affected Essence versions disabled. They become current only in the same
-- activation transaction as the regular-Skill catalog upgrade.
insert into app_private.essence_definitions (
  essence_id,
  content_version,
  source_discipline_id,
  skill_id,
  skill_content_version,
  name,
  description,
  enabled
) values
  (
    'essence.chronist.borrowed-hour',
    2,
    'chronist',
    'essence.chronist.borrowed-hour',
    2,
    'Borrowed Hour',
    'Restore an ally over two applications and grant movement Haste. No extra turn, AP or battle reset.',
    false
  ),
  (
    'essence.ravager.red-tempest',
    2,
    'ravager',
    'essence.ravager.red-tempest',
    2,
    'Red Tempest',
    'Strike nearby enemies and open bleeding wounds. Spacing limits the sweep.',
    false
  ),
  (
    'essence.cinderweaver.phoenix-wake',
    2,
    'cinderweaver',
    'essence.cinderweaver.phoenix-wake',
    2,
    'Phoenix Wake',
    'Burn enemies in an immediate fiery burst. Spread out to limit its impact.',
    false
  ),
  (
    'essence.tidecaller.tidal-crown',
    2,
    'tidecaller',
    'essence.tidecaller.tidal-crown',
    2,
    'Tidal Crown',
    'Cleanse and restore allies in a small area, then continue restoring them over time.',
    false
  );

-- Service-role-only release command. It refuses to run unless the earlier
-- Phase-4 interaction release is already active, then snapshots the exact
-- 136-row current catalog and advances every regular Skill by one immutable
-- version. Old battle snapshots and saved-loadout source JSON are not rewritten.
create function public.activate_phase4_discipline_rebalance_v1()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_release app_private.phase4_discipline_rebalance_publication%rowtype;
  v_build app_private.character_active_builds%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_unlock_count integer;
  v_build_count integer := 0;
  v_mapping_count integer;
  v_essence_count integer;
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
begin
  select *
  into strict v_release
  from app_private.phase4_discipline_rebalance_publication
  where release_id = 'phase4-discipline-rebalance-v1'
  for update;

  if v_release.activated_at is not null then
    return v_release.result || jsonb_build_object('replayed', true);
  end if;

  if not exists (
    select 1
    from app_private.phase4_combat_publication publication
    where publication.release_id = 'phase4-combat-interactions-v2'
      and publication.activated_at is not null
  ) then
    raise exception using
      errcode = '22023',
      message = 'PHASE4_DISCIPLINE_REBALANCE_PREREQUISITE_NOT_ACTIVATED';
  end if;

  -- Preserve the proven publication lock order. Ordinary readers remain
  -- available while build/loadout writers serialize with this release.
  lock table app_private.character_active_builds in exclusive mode;

  begin
    lock table auth.users, public.characters in row share mode nowait;

    perform parent.id
    from auth.users parent
    where exists (
      select 1
      from app_private.character_active_builds build
      join app_private.character_build_discipline_skills selected
        on selected.character_id = build.character_id
      join app_private.phase4_skill_catalog catalog
        on catalog.skill_id = selected.skill_id
      where build.user_id = parent.id
    )
    order by parent.id
    for key share of parent nowait;

    perform parent.id
    from public.characters parent
    where exists (
      select 1
      from app_private.character_active_builds build
      join app_private.character_build_discipline_skills selected
        on selected.character_id = build.character_id
      join app_private.phase4_skill_catalog catalog
        on catalog.skill_id = selected.skill_id
      where build.character_id = parent.id
    )
    order by parent.id
    for key share of parent nowait;

    lock table app_private.character_skill_unlocks in share row exclusive mode nowait;
    lock table app_private.character_build_discipline_skills in share row exclusive mode nowait;
    lock table app_private.phase4_skill_catalog in share row exclusive mode nowait;
    lock table app_private.essence_definitions in share row exclusive mode nowait;
  exception
    when lock_not_available then
      raise exception using
        errcode = '55P03',
        message = 'PHASE4_DISCIPLINE_REBALANCE_BUSY',
        hint = 'Retry the same activation RPC after the competing transaction completes.';
  end;

  -- Exact expected base after phase4-combat-interactions-v2:
  -- 136 regular Skills, 17 eight-Skill rosters, 115 at v1 and 21 at v2.
  if (select count(*) from app_private.phase4_skill_catalog) <> 136
     or (select count(distinct discipline_id) from app_private.phase4_skill_catalog) <> 17
     or exists (
       select discipline_id
       from app_private.phase4_skill_catalog
       group by discipline_id
       having count(*) <> 8
     )
     or (select count(*) from app_private.phase4_skill_catalog where content_version = 1) <> 115
     or (select count(*) from app_private.phase4_skill_catalog where content_version = 2) <> 21
     or exists (
       select 1
       from app_private.phase4_skill_catalog
       where content_version not in (1, 2)
     )
     or not exists (
       select 1
       from app_private.phase4_skill_catalog
       where skill_id = 'vanguard.forceful-strike'
         and content_version = 2
     )
     or exists (
       select 1
       from app_private.phase4_combat_skill_versions previous_release
       left join app_private.phase4_skill_catalog catalog
         on catalog.skill_id = previous_release.skill_id
       where catalog.skill_id is null
          or catalog.content_version <> previous_release.content_version
     )
     or exists (
       select 1
       from app_private.phase4_discipline_rebalance_skill_versions
     )
  then
    raise exception using
      errcode = '22023',
      message = 'PHASE4_DISCIPLINE_REBALANCE_CATALOG_MISMATCH';
  end if;

  insert into app_private.phase4_discipline_rebalance_skill_versions (
    skill_id,
    previous_version,
    content_version
  )
  select
    catalog.skill_id,
    catalog.content_version,
    catalog.content_version + 1
  from app_private.phase4_skill_catalog catalog
  order by catalog.skill_id;

  get diagnostics v_mapping_count = row_count;
  if v_mapping_count <> 136 then
    raise exception using
      errcode = '22023',
      message = 'PHASE4_DISCIPLINE_REBALANCE_MANIFEST_MISMATCH';
  end if;

  if (
    select count(*)
    from app_private.essence_definitions definition
    where definition.content_version = 2
      and definition.enabled = false
      and (definition.essence_id, definition.source_discipline_id, definition.skill_content_version) in (
        ('essence.chronist.borrowed-hour', 'chronist', 2),
        ('essence.ravager.red-tempest', 'ravager', 2),
        ('essence.cinderweaver.phoenix-wake', 'cinderweaver', 2),
        ('essence.tidecaller.tidal-crown', 'tidecaller', 2)
      )
  ) <> 4 then
    raise exception using
      errcode = '22023',
      message = 'PHASE4_DISCIPLINE_REBALANCE_ESSENCE_MISMATCH';
  end if;

  -- Learned/equipped current facts must exactly match the pre-release catalog.
  -- Saved loadouts are historical source JSON and are deliberately excluded.
  if exists (
    select 1
    from app_private.character_skill_unlocks learned
    join app_private.phase4_discipline_rebalance_skill_versions release
      using (skill_id)
    where learned.skill_content_version <> release.previous_version
  ) or exists (
    select 1
    from app_private.character_build_discipline_skills selected
    join app_private.phase4_discipline_rebalance_skill_versions release
      using (skill_id)
    where selected.skill_content_version <> release.previous_version
  ) then
    raise exception using
      errcode = '22023',
      message = 'PHASE4_DISCIPLINE_REBALANCE_CHARACTER_VERSION_MISMATCH';
  end if;

  update app_private.character_skill_unlocks learned
  set skill_content_version = release.content_version
  from app_private.phase4_discipline_rebalance_skill_versions release
  where learned.skill_id = release.skill_id
    and learned.skill_content_version = release.previous_version;

  get diagnostics v_unlock_count = row_count;

  for v_build in
    select build.*
    from app_private.character_active_builds build
    where exists (
      select 1
      from app_private.character_build_discipline_skills selected
      join app_private.phase4_discipline_rebalance_skill_versions release
        using (skill_id)
      where selected.character_id = build.character_id
        and selected.skill_content_version = release.previous_version
    )
    order by build.character_id
  loop
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'skillId', skill_id,
          'contentVersion', skill_content_version,
          'sourceDisciplineId', source_discipline_id
        )
        order by slot_index
      ),
      '[]'::jsonb
    )
    into v_before
    from app_private.character_build_discipline_skills
    where character_id = v_build.character_id;

    update app_private.character_build_discipline_skills selected
    set skill_content_version = release.content_version
    from app_private.phase4_discipline_rebalance_skill_versions release
    where selected.character_id = v_build.character_id
      and selected.skill_id = release.skill_id
      and selected.skill_content_version = release.previous_version;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'skillId', skill_id,
          'contentVersion', skill_content_version,
          'sourceDisciplineId', source_discipline_id
        )
        order by slot_index
      ),
      '[]'::jsonb
    )
    into v_after
    from app_private.character_build_discipline_skills
    where character_id = v_build.character_id;

    update app_private.character_active_builds
    set build_version = build_version + 1,
        updated_at = v_now
    where character_id = v_build.character_id;

    insert into app_private.character_skill_loadout_change_audit (
      id,
      character_id,
      user_id,
      build_version_before,
      build_version_after,
      primary_discipline_id,
      secondary_discipline_id,
      before_skills,
      after_skills,
      request_fingerprint,
      changed_at
    ) values (
      gen_random_uuid(),
      v_build.character_id,
      v_build.user_id,
      v_build.build_version,
      v_build.build_version + 1,
      v_build.primary_discipline_id,
      v_build.secondary_discipline_id,
      v_before,
      v_after,
      'publication:phase4-discipline-rebalance-v1',
      v_now
    );

    v_build_count := v_build_count + 1;
  end loop;

  update app_private.phase4_skill_catalog catalog
  set content_version = release.content_version
  from app_private.phase4_discipline_rebalance_skill_versions release
  where catalog.skill_id = release.skill_id
    and catalog.content_version = release.previous_version;

  update app_private.essence_definitions definition
  set enabled = true
  where definition.content_version = 2
    and definition.enabled = false
    and definition.essence_id in (
      'essence.chronist.borrowed-hour',
      'essence.ravager.red-tempest',
      'essence.cinderweaver.phoenix-wake',
      'essence.tidecaller.tidal-crown'
    );

  get diagnostics v_essence_count = row_count;
  if v_essence_count <> 4 then
    raise exception using
      errcode = '22023',
      message = 'PHASE4_DISCIPLINE_REBALANCE_ESSENCE_ACTIVATION_MISMATCH';
  end if;

  v_result := jsonb_build_object(
    'releaseId', 'phase4-discipline-rebalance-v1',
    'activatedAt', v_now,
    'updatedUnlocks', v_unlock_count,
    'updatedBuilds', v_build_count,
    'updatedCatalogSkills', v_mapping_count,
    'enabledEssences', v_essence_count,
    'replayed', false
  );

  update app_private.phase4_discipline_rebalance_publication
  set activated_at = v_now,
      result = v_result
  where release_id = 'phase4-discipline-rebalance-v1';

  return v_result;
end;
$$;

revoke all on function public.activate_phase4_discipline_rebalance_v1()
  from public, anon, authenticated, service_role;
grant execute on function public.activate_phase4_discipline_rebalance_v1()
  to service_role;

comment on function public.activate_phase4_discipline_rebalance_v1() is
  'Activate the immutable 136-Skill Phase-4 Discipline rebalance only after the matching application is READY. Service-role-only, idempotent, and never rewrites frozen battles or saved-loadout source history.';

-- Saved loadouts remain immutable historical JSON. When a historical loadout is
-- activated after the full rebalance, normalize its regular Skill references to
-- the current catalog in local memory only. Before this release activates, keep
-- the previous exact v1->v2 normalization behavior.
create or replace function public.activate_character_build_loadout_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_slot_index smallint,
  p_expected_build_version bigint,
  p_idempotency_key uuid,
  p_request_fingerprint text
)
returns table (
  build_version bigint,
  replayed boolean,
  activated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_build app_private.character_active_builds%rowtype;
  v_loadout app_private.character_saved_build_loadouts%rowtype;
  v_existing app_private.character_saved_build_loadout_activation_idempotency%rowtype;
  v_change_primary boolean;
  v_change_secondary boolean;
  v_current_skills jsonb;
  v_after_version bigint;
  v_now timestamptz := clock_timestamp();
  v_disc_fingerprint text;
  v_skill_fingerprint text;
begin
  if p_slot_index is null or p_slot_index not between 1 and 8 then
    raise exception using errcode = '22023', message = 'SAVED_BUILD_LOADOUT_SLOT_INVALID';
  end if;
  if p_expected_build_version is null or p_expected_build_version < 1 then
    raise exception using errcode = '22023', message = 'CHARACTER_BUILD_VERSION_INVALID';
  end if;
  if p_request_fingerprint is null or char_length(p_request_fingerprint) not between 8 and 160 then
    raise exception using errcode = '22023', message = 'SAVED_BUILD_LOADOUT_FINGERPRINT_INVALID';
  end if;

  select *
  into v_build
  from app_private.character_active_builds build
  where build.user_id = p_user_id
    and build.character_id = p_character_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_NOT_FOUND';
  end if;

  select *
  into v_existing
  from app_private.character_saved_build_loadout_activation_idempotency idempotency
  where idempotency.character_id = p_character_id
    and idempotency.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = 'P0001', message = 'SAVED_BUILD_LOADOUT_IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_existing.build_version_after, true, v_existing.activated_at;
    return;
  end if;

  if v_build.build_version <> p_expected_build_version then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_VERSION_CONFLICT';
  end if;

  select *
  into v_loadout
  from app_private.character_saved_build_loadouts loadout
  where loadout.character_id = p_character_id
    and loadout.slot_index = p_slot_index;

  if not found then
    raise exception using errcode = 'P0001', message = 'SAVED_BUILD_LOADOUT_NOT_FOUND';
  end if;

  if exists (
    select 1
    from app_private.phase4_discipline_rebalance_publication publication
    where publication.activated_at is not null
  ) then
    select coalesce(
      jsonb_agg(
        case
          when catalog.skill_id is not null then
            selected.element || jsonb_build_object('contentVersion', catalog.content_version)
          else selected.element
        end
        order by selected.ordinality
      ),
      '[]'::jsonb
    )
    into v_loadout.discipline_skills
    from jsonb_array_elements(v_loadout.discipline_skills)
      with ordinality as selected(element, ordinality)
    left join app_private.phase4_skill_catalog catalog
      on catalog.skill_id = selected.element ->> 'skillId';
  elsif exists (
    select 1
    from app_private.phase4_combat_publication publication
    where publication.activated_at is not null
  ) then
    select coalesce(
      jsonb_agg(
        case
          when release.skill_id is not null then
            selected.element || jsonb_build_object('contentVersion', release.content_version)
          else selected.element
        end
        order by selected.ordinality
      ),
      '[]'::jsonb
    )
    into v_loadout.discipline_skills
    from jsonb_array_elements(v_loadout.discipline_skills)
      with ordinality as selected(element, ordinality)
    left join app_private.phase4_combat_skill_versions release
      on release.skill_id = selected.element ->> 'skillId'
      and release.previous_version = (selected.element ->> 'contentVersion')::integer;
  end if;

  v_change_primary :=
    v_build.primary_discipline_id is distinct from v_loadout.primary_discipline_id;
  v_change_secondary :=
    v_build.secondary_discipline_id is distinct from v_loadout.secondary_discipline_id;
  v_disc_fingerprint := left(p_request_fingerprint || ':disciplines', 160);
  v_skill_fingerprint := left(p_request_fingerprint || ':skills', 160);

  if v_change_primary or v_change_secondary then
    perform *
    from public.change_character_disciplines_v2(
      p_user_id,
      p_character_id,
      v_build.build_version,
      v_change_primary,
      v_loadout.primary_discipline_id,
      v_change_secondary,
      v_loadout.secondary_discipline_id,
      p_idempotency_key,
      v_disc_fingerprint
    );
  end if;

  select build.build_version
  into v_after_version
  from app_private.character_active_builds build
  where build.character_id = p_character_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'skillId', equipped.skill_id,
        'contentVersion', equipped.skill_content_version,
        'sourceDisciplineId', equipped.source_discipline_id
      )
      order by equipped.slot_index
    ),
    '[]'::jsonb
  )
  into v_current_skills
  from app_private.character_build_discipline_skills equipped
  where equipped.character_id = p_character_id;

  if v_current_skills is distinct from v_loadout.discipline_skills then
    perform *
    from public.save_character_discipline_skill_loadout_v1(
      p_user_id,
      p_character_id,
      v_after_version,
      v_loadout.discipline_skills,
      p_idempotency_key,
      v_skill_fingerprint
    );

    select build.build_version
    into v_after_version
    from app_private.character_active_builds build
    where build.character_id = p_character_id;
  end if;

  insert into app_private.character_saved_build_loadout_activation_idempotency (
    character_id,
    idempotency_key,
    request_fingerprint,
    build_version_after,
    activated_at
  ) values (
    p_character_id,
    p_idempotency_key,
    p_request_fingerprint,
    v_after_version,
    v_now
  );

  insert into app_private.character_saved_build_loadout_activation_audit (
    id,
    character_id,
    user_id,
    slot_index,
    build_version_before,
    build_version_after,
    target_primary_discipline_id,
    target_secondary_discipline_id,
    target_discipline_skills,
    request_fingerprint,
    activated_at
  ) values (
    gen_random_uuid(),
    p_character_id,
    p_user_id,
    p_slot_index,
    p_expected_build_version,
    v_after_version,
    v_loadout.primary_discipline_id,
    v_loadout.secondary_discipline_id,
    v_loadout.discipline_skills,
    p_request_fingerprint,
    v_now
  );

  return query select v_after_version, false, v_now;
end;
$$;

revoke all on function public.activate_character_build_loadout_v1(
  uuid,
  uuid,
  smallint,
  bigint,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.activate_character_build_loadout_v1(
  uuid,
  uuid,
  smallint,
  bigint,
  uuid,
  text
) to service_role;

commit;
