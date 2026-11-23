begin;

create function public.read_master_restoration_trial_npc_v1(
  p_actor_user_id uuid,
  p_actor_character_id uuid,
  p_npc_id uuid
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_master_page_v1(p_actor_user_id, p_actor_character_id, 'events.author');
  return (
    select jsonb_build_object(
      'id', npc.id,
      'name', npc.world->'name',
      'sectorId', npc.world->'sectorId',
      'x', npc.world->'x',
      'y', npc.world->'y'
    )
    from app_private.npc_designs npc
    where npc.id = p_npc_id
      and app_private.valid_npc_world_encounter_v1(npc.world->'encounter')
  );
end;
$$;

revoke all on function public.read_master_restoration_trial_npc_v1(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.read_master_restoration_trial_npc_v1(uuid, uuid, uuid)
  to service_role;

commit;
