begin;

-- Temporary owner-directed testing override. Preserve policy v1 (4h / 4h)
-- so production attunement cooldowns can be restored later without rebuilding
-- the original rule definition.
insert into app_private.character_build_attunement_policies (
  version,
  primary_cooldown_seconds,
  secondary_cooldown_seconds
)
values (2, 0, 0);

update app_private.character_build_attunement_policy_state
set
  current_policy_version = 2,
  updated_at = clock_timestamp()
where singleton;

-- Existing absolute deadlines would otherwise remain effective even after the
-- current policy changes to zero, so clear them for immediate test swapping.
update app_private.character_active_builds
set
  primary_attunement_locked_until = null,
  secondary_attunement_locked_until = null,
  last_attunement_policy_version = 2,
  updated_at = clock_timestamp();

commit;
