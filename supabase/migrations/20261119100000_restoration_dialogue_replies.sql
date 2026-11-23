begin;

-- Keep existing approval, scope and reward checks and accept only bounded display text.
-- These labels live in the already captured definition. They never select an action.
do $migration$
declare
  definition text;
  edit record;
begin
  for edit in select * from (values
    ('app_private.assert_event_inventory_discovery_v1(jsonb)',
     $before$  perform app_private.assert_event_inventory_discovery_before_restoration_trial_v1($before$,
     $after$  if (restoration ? 'recoveryReply' and (
      jsonb_typeof(restoration->'recoveryReply') is distinct from 'string'
      or char_length(restoration->>'recoveryReply') not between 1 and 80
      or (restoration->>'recoveryReply') ~ '^[[:space:]]|[[:space:]]$'
    )) or (trial ? 'reply' and (
      jsonb_typeof(trial->'reply') is distinct from 'string'
      or char_length(trial->>'reply') not between 1 and 80
      or (trial->>'reply') ~ '^[[:space:]]|[[:space:]]$'
    )) then
    raise exception using errcode = '22023', message = 'EVENT_INVENTORY_RESTORATION_REPLY_INVALID';
  end if;
  perform app_private.assert_event_inventory_discovery_before_restoration_trial_v1($after$),
    ('app_private.assert_event_inventory_discovery_v1(jsonb)',
     $before$array['trial','recoveryRewardPackageRef']$before$,
     $after$array['trial','recoveryRewardPackageRef','recoveryReply']$after$),
    ('app_private.assert_event_inventory_discovery_v1(jsonb)',
     $before$array['npcId','offer','active','ready','rewardPackageRef']$before$,
     $after$array['npcId','offer','active','ready','rewardPackageRef','reply']$after$),
    ('app_private.project_personal_inventory_restoration_v1(uuid,uuid,uuid,jsonb,timestamptz)',
     $before$  ) || case when choosing and available is true and trial_current is true$before$,
     $after$  ) || case when at_giver and available is true and restoration_settled_at is null
      and (choosing or (restoration_trial_selected_at is not null and not trial_active))
      and restoration ? 'recoveryReply'
    then jsonb_build_object('recoveryReply',restoration->>'recoveryReply') else '{}'::jsonb end
  || case when choosing and available is true and trial_current is true$after$),
    ('app_private.project_personal_inventory_restoration_v1(uuid,uuid,uuid,jsonb,timestamptz)',
     $before$    || case when at_giver then jsonb_build_object('alternativeAction','choose-restoration-trial')$before$,
     $after$    || case when at_giver then jsonb_build_object('alternativeAction','choose-restoration-trial')
      || case when (restoration->'trial') ? 'reply'
        then jsonb_build_object('trialReply',restoration#>>'{trial,reply}') else '{}'::jsonb end$after$)
  ) changes(signature, predecessor, replacement)
  loop
    definition := pg_get_functiondef(edit.signature::regprocedure);
    if length(definition) - length(replace(definition, edit.predecessor, '')) <> length(edit.predecessor) then
      raise exception 'EVENT_RESTORATION_DIALOGUE_PREDECESSOR: %', edit.signature;
    end if;
    execute replace(definition, edit.predecessor, edit.replacement);
  end loop;
end;
$migration$;

commit;
