begin;

-- Item/Support take account seed0 before character and build rows. Serialize the
-- build writers at that same outer boundary before they own a build row and later
-- acquire character FK key-share locks for their audit/receipt. Do not call the
-- inventory helper: build saves must retain their existing replay/eligibility
-- semantics and must not create or mutate inventory. Nested loadout activation
-- and Master player edits already acquire this account lock before their rows.
do $migration$
declare definition text; anchor text; replacement text; signature text;
 account_lock text:=E'  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));\n';
begin
 foreach signature in array array[
  'public.save_character_discipline_skill_loadout_v1(uuid,uuid,bigint,jsonb,uuid,text)',
  'public.save_character_build_loadout_v1(uuid,uuid,smallint,text,bigint,uuid,text)',
  'public.change_character_disciplines_v2(uuid,uuid,bigint,boolean,text,boolean,text,uuid,text)',
  'public.change_character_disciplines_v3(uuid,uuid,bigint,boolean,text,boolean,text,uuid,text)',
  'app_private.refresh_character_primary_profile_v1(uuid,uuid)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if signature like 'public.save_%' then
   anchor:=E'  select * into v_build\n  from app_private.character_active_builds build';
   replacement:=account_lock||chr(10)||anchor;
  elsif signature like 'public.change_%' then
   -- v2 must enter before its idempotency row: v3 may call it with account/build
   -- already held. Acquiring only just before v2's build row would invert receipts.
   anchor:=E'  perform app_private.lock_current_discipline_selection_v1();\n';
   replacement:=anchor||account_lock;
  else
   -- Entry refresh can be nested under other row holders. Preserve its existing
   -- nonblocking retry contract before it can call either Discipline writer.
   anchor:=E' perform app_private.lock_current_discipline_selection_v1();\n';
   replacement:=anchor||E' if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0)) then raise exception using errcode=''PT409'',message=''COMBAT_CONTENT_ADMISSION_RETRY''; end if;\n';
  end if;
  if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then
   raise exception 'DISCIPLINE_ITEM_LOCK_PREDECESSOR_CONFLICT: %',signature;
  end if;
  execute replace(definition,anchor,replacement);
 end loop;
end; $migration$;

commit;
