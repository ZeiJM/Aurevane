'use client'

import { getTacticalHallRecordFromScenarioSourceId } from '@aurevane/game-core/combat/tactical-hall-records'

import type { ImageAssetId } from '@/media/registry'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleDirectionalAttackAssist } from './battle-directional-attack-assist'
import { BattleExperienceV2 } from './battle-experience-v2'
import { BattleFeedbackAssist } from './battle-feedback-assist'
import { BattleKeyboardAssist } from './battle-keyboard-assist'
import { BattleLessonCoach } from './battle-lesson-coach'
import { BattleRuntimeProvider } from './battle-runtime-context'
import { BattleUtilityWindows } from './battle-utility-windows'
import { MobileBattleCombatantPopup } from './mobile-battle-combatant-popup'

interface BattleSessionClientBoundaryProps {
  initialBattle: BattleSessionView
  playerName: string
  playerPortraitAssetId: ImageAssetId
  playerProfileImageUrl?: string | null
}

export function BattleSessionClientBoundary({
  initialBattle,
  playerName,
  playerPortraitAssetId,
  playerProfileImageUrl = null,
}: BattleSessionClientBoundaryProps) {
  const scenario = initialBattle.snapshot.statBridge.combatants.find(
    (profile) => profile.provenance.kind === 'scenario',
  )
  const battleHallRecord = scenario
    ? getTacticalHallRecordFromScenarioSourceId(scenario.provenance.sourceId)
    : null
  const lessonActive = initialBattle.snapshot.tactical.battle.lifecycle === 'active'

  return (
    <BattleRuntimeProvider playerName={playerName}>
      <BattleExperienceV2
        initialBattle={initialBattle}
        playerName={playerName}
        playerPortraitAssetId={playerPortraitAssetId}
      />
      {lessonActive ? (
        <BattleLessonCoach
          battleSessionId={initialBattle.battleSessionId}
          recordId={battleHallRecord?.id ?? 'recruit-sparring'}
        />
      ) : null}
      <BattleDirectionalAttackAssist playerName={playerName} />
      <BattleKeyboardAssist playerName={playerName} />
      <BattleFeedbackAssist playerName={playerName} playerProfileImageUrl={playerProfileImageUrl} />
      <BattleUtilityWindows
        battleSessionId={initialBattle.battleSessionId}
        playerName={playerName}
      />
      <MobileBattleCombatantPopup
        battleSessionId={initialBattle.battleSessionId}
        playerName={playerName}
        playerPortraitAssetId={playerPortraitAssetId}
        playerProfileImageUrl={playerProfileImageUrl}
      />
    </BattleRuntimeProvider>
  )
}
