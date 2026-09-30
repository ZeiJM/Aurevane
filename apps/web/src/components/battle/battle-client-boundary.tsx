'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleRouteFrame } from './battle-route-frame'

import { BattleChatEmojiPolish } from './battle-chat-emoji-polish'
import { pvpParticipantAccent } from './battle-combatant-colors'
import { BattleExperience } from './battle-experience'
import { BattlefieldPresentationBundle } from './battlefield-presentation-bundle'
import { BattleHeaderMatchMessage } from './battle-header-message-cycle'
import { BattleInteractionLifecycleProvider } from './battle-interaction-lifecycle'
import { BattleInspectTerrainContext } from './battle-inspect-terrain-context'
import { BattleMobileTokenMeters } from './battle-mobile-token-meters'
import { buildBattleViewModel, type BattleRuntime } from './battle-runtime'
import { BattleRuntimeProvider } from './battle-runtime-context'
import { BattleStatusEffectAssist } from './battle-status-effect-assist'

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

  return (
    <BattleRouteFrame sessionHref={`/game/battle/${initialBattle.battleSessionId}`}>
      <BattleRuntimeProvider
        playerName={runtime.playerName}
        combatantAccents={combatantAccents}
        opponentNames={viewModel.participants
          .filter((participant) => participant.teamIndex !== viewModel.localParticipant?.teamIndex)
          .map((participant) => participant.name)}
      >
        <BattleInteractionLifecycleProvider>
          <BattleExperience
            key={initialBattle.battleVersion}
            initialBattle={initialBattle}
            runtime={runtime}
          />

          <BattlefieldPresentationBundle
            battleSessionId={initialBattle.battleSessionId}
            initialVersion={initialBattle.battleVersion}
            mode={runtime.kind}
            playerName={runtime.kind === 'pve' ? runtime.playerName : undefined}
            combatantAccents={combatantAccents}
          />
          <BattleMobileTokenMeters initialBattle={initialBattle} combatantNames={combatantNames} />
          <BattleHeaderMatchMessage battleSessionId={initialBattle.battleSessionId} />
          <BattleChatEmojiPolish />
          <BattleStatusEffectAssist />
          <BattleInspectTerrainContext />

          {runtime.kind === 'pve' ? (
            <BattlePveEnhancements initialBattle={initialBattle} runtime={runtime} />
          ) : (
            <BattlePvpEnhancements initialBattle={initialBattle} runtime={runtime} />
          )}
        </BattleInteractionLifecycleProvider>
      </BattleRuntimeProvider>
    </BattleRouteFrame>
  )
}
