import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { tickPvpTurnClock } from './pvp-battle-quality-service'
import { getPvpBattleMetadata } from './pvp-lobby-service'

export async function enforcePvpTurnDeadline(
  userId: string,
  battleSessionId: string,
): Promise<void> {
  const metadata = await getPvpBattleMetadata(userId, battleSessionId)
  if (!metadata) return
  const tick = await tickPvpTurnClock(userId, battleSessionId)
  if (tick.timedOut) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Your 60-second turn expired. The battle has advanced to the next combatant.',
    )
  }
}
