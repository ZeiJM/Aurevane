'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleChatEmojiPolish } from './battle-chat-emoji-polish'
import { BattleCockpitLayoutStabilizer } from './battle-cockpit-layout-stabilizer'
import { BattleCommandCockpitPolish } from './battle-command-cockpit-polish'
import { pvpParticipantAccent } from './battle-combatant-colors'
import { BattleDirectionalAttackAssist } from './battle-directional-attack-assist'
import { BattleExperience } from './battle-experience'
import { BattleFacingQuickCommitAssist } from './battle-facing-quick-commit-assist'
import { BattleFavoriteTechniqueAssist } from './battle-favorite-technique-assist'
import { BattlefieldPresentationBundle } from './battlefield-presentation-bundle'
import { BattleFinishTurnKeyboardAssist } from './battle-finish-turn-keyboard-assist'
import { BattleHeaderMatchMessage } from './battle-header-message-cycle'
import { BattleInteractionLifecycleProvider } from './battle-interaction-lifecycle'
import { BattleInspectTerrainContext } from './battle-inspect-terrain-context'
import { BattleMobileTokenMeters } from './battle-mobile-token-meters'
import { BattleMovementKeyboardAssist } from './battle-movement-keyboard-assist'
import { BattlePresentationPolish } from './battle-presentation-polish'
import { buildBattleViewModel, type BattleRuntime } from './battle-runtime'
import { BattleRuntimeProvider } from './battle-runtime-context'
import { BattleScreenVisualContract } from './battle-screen-visual-contract'
import { BattleSelfActionQuickCommitAssist } from './battle-self-action-quick-commit-assist'
import { BattleStatusEffectAssist } from './battle-status-effect-assist'
import { BattleStickyActionAssist } from './battle-sticky-action-assist'
import { DesktopBattleLogDock } from './desktop-battle-log-dock'
import { PvpQuickCommitAssist } from './pvp-quick-commit-assist'

const BattlePveEnhancements = dynamic(() =>
  import('./battle-pve-enhancements').then((module) => module.BattlePveEnhancements),
)
const BattlePvpEnhancements = dynamic(() =>
  import('./battle-pvp-enhancements').then((module) => module.BattlePvpEnhancements),
)

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
  const localCharacterId = viewModel.localParticipant?.characterId ?? null

  return (
    <BattleRuntimeProvider playerName={runtime.playerName} combatantAccents={combatantAccents}>
      <BattleInteractionLifecycleProvider>
        <BattleMovementKeyboardAssist playerName={runtime.playerName} />
        <BattleSelfActionQuickCommitAssist />
        <BattleFinishTurnKeyboardAssist playerName={runtime.playerName} />
        <BattleExperience
          key={initialBattle.battleVersion}
          initialBattle={initialBattle}
          runtime={runtime}
        />
        <BattleFavoriteTechniqueAssist characterId={localCharacterId} />

        <BattlefieldPresentationBundle
          battleSessionId={initialBattle.battleSessionId}
          initialVersion={initialBattle.battleVersion}
          mode={runtime.kind}
          playerName={runtime.kind === 'pve' ? runtime.playerName : undefined}
          combatantAccents={combatantAccents}
        />
        <BattleDirectionalAttackAssist playerName={runtime.playerName} />
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
          <BattlePveEnhancements initialBattle={initialBattle} runtime={runtime} />
        ) : (
          <BattlePvpEnhancements initialBattle={initialBattle} runtime={runtime} />
        )}

        <DesktopBattleLogDock
          battleSessionId={initialBattle.battleSessionId}
          playerName={runtime.playerName}
          combatantNames={combatantNames}
          eventDriven={runtime.kind === 'pvp'}
        />
        <BattleScreenVisualContract />
      </BattleInteractionLifecycleProvider>
    </BattleRuntimeProvider>
  )
}
