'use client'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import type { BattleRuntime } from './battle-runtime'
import { DesktopBattleCombatantInspect } from './desktop-battle-combatant-inspect'
import { PvpBattleChatBridge } from './pvp-battle-chat-bridge'
import { PvpBattleCompletionPanel } from './pvp-battle-completion-panel'
import { PvpBattleInspectPopup } from './pvp-battle-inspect-popup'
import { PvpBattleQualityControls } from './pvp-battle-quality-controls'

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
      <DesktopBattleCombatantInspect
        battleSessionId={initialBattle.battleSessionId}
        playerName={runtime.playerName}
        pvpMetadata={runtime.metadata}
      />
    </>
  )
}
