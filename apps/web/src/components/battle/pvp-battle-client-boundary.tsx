'use client'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleDirectionalAttackAssist } from './battle-directional-attack-assist'
import { BattleMapTokenPolish } from './battle-map-token-polish'
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
      <BattleDirectionalAttackAssist playerName={playerName} />
      <BattleMapTokenPolish />
      <BattleUtilityWindows
        battleSessionId={initialBattle.battleSessionId}
        playerName={playerName}
      />
    </>
  )
}
