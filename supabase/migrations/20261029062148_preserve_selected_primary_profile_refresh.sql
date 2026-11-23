begin;

-- Publication refresh is not a new acquisition. Existing Primary selections
-- survive changed unlock requirements/revoked grants; inserts and real switches
-- still require the current entitlement. Keep every existing ACL and function
-- property, and fail closed if the installed predecessor differs.
do $migration$
declare
 before_function pg_proc%rowtype;
 after_function pg_proc%rowtype;
 definition text;
 predecessor text := $before$ if not app_private.discipline_unlocked_v1(new.character_id,new.primary_discipline_id) then raise exception using errcode='22023',message='PRIMARY_DISCIPLINE_MASTERY_REQUIRED'; end if;$before$;
begin
 select * into strict before_function from pg_proc where oid='app_private.enforce_phase4_acquisition_v1()'::regprocedure;
 definition:=pg_get_functiondef(before_function.oid);
 if strpos(definition,predecessor)=0 or strpos(lower(definition),'tg_op')>0 then
  raise exception 'SELECTED_PRIMARY_REFRESH_PREDECESSOR_CONFLICT';
 end if;
 execute replace(definition,predecessor,$after$ if tg_op='UPDATE' then
  if new.character_id=old.character_id and new.user_id=old.user_id and new.primary_discipline_id=old.primary_discipline_id then
   return new;
  end if;
 end if;
$after$||predecessor);
 select * into strict after_function from pg_proc where oid=before_function.oid;
 if after_function.proacl is distinct from before_function.proacl
  or after_function.proowner is distinct from before_function.proowner
  or after_function.prosecdef is distinct from before_function.prosecdef
  or after_function.proconfig is distinct from before_function.proconfig then
  raise exception 'SELECTED_PRIMARY_REFRESH_AUTHORITY_CHANGED';
 end if;
end; $migration$;

commit;
