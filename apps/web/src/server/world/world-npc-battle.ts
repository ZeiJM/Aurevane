import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'
import { parseArenaNpc } from '@aurevane/validation/combat/npc-design'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import {
  createSupabaseBattleSessionRepository,
  readWorldNpcBattleReplay,
  worldNpcBattleTargetArgs,
  type WorldNpcBattleTarget,
} from '@/server/battle/supabase-battle-session-repository'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { readBattlefieldElevationPolicy } from '@/server/master/battlefield-elevation-policy-store'
import { readCombatEffectTimingPolicy } from '@/server/master/combat-effect-timing-policy-store'
import type { WorldCommand, WorldPosition } from '@/world/types'
import { isWalkable } from '@/world/travel'
import { resolveSector } from './world-content'
import { worldRpcError } from './world-repository'

export function startWorldNpcBattle(
  userId: string,
  characterId: string,
  npcId: string,
  command: WorldCommand,
  worldFingerprint: string,
): Promise<string> {
  return startWorldEncounterBattle(userId, characterId, { npcId }, command, worldFingerprint)
}

export function startWorldAvengerBattle(
  userId: string,
  characterId: string,
  ticketId: string,
  command: WorldCommand,
  worldFingerprint: string,
): Promise<string> {
  return startWorldEncounterBattle(userId, characterId, { ticketId }, command, worldFingerprint)
}

export function startWorldMentorBattle(
  userId: string,
  characterId: string,
  mentorRunId: string,
  training: boolean,
  command: WorldCommand,
  worldFingerprint: string,
): Promise<string> {
  return startWorldEncounterBattle(
    userId,
    characterId,
    { mentorRunId, training },
    command,
    worldFingerprint,
  )
}

async function startWorldEncounterBattle(
  userId: string,
  characterId: string,
  target: WorldNpcBattleTarget,
  command: WorldCommand,
  worldFingerprint: string,
): Promise<string> {
  const client = createSupabaseAdminClient()
  const readReplay = () =>
    readWorldNpcBattleReplay(
      client,
      target,
      { userId, characterId, commandId: command.commandId, worldFingerprint },
      worldRpcError,
    )
  const replay = await readReplay()
  if (replay) return replay
  const { data, error } = await client.rpc(
    'mentorRunId' in target
      ? 'read_world_mentor_battle_v1'
      : 'ticketId' in target
        ? 'read_world_avenger_battle_v1'
        : 'read_world_npc_battle_v1',
    {
      p_user_id: userId,
      p_character_id: characterId,
      p_expected_version: command.expectedVersion,
      ...worldNpcBattleTargetArgs(target),
    },
  )
  if (error) {
    if (!('npcId' in target)) {
      // Another request can admit the same challenge during preparation.
      const racedReplay = await readReplay()
      if (racedReplay) return racedReplay
    }
    worldRpcError(error)
  }
  if (!data || typeof data !== 'object')
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The NPC opponent could not be prepared.')
  const { placement, ...identityForBattle } = data as { placement?: WorldPosition }
  const sector = placement && resolveSector(placement.sectorId)
  if (!placement || !sector?.charted || !isWalkable(sector, placement))
    throw new AurevaneError('INVALID_REQUEST', 'This NPC challenge is no longer available.')
  const opponent = parseArenaNpc(identityForBattle)
  if (!opponent || ('npcId' in target && opponent.id !== target.npcId))
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The NPC opponent could not be prepared.')

  const battle = await createBattleSessionService({
    characters: createSupabaseCharacterRepository(),
    battles: createSupabaseBattleSessionRepository({
      characterId,
      npcId: opponent.id,
      ...('mentorRunId' in target
        ? { mentor: target }
        : 'ticketId' in target
          ? { ticketId: target.ticketId }
          : {}),
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
