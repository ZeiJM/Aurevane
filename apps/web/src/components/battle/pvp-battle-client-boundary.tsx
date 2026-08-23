'use client'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleDirectionalAttackAssist } from './battle-directional-attack-assist'
import { BattleFacingQuickCommitAssist } from './battle-facing-quick-commit-assist'
import { BattleMapTokenPolish } from './battle-map-token-polish'
import { BattlePresentationPolish } from './battle-presentation-polish'
import { BattleStatusEffectAssist } from './battle-status-effect-assist'
import { BattleStickyActionAssist } from './battle-sticky-action-assist'
import { PvpBattleChatBridge } from './pvp-battle-chat-bridge'
import { PvpBattleCompletionPanel } from './pvp-battle-completion-panel'
import { PvpBattleExperience } from './pvp-battle-experience'
import { PvpBattleInspectPopup } from './pvp-battle-inspect-popup'
import { PvpBattleKeyboardAssist } from './pvp-battle-keyboard-assist'
import { PvpBattleQualityControls } from './pvp-battle-quality-controls'
import { PvpDesktopParity } from './pvp-desktop-parity'
import { PvpBattleReleasePolish } from './pvp-battle-release-polish'
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
      <PvpBattleExperience
        key={initialBattle.battleVersion}
        initialBattle={initialBattle}
        metadata={metadata}
      />
      <PvpDesktopParity initialBattle={initialBattle} metadata={metadata} />
      <PvpBattleReleasePolish />
      <PvpLegacyResultSuppressor />
      <BattleDirectionalAttackAssist playerName={playerName} />
      <BattleMapTokenPolish />
      <BattlePresentationPolish playerName={playerName} pvpMetadata={metadata} />
      <BattleFacingQuickCommitAssist playerName={playerName} />
      <BattleStatusEffectAssist />
      <BattleStickyActionAssist />
      <PvpBattleKeyboardAssist playerName={playerName} />
      <PvpQuickCommitAssist />
      <PvpBattleChatBridge battleSessionId={initialBattle.battleSessionId} metadata={metadata} />
      <PvpBattleQualityControls
        battleSessionId={initialBattle.battleSessionId}
        initialBattle={initialBattle}
        metadata={metadata}
      />
      <PvpBattleInspectPopup battleSessionId={initialBattle.battleSessionId} metadata={metadata} />
      <PvpBattleCompletionPanel initialBattle={initialBattle} metadata={metadata} />
    </>
  )
}
