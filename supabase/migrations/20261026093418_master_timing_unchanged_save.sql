begin;
-- The v2 entry point still checks the catalogue token before this publisher's
-- Owner/validation/policy lock/CAS boundary. An unchanged policy creates no row.
do $migration$
declare d text; predecessor text := ' insert into app_private.combat_effect_timing_policy_versions(version,modes,published_by,reason,tag_authority)';
begin
  d := pg_get_functiondef('public.publish_combat_effect_timing_policy_v1(uuid,integer,jsonb,text)'::regprocedure);
  if length(d) - length(replace(d,predecessor,'')) <> length(predecessor) then
    raise exception 'TIMING_NOOP_PREDECESSOR_CONFLICT';
  end if;
  execute replace(d,predecessor,$replacement$
 if (public.read_combat_effect_timing_policy_v1()->'modes') = p_modes then
   return public.read_combat_effect_timing_policy_v1();
 end if;
$replacement$ || predecessor);
end;
$migration$;
commit;
