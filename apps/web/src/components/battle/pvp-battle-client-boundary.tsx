'use client'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleUtilityWindows } from './battle-utility-windows'
import { PvpBattleExperience } from './pvp-battle-experience'

export function PvpBattleClientBoundary({
  initialBattle,
  metadata,
  playerName,
}: {
  initialBattle: BattleSessionView
  metadata: PvpBattleMetadata
  playerName: string
}) {
  return (
    <>
      <PvpBattleExperience initialBattle={initialBattle} metadata={metadata} />
      <BattleUtilityWindows
        battleSessionId={initialBattle.battleSessionId}
        playerName={playerName}
      />
    </>
  )
}
