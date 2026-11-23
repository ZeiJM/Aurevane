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
import type { WorldCommand } from '@/world/types'
import { worldRpcError } from './world-repository'

export async function startPersonalRealmBattle(
  userId: string,
  characterId: string,
  runId: string,
  command: WorldCommand,
  worldFingerprint: string,
) {
  const { data, error } = await createSupabaseAdminClient().rpc(
    'read_world_personal_realm_battle_v1',
    {
      p_user_id: userId,
      p_character_id: characterId,
      p_run_id: runId,
      p_expected_version: command.expectedVersion,
    },
  )
  if (error) worldRpcError(error)
  const guardian = parseArenaNpc(data)
  if (!guardian)
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The guardian could not be prepared.')

  return createBattleSessionService({
    characters: createSupabaseCharacterRepository(),
    battles: createSupabaseBattleSessionRepository({
      characterId,
      runId,
      expectedVersion: command.expectedVersion,
      worldFingerprint,
      throwWorldError: worldRpcError,
    }),
    builds: createSupabaseCharacterBuildRepository(),
    combatContentResolver: createServerCombatContentResolver(),
    readEffectTimingPolicy: readCombatEffectTimingPolicy,
    readElevationPolicy: readBattlefieldElevationPolicy,
    readArenaNpc: async (id) => (id === guardian.id ? guardian : null),
  }).createSession({
    userId,
    characterId,
    realmRunId: runId,
    arenaNpcId: guardian.id,
    idempotencyKey: command.commandId,
  })
}
