begin;

-- PREPARE ONLY. Main migrations arrive before app deployment. No current catalog,
-- learned Skill, selected build, saved loadout, or frozen battle changes on migration.
create table app_private.phase4_combat_publication (
  release_id text primary key check (release_id = 'phase4-combat-interactions-v2'),
  activated_at timestamptz,
  result jsonb
);
create table app_private.phase4_combat_skill_versions (
  skill_id text primary key,
  previous_version integer not null check (previous_version = 1),
  content_version integer not null check (content_version = 2)
);
alter table app_private.phase4_combat_publication enable row level security;
alter table app_private.phase4_combat_skill_versions enable row level security;
revoke all on table app_private.phase4_combat_publication, app_private.phase4_combat_skill_versions from public, anon, authenticated, service_role;
grant select on table app_private.phase4_combat_publication, app_private.phase4_combat_skill_versions to service_role;
insert into app_private.phase4_combat_publication(release_id) values ('phase4-combat-interactions-v2');
insert into app_private.phase4_combat_skill_versions(skill_id, previous_version, content_version) values
  ('tidecaller.water-lance',1,2),
  ('tidecaller.flood-line',1,2),
  ('stormsinger.arc-spark',1,2),
  ('stormsinger.static-burst',1,2),
  ('stormsinger.static-drain',1,2),
  ('stormsinger.conductive-bolt',1,2),
  ('cinderweaver.cinder-bolt',1,2),
  ('cinderweaver.flame-burst',1,2),
  ('cinderweaver.ember-line',1,2),
  ('frostweaver.ice-lance',1,2),
  ('frostweaver.chilling-mist',1,2),
  ('frostweaver.shatter',1,2),
  ('wildwarden.renewing-herbs',1,2),
  ('runeblade.sigil-brand',1,2),
  ('runeblade.aether-cut',1,2),
  ('dawnshield.sacred-guard',1,2),
  ('ravager.open-wound',1,2),
  ('shadehand.smoke-vial',1,2),
  ('ironfist.breakfall',1,2),
  ('ironfist.pressure-palm',1,2);

-- The older foundation trigger runs before mastery provisioning and used hardcoded
-- v1 rows. Resolve its same six foundation libraries through the current catalog,
-- which is still v1 until activation. Preserve its existing system-grant provenance.
create or replace function app_private.provision_active_discipline_skills_v1()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  insert into app_private.character_skill_unlocks (
    character_id, skill_id, skill_content_version, source_discipline_id, learned_at, source_kind, source_id
  ) select new.character_id, catalog.skill_id, catalog.content_version, catalog.discipline_id,
      statement_timestamp(), 'system', 'active-discipline-provisioning:v1'
    from app_private.phase4_skill_catalog catalog
    where catalog.discipline_id in ('vanguard','lifebinder','aetherist','farstrider','shadehand','ironfist')
      and (catalog.discipline_id = new.primary_discipline_id or catalog.discipline_id = new.secondary_discipline_id)
    on conflict (character_id, skill_id) do nothing;
  return new;
end;
$$;
revoke all on function app_private.provision_active_discipline_skills_v1() from public, anon, authenticated;

-- Service-role-only release command, with no caller-controlled IDs or versions.
-- Call ONLY after the new application is READY. The transaction serializes with
-- build/loadout writers and publishes learned, selected and future catalog versions together.
create function public.activate_phase4_combat_interactions_v2()
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_release app_private.phase4_combat_publication%rowtype;
  v_build app_private.character_active_builds%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_unlock_count integer;
  v_build_count integer := 0;
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
begin
  select * into strict v_release from app_private.phase4_combat_publication
  where release_id = 'phase4-combat-interactions-v2' for update;
  if v_release.activated_at is not null then
    return v_release.result || jsonb_build_object('replayed', true);
  end if;
  -- Drain SELECT ... FOR UPDATE holders before taking any dependent write lock.
  -- SHARE ROW EXCLUSIVE admits their ROW SHARE table locks and can deadlock when
  -- a normal save later writes selected Skills while publication waits for its row.
  -- EXCLUSIVE still admits ordinary ACCESS SHARE readers.
  lock table app_private.character_active_builds in exclusive mode;
  begin
    -- Audit FK checks need these parents. A Mastery claim holds its character
    -- FOR UPDATE before provisioning learned Skills; never wait on that parent
    -- after acquiring a dependent write lock. Row NOWAIT does not cover implicit
    -- table locks, so obtain those explicitly without waiting as well.
    lock table auth.users, public.characters in row share mode nowait;
    perform parent.id from auth.users parent
    where exists (
      select 1 from app_private.character_active_builds build
      join app_private.character_build_discipline_skills selected on selected.character_id = build.character_id
      join app_private.phase4_combat_skill_versions release using (skill_id)
      where build.user_id = parent.id and selected.skill_content_version = release.previous_version
    ) order by parent.id for key share of parent nowait;
    perform parent.id from public.characters parent
    where exists (
      select 1 from app_private.character_active_builds build
      join app_private.character_build_discipline_skills selected on selected.character_id = build.character_id
      join app_private.phase4_combat_skill_versions release using (skill_id)
      where build.character_id = parent.id and selected.skill_content_version = release.previous_version
    ) order by parent.id for key share of parent nowait;
    -- An unrelated deletion may hold a child write lock before cascading into
    -- active builds. Do not wait for those writers while holding build exclusion.
    lock table app_private.character_skill_unlocks in share row exclusive mode nowait;
    lock table app_private.character_build_discipline_skills in share row exclusive mode nowait;
    lock table app_private.phase4_skill_catalog in share row exclusive mode nowait;
  exception when lock_not_available then
    raise exception using errcode = '55P03', message = 'PHASE4_COMBAT_PUBLICATION_BUSY',
      hint = 'Retry the same activation RPC after the competing transaction completes.';
  end;
  if (select count(*) from app_private.phase4_combat_skill_versions) <> 20
     or exists (
       select 1 from app_private.phase4_combat_skill_versions release
       left join app_private.phase4_skill_catalog catalog on catalog.skill_id = release.skill_id
       where catalog.skill_id is null or catalog.content_version <> release.previous_version
     ) then
    raise exception using errcode = '22023', message = 'PHASE4_COMBAT_PUBLICATION_CATALOG_MISMATCH';
  end if;
  if exists (
    select 1 from app_private.character_build_discipline_skills selected
    join app_private.phase4_combat_skill_versions release using (skill_id)
    left join app_private.character_skill_unlocks learned
      on learned.character_id = selected.character_id and learned.skill_id = selected.skill_id
    where selected.skill_content_version = release.previous_version
      and (learned.skill_id is null or learned.skill_content_version <> release.previous_version
           or learned.source_discipline_id <> selected.source_discipline_id)
  ) then
    raise exception using errcode = '22023', message = 'PHASE4_COMBAT_PUBLICATION_LEARNED_MISMATCH';
  end if;
  update app_private.character_skill_unlocks learned
  set skill_content_version = release.content_version
  from app_private.phase4_combat_skill_versions release
  where learned.skill_id = release.skill_id and learned.skill_content_version = release.previous_version;
  get diagnostics v_unlock_count = row_count;

  for v_build in
    select build.* from app_private.character_active_builds build
    where exists (
      select 1 from app_private.character_build_discipline_skills selected
      join app_private.phase4_combat_skill_versions release using (skill_id)
      where selected.character_id = build.character_id
        and selected.skill_content_version = release.previous_version
    ) order by build.character_id
  loop
    select coalesce(jsonb_agg(jsonb_build_object('skillId', skill_id,
      'contentVersion', skill_content_version, 'sourceDisciplineId', source_discipline_id)
      order by slot_index), '[]'::jsonb) into v_before
    from app_private.character_build_discipline_skills where character_id = v_build.character_id;
    update app_private.character_build_discipline_skills selected
    set skill_content_version = release.content_version
    from app_private.phase4_combat_skill_versions release
    where selected.character_id = v_build.character_id and selected.skill_id = release.skill_id
      and selected.skill_content_version = release.previous_version;
    select coalesce(jsonb_agg(jsonb_build_object('skillId', skill_id,
      'contentVersion', skill_content_version, 'sourceDisciplineId', source_discipline_id)
      order by slot_index), '[]'::jsonb) into v_after
    from app_private.character_build_discipline_skills where character_id = v_build.character_id;
    update app_private.character_active_builds set build_version = build_version + 1, updated_at = v_now
    where character_id = v_build.character_id;
    insert into app_private.character_skill_loadout_change_audit (
      id, character_id, user_id, build_version_before, build_version_after,
      primary_discipline_id, secondary_discipline_id, before_skills, after_skills, request_fingerprint, changed_at
    ) values (gen_random_uuid(), v_build.character_id, v_build.user_id, v_build.build_version,
      v_build.build_version + 1, v_build.primary_discipline_id, v_build.secondary_discipline_id,
      v_before, v_after, 'publication:phase4-combat-interactions-v2', v_now);
    v_build_count := v_build_count + 1;
  end loop;
  update app_private.phase4_skill_catalog catalog set content_version = release.content_version
  from app_private.phase4_combat_skill_versions release where catalog.skill_id = release.skill_id;
  v_result := jsonb_build_object('releaseId', 'phase4-combat-interactions-v2',
    'activatedAt', v_now, 'updatedUnlocks', v_unlock_count, 'updatedBuilds', v_build_count, 'replayed', false);
  update app_private.phase4_combat_publication set activated_at = v_now, result = v_result
  where release_id = 'phase4-combat-interactions-v2';
  return v_result;
end;
$$;
revoke all on function public.activate_phase4_combat_interactions_v2() from public, anon, authenticated;
grant execute on function public.activate_phase4_combat_interactions_v2() to service_role;
comment on function public.activate_phase4_combat_interactions_v2() is
  'Activate exactly phase4-combat-interactions-v2 only after application READY. Idempotent, service-role-only; never rewrites frozen battle snapshots or saved loadout history.';

-- Saved loadouts retain their historical JSON and source build version. At a new
-- activation, upgrade only this release's exact old references in the local target
-- value. Existing validation, expected-build version, idempotency and audit still run.
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

  select * into v_build
  from app_private.character_active_builds build
  where build.user_id = p_user_id
    and build.character_id = p_character_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_BUILD_NOT_FOUND';
  end if;

  select * into v_existing
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

  select * into v_loadout
  from app_private.character_saved_build_loadouts loadout
  where loadout.character_id = p_character_id
    and loadout.slot_index = p_slot_index;

  if not found then
    raise exception using errcode = 'P0001', message = 'SAVED_BUILD_LOADOUT_NOT_FOUND';
  end if;

  if exists (
    select 1 from app_private.phase4_combat_publication publication
    where publication.activated_at is not null
  ) then
    select coalesce(jsonb_agg(
      case when release.skill_id is not null then
        selected.element || jsonb_build_object('contentVersion', release.content_version)
      else selected.element end order by selected.ordinality), '[]'::jsonb)
    into v_loadout.discipline_skills
    from jsonb_array_elements(v_loadout.discipline_skills) with ordinality as selected(element, ordinality)
    left join app_private.phase4_combat_skill_versions release
      on release.skill_id = selected.element ->> 'skillId'
      and release.previous_version = (selected.element ->> 'contentVersion')::integer;
  end if;

  v_change_primary := v_build.primary_discipline_id is distinct from v_loadout.primary_discipline_id;
  v_change_secondary := v_build.secondary_discipline_id is distinct from v_loadout.secondary_discipline_id;
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

  select build.build_version into v_after_version
  from app_private.character_active_builds build
  where build.character_id = p_character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'skillId', equipped.skill_id,
    'contentVersion', equipped.skill_content_version,
    'sourceDisciplineId', equipped.source_discipline_id
  ) order by equipped.slot_index), '[]'::jsonb)
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

    select build.build_version into v_after_version
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

revoke all on function public.activate_character_build_loadout_v1(uuid, uuid, smallint, bigint, uuid, text)
  from public, anon, authenticated;
grant execute on function public.activate_character_build_loadout_v1(uuid, uuid, smallint, bigint, uuid, text)
  to service_role;

commit;
