'use client'

import { getTacticalHallRecordFromScenarioSourceId } from '@aurevane/game-core/combat/tactical-hall-records'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { AiBattleQualityControls } from './ai-battle-quality-controls'
import { BattleFeedbackAssist } from './battle-feedback-assist'
import { BattleKeyboardAssist } from './battle-keyboard-assist'
import { BattleLessonCoach } from './battle-lesson-coach'
import { BattleLessonCoachSemantics } from './battle-lesson-coach-semantics'
import { BattlePveCommandContextParity } from './battle-pve-command-context-parity'
import { BattleRecruitRecoveryAssist } from './battle-recruit-recovery-assist'
import type { BattleRuntime } from './battle-runtime'
import { BattleUtilityWindows } from './battle-utility-windows'
import { DesktopBattleCombatantInspect } from './desktop-battle-combatant-inspect'
import { MobileBattleCombatantPopup } from './mobile-battle-combatant-popup'
import { PveBattleCompletionBridge } from './pve-battle-completion-bridge'

type PveRuntime = Extract<BattleRuntime, { kind: 'pve' }>

export function BattlePveEnhancements({
  initialBattle,
  runtime,
}: {
  initialBattle: BattleSessionView
  runtime: PveRuntime
}) {
  const scenario = initialBattle.snapshot.statBridge.combatants.find(
    (profile) => profile.provenance.kind === 'scenario',
  )
  const battleHallRecord = scenario
    ? getTacticalHallRecordFromScenarioSourceId(scenario.provenance.sourceId)
    : null
  const lessonActive = initialBattle.snapshot.tactical.battle.lifecycle === 'active'

  return (
    <>
      <AiBattleQualityControls
        battleSessionId={initialBattle.battleSessionId}
        playerName={runtime.playerName}
      />
      <BattlePveCommandContextParity />
      <BattleLessonCoachSemantics />
      {lessonActive ? (
        <BattleLessonCoach
          battleSessionId={initialBattle.battleSessionId}
          recordId={battleHallRecord?.id ?? 'recruit-sparring'}
        />
      ) : null}
      <PveBattleCompletionBridge initialBattle={initialBattle} />
      <DesktopBattleCombatantInspect
        battleSessionId={initialBattle.battleSessionId}
        playerName={runtime.playerName}
        playerPortraitAssetId={runtime.playerPortraitAssetId}
        playerProfileImageUrl={runtime.playerProfileImageUrl}
      />
      <BattleRecruitRecoveryAssist />
      <BattleKeyboardAssist playerName={runtime.playerName} />
      <BattleFeedbackAssist
        playerName={runtime.playerName}
        playerProfileImageUrl={runtime.playerProfileImageUrl}
      />
      <BattleUtilityWindows
        battleSessionId={initialBattle.battleSessionId}
        playerName={runtime.playerName}
      />
      <MobileBattleCombatantPopup
        battleSessionId={initialBattle.battleSessionId}
        playerName={runtime.playerName}
        playerPortraitAssetId={runtime.playerPortraitAssetId}
        playerProfileImageUrl={runtime.playerProfileImageUrl}
      />
    </>
  )
}
