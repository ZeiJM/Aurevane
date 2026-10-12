-- REVIEW-ONLY DRAFT: not an approved or applied Supabase migration.
-- Keep this file outside supabase/migrations until the owner approves this exact
-- additional read projection. Do not apply as part of the approved scene reader.
--
-- Existing authority: public.get_pvp_battle_metadata_v1(uuid, uuid) from
-- 20260820130000_pvp_lobbies_and_spectation.sql.
-- Sole payload change: add origin = 'world' | 'battle-hall', derived from the
-- existing durable app_private.world_encounters provenance table.
-- No table/schema addition, data mutation, backfill, or encounter write change.
-- The existing player-participant authorization runs before the provenance read;
-- completed sessions remain readable to both participating accounts.
-- SECURITY DEFINER, STABLE, search_path, and service-only execution are retained.

begin;

create or replace function public.get_pvp_battle_metadata_v1(
  p_user_id uuid,
  p_battle_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
stable
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from app_private.battle_participants p
    where p.battle_session_id = p_battle_session_id
      and p.user_id = p_user_id and p.participant_role = 'player'
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'lobby_id', l.id,
    'mode', l.mode,
    'battle_key', l.battle_key,
    'origin', case
      when exists (
        select 1 from app_private.world_encounters w
        where w.battle_session_id = p_battle_session_id
      ) then 'world'
      else 'battle-hall'
    end,
    'local_character_id', (
      select p.character_id from app_private.battle_participants p
      where p.battle_session_id = p_battle_session_id
        and p.user_id = p_user_id and p.participant_role = 'player'
      limit 1
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'combatant_id', p.combatant_id,
        'character_id', p.character_id,
        'character_name', c.name,
        'character_level', c.level,
        'portrait_ref', c.portrait_ref,
        'team_index', m.team_index,
        'seat_index', m.seat_index
      ) order by m.team_index, m.seat_index)
      from app_private.battle_participants p
      join public.characters c on c.id = p.character_id
      join app_private.pvp_lobby_members m
        on m.lobby_id = l.id and m.character_id = p.character_id
      where p.battle_session_id = p_battle_session_id and p.participant_role = 'player'
    ), '[]'::jsonb)
  ) into v_result
  from app_private.pvp_lobbies l
  where l.battle_session_id = p_battle_session_id;

  return v_result;
end;
$$;

revoke all on function public.get_pvp_battle_metadata_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_pvp_battle_metadata_v1(uuid, uuid)
  to service_role;

commit;
