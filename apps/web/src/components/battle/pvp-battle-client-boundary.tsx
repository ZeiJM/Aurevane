'use client'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleDirectionalAttackAssist } from './battle-directional-attack-assist'
import { BattleMapTokenPolish } from './battle-map-token-polish'
import { BattlePresentationPolish } from './battle-presentation-polish'
import { BattleUtilityWindows } from './battle-utility-windows'
import { PvpBattleCombatantPanels } from './pvp-battle-combatant-panels'
import { PvpBattleExperience } from './pvp-battle-experience'
import { PvpBattleQualityControls } from './pvp-battle-quality-controls'

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
      <BattlePresentationPolish playerName={playerName} pvpMetadata={metadata} />
      <PvpBattleQualityControls
        battleSessionId={initialBattle.battleSessionId}
        metadata={metadata}
      />
      <PvpBattleCombatantPanels initialBattle={initialBattle} metadata={metadata} />
      <BattleUtilityWindows
        battleSessionId={initialBattle.battleSessionId}
        playerName={playerName}
      />
    </>
  )
}
