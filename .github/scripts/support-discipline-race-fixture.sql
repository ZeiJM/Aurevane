-- Disposable local test database only. Pause the real Discipline writer immediately
-- before the first audit FK can acquire a character key-share lock. Empty Skill
-- saves avoid earlier Skill-row inserts, reproducing the original lock cycle.
create schema support_skill_race;
revoke all on schema support_skill_race from public,anon,authenticated,service_role;
create function support_skill_race.before_audit() returns trigger
language plpgsql set search_path='' as $$
declare gate text:=pg_catalog.current_setting('aurevane.support_race_gate',true);
begin
 if gate is not null and gate<>'' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(gate,0));
 end if;
 return new;
end; $$;
revoke all on function support_skill_race.before_audit() from public,anon,authenticated,service_role;
create trigger support_skill_race_gate before insert on app_private.character_skill_loadout_change_audit
for each row execute function support_skill_race.before_audit();
