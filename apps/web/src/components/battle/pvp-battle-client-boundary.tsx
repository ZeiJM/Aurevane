'use client'

import { useMemo } from 'react'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleChatEmojiPolish } from './battle-chat-emoji-polish'
import { BattleCommandCockpitPolish } from './battle-command-cockpit-polish'
import { BattleDirectionalAttackAssist } from './battle-directional-attack-assist'
import { BattleFacingQuickCommitAssist } from './battle-facing-quick-commit-assist'
import { BattleHeaderMatchMessage } from './battle-header-message-cycle'
import { BattleMapTokenPolish } from './battle-map-token-polish'
import { BattlePresentationPolish } from './battle-presentation-polish'
import { BattleStabilizationPolish } from './battle-stabilization-polish'
import { BattleStatusEffectAssist } from './battle-status-effect-assist'
import { BattleStickyActionAssist } from './battle-sticky-action-assist'
import { DesktopBattleCombatantInspect } from './desktop-battle-combatant-inspect'
import { DesktopBattleLogDock } from './desktop-battle-log-dock'
import { PvpBattleChatBridge } from './pvp-battle-chat-bridge'
import { PvpBattleCompletionPanel } from './pvp-battle-completion-panel'
import { PvpBattleExperience } from './pvp-battle-experience'
import { PvpBattleInspectPopup } from './pvp-battle-inspect-popup'
import { PvpBattleKeyboardAssist } from './pvp-battle-keyboard-assist'
import { PvpBattleQualityControls } from './pvp-battle-quality-controls'
import { PvpBattleReleasePolish } from './pvp-battle-release-polish'
import { PvpLegacyResultSuppressor } from './pvp-legacy-result-suppressor'
import { PvpMobileCommandParity } from './pvp-mobile-command-parity'
import { PvpQuickCommitAssist } from './pvp-quick-commit-assist'
import { PvpDesktopParity } from './pvp-desktop-parity'
import { PvpSixCombatantRails } from './pvp-six-combatant-rails'

export function PvpBattleClientBoundary({
  initialBattle,
  metadata,
  playerName,
}: {
  initialBattle: BattleSessionView
  metadata: PvpBattleMetadata
  playerName: string
}) {
  const combatantNames = useMemo(
    () =>
      Object.fromEntries(
        metadata.participants.map((participant) => [
          participant.combatantId,
          participant.characterName,
        ]),
      ),
    [metadata.participants],
  )

  return (
    <>
      <PvpBattleExperience
        key={initialBattle.battleVersion}
        initialBattle={initialBattle}
        metadata={metadata}
      />
      <PvpDesktopParity initialBattle={initialBattle} metadata={metadata} />
      <PvpSixCombatantRails initialBattle={initialBattle} metadata={metadata} />
      <PvpBattleReleasePolish />
      <PvpLegacyResultSuppressor />
      <BattleDirectionalAttackAssist playerName={playerName} />
      <BattleMapTokenPolish />
      <BattlePresentationPolish playerName={playerName} pvpMetadata={metadata} />
      <BattleHeaderMatchMessage battleSessionId={initialBattle.battleSessionId} />
      <BattleChatEmojiPolish />
      <BattleFacingQuickCommitAssist playerName={playerName} />
      <BattleStatusEffectAssist />
      <DesktopBattleCombatantInspect
        battleSessionId={initialBattle.battleSessionId}
        playerName={playerName}
        pvpMetadata={metadata}
      />
      <BattleStickyActionAssist />
      <PvpBattleKeyboardAssist playerName={playerName} />
      <PvpQuickCommitAssist />
      <PvpBattleChatBridge battleSessionId={initialBattle.battleSessionId} metadata={metadata} />
      <DesktopBattleLogDock
        battleSessionId={initialBattle.battleSessionId}
        playerName={playerName}
        combatantNames={combatantNames}
        eventDriven
      />
      <PvpBattleQualityControls
        battleSessionId={initialBattle.battleSessionId}
        initialBattle={initialBattle}
        metadata={metadata}
      />
      <PvpBattleInspectPopup battleSessionId={initialBattle.battleSessionId} metadata={metadata} />
      <PvpBattleCompletionPanel initialBattle={initialBattle} metadata={metadata} />
      <BattleCommandCockpitPolish />
      <PvpMobileCommandParity />
      <BattleStabilizationPolish />
    </>
  )
}
