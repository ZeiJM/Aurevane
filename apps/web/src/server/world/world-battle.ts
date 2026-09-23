import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createPvpEncounter, type PvpLobbyMemberView } from '@/server/battle/pvp-lobby-service'
import { createResolvedBattleBuildAuthoritySnapshot } from '@/server/battle/battle-build-authority'
import { loadCharacterCommittedBuildSnapshot } from '@/server/character/character-build-service'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'
import type { WorldState } from '@/world/types'
import { assertEncounterRange } from './world-service'
import { readWorld, worldRpcError } from './world-repository'

export async function attackWorldPlayer(
  userId: string,
  characterId: string,
  targetId: string,
  expectedVersion: number,
) {
  const current = await readWorld(userId, characterId)
  if (!current.view.players.some((p) => p.characterId === targetId && p.attackable))
    throw new AurevaneError('INVALID_REQUEST', 'That player is not within reach.')
  const supabase = createSupabaseAdminClient()
  const { data: pair, error: pairError } = await supabase.rpc('read_world_encounter_pair_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_target_id: targetId,
  })
  if (pairError) worldRpcError(pairError)
  if (!pair?.attacker || !pair?.target || typeof pair.targetUserId !== 'string')
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The encounter could not be prepared.')
  assertEncounterRange(pair.attacker as WorldState, pair.target as WorldState)
  const characters = createSupabaseCharacterRepository(),
    builds = createSupabaseCharacterBuildRepository()
  const roster = await Promise.all(
    [
      { userId, characterId },
      { userId: pair.targetUserId as string, characterId: targetId },
    ].map(async (entry, index) => {
      const character = await characters.findByOwnerId?.(entry.userId, entry.characterId)
      if (!character) throw new AurevaneError('INVALID_REQUEST', 'That character is unavailable.')
      const buildSnapshot = await loadCharacterCommittedBuildSnapshot(
        entry.userId,
        entry.characterId,
        builds,
      )
      const member: PvpLobbyMemberView = {
        ...entry,
        characterName: character.name,
        characterLevel: character.level,
        portraitRef: character.portraitRef,
        profileImageUrl: null,
        teamIndex: index,
        seatIndex: 0,
        seated: true,
        ready: true,
        isHost: index === 0,
      }
      return { character, buildSnapshot, member }
    }),
  )
  const authority = await createResolvedBattleBuildAuthoritySnapshot(
    'pvp',
    roster.map(({ character, buildSnapshot }) => ({
      combatantId: `character:${character.id}`,
      characterId: character.id,
      snapshot: buildSnapshot,
    })),
    createServerCombatContentResolver(),
  )
  const encounter = createPvpEncounter(roster, [1, 1, 0], authority)
  const { data, error } = await supabase.rpc('start_world_encounter_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_target_id: targetId,
    p_expected_version: expectedVersion,
    p_target_version: pair.target.version,
    p_snapshot: encounter,
    p_build_versions: Object.fromEntries(
      roster.map((r) => [r.character.id, r.buildSnapshot.buildVersion]),
    ),
  })
  if (error) worldRpcError(error)
  if (typeof data?.battleSessionId !== 'string')
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The encounter could not be started.')
  return {
    ...(await readWorld(userId, characterId)).view,
    battleSessionId: data.battleSessionId as string,
  }
}
