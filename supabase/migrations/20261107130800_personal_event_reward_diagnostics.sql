begin;

create index event_personal_reward_diagnostics_idx
 on app_private.event_personal_quest_attempts
 (run_id,item_claim_pending desc,completed_at desc,id)
 where completed_at is not null;

-- Extend only the selected-character staff dashboard, after its run and scope checks.
do $migration$
declare src text; anchor text;
begin
 src:=pg_get_functiondef('public.read_event_operation_dashboard_v1(uuid,uuid,uuid)'::regprocedure);
 anchor:=$anchor$'claims', v_claims,$anchor$;
 if length(src)-length(replace(src,anchor,''))<>length(anchor) then
  raise exception 'EVENT_PERSONAL_REWARDS_DASHBOARD_PREDECESSOR';
 end if;
 execute replace(src,anchor,anchor||$patch$
   'personalRewardsPendingCount', (
    select count(*) from app_private.event_personal_quest_attempts pending
    join public.characters character on (character.id,character.user_id)=(pending.character_id,pending.user_id)
    where pending.run_id=p_run_id and pending.item_claim_pending
   ),
   'personalRewards', coalesce((
    select jsonb_agg(jsonb_build_object(
     'attemptId', a.id,
     'characterId', a.character_id,
     'completedAt', a.completed_at,
     'awardedXp', a.awarded_xp,
     'itemName', a.journey->>'outputName',
     'itemClaimPending', a.item_claim_pending
    ) order by a.item_claim_pending desc,a.completed_at desc,a.id)
    from (
     select attempt.id,attempt.character_id,attempt.completed_at,attempt.awarded_xp,
      attempt.item_claim_pending,captured.journey
     from app_private.event_personal_quest_attempts attempt
     join app_private.event_run_personal_journeys captured on captured.run_id=attempt.run_id
     where attempt.run_id=p_run_id and attempt.completed_at is not null
      and (attempt.awarded_xp>0 or captured.journey->>'type'='item-exchange')
      and (not attempt.item_claim_pending or exists(
       select from public.characters character
       where (character.id,character.user_id)=(attempt.character_id,attempt.user_id)
      ))
     order by attempt.item_claim_pending desc,attempt.completed_at desc,attempt.id
     limit 40
    ) a
   ),'[]'::jsonb),
$patch$);
end;
$migration$;

commit;
