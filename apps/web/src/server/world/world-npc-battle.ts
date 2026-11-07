import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'
import { parseArenaNpc } from '@aurevane/validation/combat/npc-design'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { readBattlefieldElevationPolicy } from '@/server/master/battlefield-elevation-policy-store'
import { readCombatEffectTimingPolicy } from '@/server/master/combat-effect-timing-policy-store'
import { isWorldUuid } from '@/world/command'
import type { WorldCommand, WorldPosition } from '@/world/types'
import { isWalkable } from '@/world/travel'
import { resolveSector } from './world-content'
import { worldRpcError } from './world-repository'

export async function startWorldNpcBattle(
  userId: string,
  characterId: string,
  npcId: string,
  command: WorldCommand,
  worldFingerprint: string,
): Promise<string> {
  const client = createSupabaseAdminClient()
  const identity = { p_user_id: userId, p_character_id: characterId, p_npc_id: npcId }
  const { data: replay, error: replayError } = await client.rpc('read_world_npc_battle_replay_v1', {
    ...identity,
    p_command_id: command.commandId,
    p_world_fingerprint: worldFingerprint,
  })
  if (replayError) worldRpcError(replayError)
  if (isWorldUuid(replay)) return replay
  const { data, error } = await client.rpc('read_world_npc_battle_v1', {
    ...identity,
    p_expected_version: command.expectedVersion,
  })
  if (error) worldRpcError(error)
  if (!data || typeof data !== 'object')
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The NPC opponent could not be prepared.')
  const { placement, ...identityForBattle } = data as { placement?: WorldPosition }
  const sector = placement && resolveSector(placement.sectorId)
  if (!placement || !sector?.charted || !isWalkable(sector, placement))
    throw new AurevaneError('INVALID_REQUEST', 'This NPC challenge is no longer available.')
  const opponent = parseArenaNpc(identityForBattle)
  if (!opponent || opponent.id !== npcId)
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The NPC opponent could not be prepared.')

  const battle = await createBattleSessionService({
    characters: createSupabaseCharacterRepository(),
    battles: createSupabaseBattleSessionRepository({
      characterId,
      npcId,
      expectedVersion: command.expectedVersion,
      worldFingerprint,
      throwWorldError: worldRpcError,
    }),
    builds: createSupabaseCharacterBuildRepository(),
    combatContentResolver: createServerCombatContentResolver(),
    readEffectTimingPolicy: readCombatEffectTimingPolicy,
    readElevationPolicy: readBattlefieldElevationPolicy,
    readArenaNpc: async (id) => (id === opponent.id ? opponent : null),
  }).createSession({
    userId,
    characterId,
    arenaNpcId: opponent.id,
    worldNpcEncounter: true,
    idempotencyKey: command.commandId,
  })
  return battle.battleSessionId
}
