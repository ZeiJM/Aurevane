import { assertPreparedBattleSource } from '@/server/battle/battle-source-authority'
import { readBattlefieldElevationPolicy } from '@/server/master/battlefield-elevation-policy-store'
import { readCombatEffectTimingPolicy } from '@/server/master/combat-effect-timing-policy-store'
import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createPvpEncounter, type PvpLobbyMemberView } from '@/server/battle/pvp-lobby-service'
import { createResolvedBattleBuildAuthoritySnapshot } from '@/server/battle/battle-build-authority'
import { prepareBattleAbilityStartup } from '@/server/battle/battle-ability-startup'
import { loadCharacterCommittedBuildSnapshot } from '@/server/character/character-build-service'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'
import type { WorldState } from '@/world/types'
import type { WorldAttackReceipt } from '@/world/attack-receipt'
import { assertEncounterRange } from './world-service'
import { settleWorldAttackAuthority, worldRpcError } from './world-repository'

export async function attackWorldPlayer(
  userId: string,
  characterId: string,
  targetId: string,
  expectedVersion: number,
): Promise<WorldAttackReceipt> {
  const current = await settleWorldAttackAuthority(userId, characterId, expectedVersion)
  if (!current.players.some((p) => p.characterId === targetId && p.attackable))
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
  const combatContentResolver = createServerCombatContentResolver()
  const preparation = Promise.all(
    [
      { userId, characterId },
      { userId: pair.targetUserId as string, characterId: targetId },
    ].map(async (entry, index) => {
      const [character, buildSnapshot] = await Promise.all([
        characters.findByOwnerId?.(entry.userId, entry.characterId),
        loadCharacterCommittedBuildSnapshot(entry.userId, entry.characterId, builds),
      ])
      if (!character) throw new AurevaneError('INVALID_REQUEST', 'That character is unavailable.')
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
      assertPreparedBattleSource(character, buildSnapshot)
      return { character, buildSnapshot, member }
    }),
  ).then(async (roster) => {
    const authority = await createResolvedBattleBuildAuthoritySnapshot(
      'pvp',
      roster.map(({ character, buildSnapshot }) => ({
        combatantId: `character:${character.id}`,
        characterId: character.id,
        snapshot: buildSnapshot,
      })),
      combatContentResolver,
    )
    return { roster, authority }
  })
  const [{ roster, authority }, elevationPolicy, timingPolicy] = await Promise.all([
    preparation,
    readBattlefieldElevationPolicy(),
    readCombatEffectTimingPolicy(),
  ])
  const encounter = createPvpEncounter(roster, [1, 1, 0], authority, elevationPolicy)
  encounter.effectTimingPolicy = timingPolicy
  encounter.effectStackingPolicyVersion = 1
  encounter.percentageDotPolicyVersion = 1
  encounter.dotTriggerPolicyVersion = 2
  encounter.skillPacketPolicyVersion = 1
  encounter.groundEffectPolicyVersion = 1
  const { snapshot, startup } = await prepareBattleAbilityStartup(
    encounter,
    authority,
    combatContentResolver,
  )
  const { data, error } = await supabase.rpc(
    startup ? 'start_world_encounter_v2' : 'start_world_encounter_v1',
    {
      p_user_id: userId,
      p_character_id: characterId,
      p_target_id: targetId,
      p_expected_version: current.state.version,
      p_target_version: pair.target.version,
      p_snapshot: snapshot,
      ...(startup ?? {}),
      p_build_versions: Object.fromEntries(
        roster.map((r) => [r.character.id, r.buildSnapshot.buildVersion]),
      ),
    },
  )
  if (error) worldRpcError(error)
  if (typeof data?.battleSessionId !== 'string' || data.battleSessionId.trim().length === 0)
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The encounter could not be started.')
  return {
    characterId,
    battleSessionId: data.battleSessionId,
  }
}
