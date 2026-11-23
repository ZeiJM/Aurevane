begin;

-- The correction preview uses the character's actual cycle curve. Include it in
-- the existing reviewed facts so a curve/mapping change also invalidates CAS.
-- Retain all caller authorization, locking, allocation writes and audit behavior.
do $migration$
declare body text; predecessor text;
begin
 body:=pg_get_functiondef('app_private.player_support_facts_v1(uuid)'::regprocedure);
 predecessor:=$before$'attributes',jsonb_build_object($before$;
 if strpos(body,predecessor)=0 then raise exception 'PLAYER_PROGRESSION_CURVE_PREDECESSOR_CONFLICT'; end if;
 body:=replace(body,predecessor,$after$'progressionCurve',(
   select jsonb_build_object('version',curve.version,'maxLevel',curve.max_level,'cumulativeXpByLevel',curve.cumulative_xp_by_level)
   from app_private.level_progression_curves curve
   join app_private.progression_cycle_level_curves mapping on mapping.curve_version=curve.version
   where mapping.progression_cycle=c.progression_cycle),
 'attributes',jsonb_build_object($after$);
 execute body;
end; $migration$;

commit;
