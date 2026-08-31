'use client'

import { getTacticalHallRecordFromScenarioSourceId } from '@aurevane/game-core/combat/tactical-hall-records'
import { useMemo } from 'react'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { AiBattleQualityControls } from './ai-battle-quality-controls'
import { AiDesktopSameFacingKeyboardAssist } from './ai-desktop-same-facing-keyboard-assist'
import { BattleChatEmojiPolish } from './battle-chat-emoji-polish'
import { BattleCockpitLayoutStabilizer } from './battle-cockpit-layout-stabilizer'
import { BattleCommandCockpitPolish } from './battle-command-cockpit-polish'
import { pvpParticipantAccent } from './battle-combatant-colors'
import { BattleCoordinateToggle } from './battle-coordinate-toggle'
import { BattleDirectionalAttackAssist } from './battle-directional-attack-assist'
import { BattleExperience } from './battle-experience'
import { BattleFacingQuickCommitAssist } from './battle-facing-quick-commit-assist'
import { BattleFeedbackAssist } from './battle-feedback-assist'
import { BattleHeaderMatchMessage } from './battle-header-message-cycle'
import { BattleInspectTerrainContext } from './battle-inspect-terrain-context'
import { BattleKeyboardAssist } from './battle-keyboard-assist'
import { BattleLessonCoach } from './battle-lesson-coach'
import { BattleLessonCoachSemantics } from './battle-lesson-coach-semantics'
import { BattleMapTokenPolish } from './battle-map-token-polish'
import { BattleMobileTokenMeters } from './battle-mobile-token-meters'
import { BattlePresentationPolish } from './battle-presentation-polish'
import { BattlePveCommandContextParity } from './battle-pve-command-context-parity'
import { BattleRecruitRecoveryAssist } from './battle-recruit-recovery-assist'
import { buildBattleViewModel, type BattleRuntime } from './battle-runtime'
import { BattleRuntimeProvider } from './battle-runtime-context'
import { BattleScreenVisualContract } from './battle-screen-visual-contract'
import { BattleSelfActionQuickCommitAssist } from './battle-self-action-quick-commit-assist'
import { BattleStabilizationPolish } from './battle-stabilization-polish'
import { BattleStatusEffectAssist } from './battle-status-effect-assist'
import { BattleStickyActionAssist } from './battle-sticky-action-assist'
import { BattleTerrainPresentationPolish } from './battle-terrain-presentation-polish'
import { BattleUtilityWindows } from './battle-utility-windows'
import { DesktopBattleCombatantInspect } from './desktop-battle-combatant-inspect'
import { DesktopBattleLogDock } from './desktop-battle-log-dock'
import { MobileBattleCombatantPopup } from './mobile-battle-combatant-popup'
import { PveBattleCompletionBridge } from './pve-battle-completion-bridge'
import { PvpBattleChatBridge } from './pvp-battle-chat-bridge'
import { PvpBattleCompletionPanel } from './pvp-battle-completion-panel'
import { PvpBattleInspectPopup } from './pvp-battle-inspect-popup'
import { PvpBattleKeyboardAssist } from './pvp-battle-keyboard-assist'
import { PvpBattleQualityControls } from './pvp-battle-quality-controls'
import { PvpBattleReleasePolish } from './pvp-battle-release-polish'
import { PvpQuickCommitAssist } from './pvp-quick-commit-assist'

export function BattleClientBoundary({
  initialBattle,
  runtime,
}: {
  initialBattle: BattleSessionView
  runtime: BattleRuntime
}) {
  const viewModel = useMemo(
    () => buildBattleViewModel(initialBattle, runtime),
    [initialBattle, runtime],
  )
  const combatantNames = useMemo(
    () =>
      Object.fromEntries(
        viewModel.participants.map((participant) => [participant.combatantId, participant.name]),
      ),
    [viewModel.participants],
  )
  const combatantAccents = useMemo(
    () =>
      Object.fromEntries(
        viewModel.participants.map((participant) => [
          participant.name,
          pvpParticipantAccent(participant.teamIndex, participant.seatIndex, viewModel.teamCount),
        ]),
      ),
    [viewModel.participants, viewModel.teamCount],
  )
  const scenario = initialBattle.snapshot.statBridge.combatants.find(
    (profile) => profile.provenance.kind === 'scenario',
  )
  const battleHallRecord = scenario
    ? getTacticalHallRecordFromScenarioSourceId(scenario.provenance.sourceId)
    : null
  const lessonActive =
    runtime.kind === 'pve' && initialBattle.snapshot.tactical.battle.lifecycle === 'active'

  return (
    <BattleRuntimeProvider playerName={runtime.playerName} combatantAccents={combatantAccents}>
      <BattleExperience
        key={initialBattle.battleVersion}
        initialBattle={initialBattle}
        runtime={runtime}
      />

      <BattleTerrainPresentationPolish />
      <BattleCoordinateToggle />
      <BattleDirectionalAttackAssist playerName={runtime.playerName} />
      <BattleSelfActionQuickCommitAssist />
      <BattleMapTokenPolish playerName={runtime.kind === 'pve' ? runtime.playerName : undefined} />
      <BattleMobileTokenMeters initialBattle={initialBattle} combatantNames={combatantNames} />
      <BattlePresentationPolish
        playerName={runtime.playerName}
        pvpMetadata={runtime.kind === 'pvp' ? runtime.metadata : undefined}
      />
      <BattleHeaderMatchMessage battleSessionId={initialBattle.battleSessionId} />
      <BattleChatEmojiPolish />
      <BattleFacingQuickCommitAssist playerName={runtime.playerName} />
      <PvpQuickCommitAssist />
      <BattleStatusEffectAssist />
      <BattleStickyActionAssist />
      <BattleCommandCockpitPolish />
      <BattleCockpitLayoutStabilizer playerName={runtime.playerName} />
      <BattleInspectTerrainContext />

      {runtime.kind === 'pve' ? (
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
          <AiDesktopSameFacingKeyboardAssist playerName={runtime.playerName} />
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
      ) : (
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
      )}

      <DesktopBattleLogDock
        battleSessionId={initialBattle.battleSessionId}
        playerName={runtime.playerName}
        combatantNames={combatantNames}
        eventDriven={runtime.kind === 'pvp'}
      />
      <BattleScreenVisualContract />
    </BattleRuntimeProvider>
  )
}
