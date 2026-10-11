import type { BattleViewModel } from './battle-runtime'

export type BattleAllyInspection = { combatantId: string; battleVersion: number }

export function selectBattleCombatantRails({
  viewModel,
  battleVersion,
  allyInspection,
  selectedUnitId,
  inspectedEnemyUnitId,
}: {
  viewModel: BattleViewModel
  battleVersion: number
  allyInspection: BattleAllyInspection | null
  selectedUnitId: string | null
  inspectedEnemyUnitId: string | null
}) {
  const localTeamIndex = viewModel.localTeamIndex ?? -1
  const enemy =
    [inspectedEnemyUnitId, selectedUnitId]
      .map((id) => viewModel.participantByCombatant.get(id ?? ''))
      .find((participant) => participant && participant.teamIndex !== localTeamIndex) ??
    viewModel.participants.find((participant) => participant.teamIndex !== localTeamIndex) ??
    null
  const inspectedAlly =
    allyInspection?.battleVersion === battleVersion
      ? viewModel.participantByCombatant.get(allyInspection.combatantId)
      : null
  const local =
    inspectedAlly && viewModel.localParticipant && inspectedAlly.teamIndex === localTeamIndex
      ? inspectedAlly
      : viewModel.localParticipant
  return { local, enemy }
}
