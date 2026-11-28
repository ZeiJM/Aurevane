begin;

set local lock_timeout = '5s';

-- A look is a catalogue entry. Its active and queued uses belong to each character.
drop index public.character_profile_display_active_look_unique;
drop index public.character_profile_display_pending_look_unique;

do $$
declare
  definition text := pg_get_functiondef(
    'public.commit_character_appearance_v2(uuid,uuid,integer,text)'::regprocedure
  );
  claim_start int := strpos(definition, '  -- Serialize claims for this URL');
  claim_end int := strpos(definition, '  v_battle_active := exists (');
begin
  if claim_start = 0 or claim_end <= claim_start
    or strpos(substr(definition, claim_start, claim_end - claim_start),
      'CHARACTER_APPEARANCE_DUPLICATE') = 0 then
    raise exception 'Unrecognized character appearance claim block';
  end if;

  -- Keep ownership, revision checks, URL validation, and battle pinning in the existing RPC.
  execute overlay(definition placing '' from claim_start for claim_end - claim_start);
end;
$$;

commit;
