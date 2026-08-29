'use client'

import { getTacticalHallRecordFromScenarioSourceId } from '@aurevane/game-core/combat/tactical-hall-records'

import type { ImageAssetId } from '@/media/registry'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { AiBattlePvpVisualSync } from './ai-battle-pvp-visual-sync'
import { AiBattleQualityControls } from './ai-battle-quality-controls'
import { AiBattleSurrenderAssist } from './ai-battle-surrender-assist'
import { AiCockpitPvpButtonFormat } from './ai-cockpit-pvp-button-format'
import { AiDesktopCombatantRailPolish } from './ai-desktop-combatant-rail-polish'
import { AiDesktopSameFacingKeyboardAssist } from './ai-desktop-same-facing-keyboard-assist'
import { AiNativeTerrainLegend } from './ai-native-terrain-legend'
import { BattleChatEmojiPolish } from './battle-chat-emoji-polish'
import { BattleCommandCockpitPolish } from './battle-command-cockpit-polish'
import { BattleDirectionalAttackAssist } from './battle-directional-attack-assist'
import { BattleExperienceV2 } from './battle-experience-v2'
import { BattleFacingQuickCommitAssist } from './battle-facing-quick-commit-assist'
import { BattleFeedbackAssist } from './battle-feedback-assist'
import { BattleHeaderMatchMessage } from './battle-header-message-cycle'
import { BattleKeyboardAssist } from './battle-keyboard-assist'
import { BattleLessonCoach } from './battle-lesson-coach'
import { BattleMapTokenPolish } from './battle-map-token-polish'
import { BattlePresentationPolish } from './battle-presentation-polish'
import { BattleRecruitRecoveryAssist } from './battle-recruit-recovery-assist'
import { BattleRuntimeProvider } from './battle-runtime-context'
import { BattleScreenVisualContract } from './battle-screen-visual-contract'
import { BattleStatusEffectAssist } from './battle-status-effect-assist'
import { BattleStickyActionAssist } from './battle-sticky-action-assist'
import { BattleTerrainPresentationPolish } from './battle-terrain-presentation-polish'
import { BattleUtilityWindows } from './battle-utility-windows'
import { DesktopBattleCombatantInspect } from './desktop-battle-combatant-inspect'
import { DesktopBattleLogDock } from './desktop-battle-log-dock'
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
        key={initialBattle.battleVersion}
        initialBattle={initialBattle}
        playerName={playerName}
        playerPortraitAssetId={playerPortraitAssetId}
      />
      <AiNativeTerrainLegend />
      <BattleTerrainPresentationPolish />
      <AiBattlePvpVisualSync playerName={playerName} />
      <AiDesktopCombatantRailPolish playerName={playerName} />
      <AiBattleQualityControls battleSessionId={initialBattle.battleSessionId} playerName={playerName} />
      <AiBattleSurrenderAssist battleSessionId={initialBattle.battleSessionId} />
      {lessonActive ? (
        <BattleLessonCoach
          battleSessionId={initialBattle.battleSessionId}
          recordId={battleHallRecord?.id ?? 'recruit-sparring'}
        />
      ) : null}
      <BattleDirectionalAttackAssist playerName={playerName} />
      <BattleMapTokenPolish playerName={playerName} />
      <BattlePresentationPolish playerName={playerName} />
      <BattleScreenVisualContract />
      <BattleHeaderMatchMessage battleSessionId={initialBattle.battleSessionId} />
      <BattleChatEmojiPolish />
      <BattleFacingQuickCommitAssist playerName={playerName} />
      <BattleStatusEffectAssist />
      <DesktopBattleCombatantInspect
        battleSessionId={initialBattle.battleSessionId}
        playerName={playerName}
        playerPortraitAssetId={playerPortraitAssetId}
        playerProfileImageUrl={playerProfileImageUrl}
      />
      <BattleStickyActionAssist />
      <BattleRecruitRecoveryAssist />
      <AiDesktopSameFacingKeyboardAssist playerName={playerName} />
      <BattleKeyboardAssist playerName={playerName} />
      <BattleCommandCockpitPolish />
      <AiCockpitPvpButtonFormat />
      <BattleFeedbackAssist playerName={playerName} playerProfileImageUrl={playerProfileImageUrl} />
      <BattleUtilityWindows
        battleSessionId={initialBattle.battleSessionId}
        playerName={playerName}
      />
      <DesktopBattleLogDock
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
