'use client'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleDirectionalAttackAssist } from './battle-directional-attack-assist'
import { BattleMapTokenPolish } from './battle-map-token-polish'
import { BattlePresentationPolish } from './battle-presentation-polish'
import { BattleUtilityWindows } from './battle-utility-windows'
import { PvpBattleChatBridge } from './pvp-battle-chat-bridge'
import { PvpBattleCompletionPanel } from './pvp-battle-completion-panel'
import { PvpBattleExperience } from './pvp-battle-experience'
import { PvpBattleInspectPopup } from './pvp-battle-inspect-popup'
import { PvpBattleQualityControls } from './pvp-battle-quality-controls'
import { PvpLegacyResultSuppressor } from './pvp-legacy-result-suppressor'
import { PvpQuickCommitAssist } from './pvp-quick-commit-assist'

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
      <PvpLegacyResultSuppressor />
      <BattleDirectionalAttackAssist playerName={playerName} />
      <BattleMapTokenPolish />
      <BattlePresentationPolish playerName={playerName} pvpMetadata={metadata} />
      <PvpQuickCommitAssist />
      <PvpBattleChatBridge battleSessionId={initialBattle.battleSessionId} metadata={metadata} />
      <PvpBattleQualityControls
        battleSessionId={initialBattle.battleSessionId}
        metadata={metadata}
      />
      <PvpBattleInspectPopup battleSessionId={initialBattle.battleSessionId} metadata={metadata} />
      <PvpBattleCompletionPanel initialBattle={initialBattle} metadata={metadata} />
      <BattleUtilityWindows
        battleSessionId={initialBattle.battleSessionId}
        playerName={playerName}
      />
    </>
  )
}
