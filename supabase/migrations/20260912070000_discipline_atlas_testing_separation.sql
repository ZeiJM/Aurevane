begin;

-- Phase-4 testing remains deliberately open, but test entitlement must never masquerade as earned
-- Discipline Mastery. This policy is server-owned so disabling testing later restores the authored
-- prerequisite graph without a browser-side bypass.
create table if not exists app_private.discipline_unlock_policy_state (
  singleton boolean primary key default true,
  policy_version integer not null,
  testing_open boolean not null,
  updated_at timestamptz not null default clock_timestamp(),
  constraint discipline_unlock_policy_state_singleton check (singleton),
  constraint discipline_unlock_policy_state_version_positive check (policy_version > 0)
);

revoke all on table app_private.discipline_unlock_policy_state from public, anon, authenticated;
grant select on table app_private.discipline_unlock_policy_state to service_role;

insert into app_private.discipline_unlock_policy_state (singleton, policy_version, testing_open)
values (true, 1, true)
on conflict (singleton) do update
set policy_version = greatest(app_private.discipline_unlock_policy_state.policy_version, excluded.policy_version),
    testing_open = true,
    updated_at = clock_timestamp();

comment on table app_private.discipline_unlock_policy_state is
  'Server-owned Discipline acquisition policy. testing_open grants effective access to published Disciplines without creating Mastery facts or earned Mastery XP.';

create or replace function app_private.discipline_testing_open_v1()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select coalesce((select testing_open from app_private.discipline_unlock_policy_state where singleton), false);
$$;

revoke all on function app_private.discipline_testing_open_v1() from public, anon, authenticated;

-- Retire the earlier support-Mastery implementation of testing access. It correctly kept browser
-- authority out of the client, but Phase 4 later introduced earned Mastery XP and therefore needs a
-- distinct entitlement layer.
drop trigger if exists grant_active_testing_disciplines_to_character_v1 on public.characters;
drop trigger if exists grant_active_testing_discipline_definition_v1 on app_private.discipline_definitions;
drop function if exists app_private.grant_active_testing_disciplines_to_character_v1();
drop function if exists app_private.grant_active_testing_discipline_definition_v1();

-- The Phase-4 mastery migration backfilled every then-existing Mastery fact to 1,000 XP. Reset only
-- rows whose sole fact was the explicit testing grant. Demonstration history is preserved because it
-- came from committed qualifying battle events and may remain useful during continued testing.
update app_private.character_discipline_progress progress
set mastery_xp = 0,
    updated_at = clock_timestamp()
where exists (
  select 1
  from app_private.character_discipline_masteries mastery
  where mastery.character_id = progress.character_id
    and mastery.discipline_id = progress.discipline_id
    and mastery.source_kind = 'support'
    and mastery.source_id = 'active-player-discipline-testing:v1'
);

delete from app_private.character_discipline_masteries
where source_kind = 'support'
  and source_id = 'active-player-discipline-testing:v1';

-- Earned stage deliberately ignores the testing policy. Owner/system/gameplay mastery facts remain
-- authoritative; otherwise the numerical Mastery track determines the current earned stage.
create or replace function app_private.discipline_mastery_stage_v1(
  p_character_id uuid,
  p_discipline_id text
)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select case
    when exists (
      select 1
      from app_private.character_discipline_masteries mastery
      where mastery.character_id = p_character_id
        and mastery.discipline_id = p_discipline_id
        and not (
          mastery.source_kind = 'support'
          and mastery.source_id = 'active-player-discipline-testing:v1'
        )
    ) then 5
    else coalesce((
      select case
        when progress.mastery_xp >= 1000 then 5
        when progress.mastery_xp >= 600 then 4
        when progress.mastery_xp >= 300 then 3
        when progress.mastery_xp >= 100 then 2
        else 1
      end
      from app_private.character_discipline_progress progress
      where progress.character_id = p_character_id
        and progress.discipline_id = p_discipline_id
    ), 1)
  end;
$$;

create or replace function app_private.discipline_release_unlocked_v1(
  p_character_id uuid,
  p_discipline_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select not exists (
    select 1
    from app_private.discipline_mastery_prerequisites requirement
    where requirement.discipline_id = p_discipline_id
      and app_private.discipline_mastery_stage_v1(
        p_character_id,
        requirement.required_discipline_id
      ) < requirement.minimum_stage
  );
$$;

-- Effective acquisition is open for every currently published Primary while testing is active.
-- Planned Atlas entries have no enabled definition and therefore can never be selected by this
-- policy before their actual combat content is published.
create or replace function app_private.discipline_unlocked_v1(
  p_character_id uuid,
  p_discipline_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select (
    app_private.discipline_testing_open_v1()
    and exists (
      select 1
      from app_private.discipline_definitions definition
      where definition.discipline_id = p_discipline_id
        and definition.enabled_for_primary
    )
  ) or app_private.discipline_release_unlocked_v1(p_character_id, p_discipline_id);
$$;

-- Testers receive the whole published library for an active Discipline without converting that
-- convenience into earned stage. When testing is disabled, normal 4/2/2 stage provisioning resumes.
create or replace function app_private.provision_mastery_skills_v1(p_character_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public, app_private
as $$
  insert into app_private.character_skill_unlocks (
    character_id,
    skill_id,
    skill_content_version,
    source_discipline_id,
    learned_at,
    source_kind,
    source_id
  )
  select
    p_character_id,
    catalog.skill_id,
    catalog.content_version,
    catalog.discipline_id,
    statement_timestamp(),
    case when app_private.discipline_testing_open_v1() then 'support' else 'gameplay' end,
    case when app_private.discipline_testing_open_v1()
      then 'discipline-testing-open:v1'
      else 'discipline-mastery:v1'
    end
  from app_private.phase4_skill_catalog catalog
  join app_private.character_active_builds build
    on build.character_id = p_character_id
   and (
     catalog.discipline_id = build.primary_discipline_id
     or catalog.discipline_id = build.secondary_discipline_id
   )
  where app_private.discipline_unlocked_v1(p_character_id, catalog.discipline_id)
    and (
      app_private.discipline_testing_open_v1()
      or app_private.discipline_mastery_stage_v1(p_character_id, catalog.discipline_id) >= catalog.minimum_stage
    )
  on conflict (character_id, skill_id) do nothing;
$$;

-- Keep the existing catalog contract so current server code does not gain a second build path.
-- In testing, a synthetic mastered_at makes every published Secondary available; outside testing,
-- only an actual mastery fact does so.
create or replace function public.get_character_discipline_catalog_v2(
  p_user_id uuid,
  p_character_id uuid
)
returns table(
  discipline_id text,
  definition_version integer,
  name text,
  summary text,
  enabled_for_primary boolean,
  enabled_for_secondary boolean,
  profile_version integer,
  stat_offsets jsonb,
  mastered_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  with latest as (
    select distinct on (definition.discipline_id) definition.*
    from app_private.discipline_definitions definition
    where definition.enabled_for_primary or definition.enabled_for_secondary
    order by definition.discipline_id, definition.definition_version desc
  ), policy as (
    select testing_open, updated_at
    from app_private.discipline_unlock_policy_state
    where singleton
  )
  select
    definition.discipline_id,
    definition.definition_version,
    definition.name,
    definition.summary,
    definition.enabled_for_primary
      and app_private.discipline_unlocked_v1(p_character_id, definition.discipline_id),
    definition.enabled_for_secondary,
    profile.profile_version,
    profile.stat_offsets,
    case
      when mastery.mastered_at is not null then mastery.mastered_at
      when coalesce(policy.testing_open, false) and definition.enabled_for_secondary then policy.updated_at
      else null
    end
  from latest definition
  join app_private.discipline_primary_profiles profile
    on profile.discipline_id = definition.discipline_id
   and profile.profile_version = definition.primary_profile_version
  left join app_private.character_discipline_masteries mastery
    on mastery.character_id = p_character_id
   and mastery.discipline_id = definition.discipline_id
  left join policy on true
  where exists (
    select 1
    from public.characters character
    where character.id = p_character_id
      and character.user_id = p_user_id
  )
  order by definition.name, definition.discipline_id;
$$;

-- The existing progress endpoint now reports earned progress while its unlocked flag continues to
-- mean effective current access. This prevents the Profile from labelling test entitlement as Master.
create or replace function public.get_character_discipline_progress_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table(
  discipline_id text,
  mastery_xp integer,
  stage integer,
  unlocked boolean,
  demonstrated_skill_count integer
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select
    definition.discipline_id,
    coalesce(progress.mastery_xp, 0),
    app_private.discipline_mastery_stage_v1(p_character_id, definition.discipline_id),
    app_private.discipline_unlocked_v1(p_character_id, definition.discipline_id),
    coalesce(cardinality(progress.demonstrated_skills), 0)
  from (
    select distinct discipline_id
    from app_private.discipline_definitions
    where enabled_for_primary
  ) definition
  left join app_private.character_discipline_progress progress
    on progress.character_id = p_character_id
   and progress.discipline_id = definition.discipline_id
  where exists (
    select 1
    from public.characters character
    where character.id = p_character_id
      and character.user_id = p_user_id
  )
  order by definition.discipline_id;
$$;

-- Rich Atlas projection keeps release eligibility separate from the temporary testing overlay.
create or replace function public.get_character_discipline_atlas_progress_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table(
  discipline_id text,
  mastery_xp integer,
  earned_stage integer,
  release_unlocked boolean,
  effective_unlocked boolean,
  testing_access boolean,
  demonstrated_skill_count integer
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select
    definition.discipline_id,
    coalesce(progress.mastery_xp, 0),
    app_private.discipline_mastery_stage_v1(p_character_id, definition.discipline_id),
    app_private.discipline_release_unlocked_v1(p_character_id, definition.discipline_id),
    app_private.discipline_unlocked_v1(p_character_id, definition.discipline_id),
    app_private.discipline_testing_open_v1(),
    coalesce(cardinality(progress.demonstrated_skills), 0)
  from (
    select distinct discipline_id
    from app_private.discipline_definitions
    where enabled_for_primary
  ) definition
  left join app_private.character_discipline_progress progress
    on progress.character_id = p_character_id
   and progress.discipline_id = definition.discipline_id
  where exists (
    select 1
    from public.characters character
    where character.id = p_character_id
      and character.user_id = p_user_id
  )
  order by definition.discipline_id;
$$;

revoke all on function app_private.discipline_mastery_stage_v1(uuid, text) from public, anon, authenticated;
revoke all on function app_private.discipline_release_unlocked_v1(uuid, text) from public, anon, authenticated;
revoke all on function app_private.discipline_unlocked_v1(uuid, text) from public, anon, authenticated;
revoke all on function app_private.provision_mastery_skills_v1(uuid) from public, anon, authenticated;
revoke all on function public.get_character_discipline_atlas_progress_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_character_discipline_atlas_progress_v1(uuid, uuid) to service_role;

-- Re-provision current active builds under the separated testing policy. Existing rows remain
-- idempotent; future testing-provisioned rows carry explicit support provenance.
select app_private.provision_mastery_skills_v1(character.id)
from public.characters character;

commit;
