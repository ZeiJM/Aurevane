import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { tickAiTurnClock } from './ai-battle-quality-service'
import { tickPvpTurnClock } from './pvp-battle-quality-service'
import { getPvpBattleMetadata } from './pvp-lobby-service'

export async function enforceBattleTurnDeadline(
  userId: string,
  battleSessionId: string,
): Promise<void> {
  const metadata = await getPvpBattleMetadata(userId, battleSessionId)
  const tick = metadata
    ? await tickPvpTurnClock(userId, battleSessionId)
    : await tickAiTurnClock(userId, battleSessionId)
  if (tick.timedOut) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Your turn timer expired. The battle has advanced to the next combatant.',
    )
  }
}

export const enforcePvpTurnDeadline = enforceBattleTurnDeadline
