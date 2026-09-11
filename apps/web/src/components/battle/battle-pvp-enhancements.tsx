'use client'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleStabilizationPolish } from './battle-stabilization-polish'
import type { BattleRuntime } from './battle-runtime'
import { DesktopBattleCombatantInspect } from './desktop-battle-combatant-inspect'
import { PvpBattleChatBridge } from './pvp-battle-chat-bridge'
import { PvpBattleCompletionPanel } from './pvp-battle-completion-panel'
import { PvpBattleInspectPopup } from './pvp-battle-inspect-popup'
import { PvpBattleKeyboardAssist } from './pvp-battle-keyboard-assist'
import { PvpBattleQualityControls } from './pvp-battle-quality-controls'
import { PvpBattleReleasePolish } from './pvp-battle-release-polish'

type PvpRuntime = Extract<BattleRuntime, { kind: 'pvp' }>

export function BattlePvpEnhancements({
  initialBattle,
  runtime,
}: {
  initialBattle: BattleSessionView
  runtime: PvpRuntime
}) {
  return (
    <>
      <PvpBattleReleasePolish />
      <PvpBattleKeyboardAssist playerName={runtime.playerName} />
      <PvpBattleChatBridge
        battleSessionId={initialBattle.battleSessionId}
        metadata={runtime.metadata}
      />
      <PvpBattleQualityControls
        battleSessionId={initialBattle.battleSessionId}
        initialBattle={initialBattle}
        metadata={runtime.metadata}
      />
      <PvpBattleInspectPopup
        battleSessionId={initialBattle.battleSessionId}
        metadata={runtime.metadata}
      />
      <PvpBattleCompletionPanel initialBattle={initialBattle} metadata={runtime.metadata} />
      <BattleStabilizationPolish />
      <DesktopBattleCombatantInspect
        battleSessionId={initialBattle.battleSessionId}
        playerName={runtime.playerName}
        pvpMetadata={runtime.metadata}
      />
    </>
  )
}
