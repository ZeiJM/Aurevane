import {
  terrainAdjustedDefense,
  terrainEvasionBonusBasisPoints,
} from '@aurevane/game-core/combat/combat-stat-balance'
import { airborneJump } from '@aurevane/game-core/combat/combat-airborne'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import type { CombatEncounterState } from '@aurevane/game-core/combat/actions'
import {
  terrainBattleEffectPresentation,
  TERRAIN_EVASION_STATUS_ID,
  type BattlePresentedStatus,
} from './battle-elevation-effects'

export function terrainAdjustedBattleProfile<
  T extends { armor: number; ward: number; evasion: number; jump?: number },
>(
  state: Parameters<typeof terrainEvasionBonusBasisPoints>[0] &
    Partial<
      Pick<CombatEncounterState, 'statusState' | 'effectState' | 'airborneJumpPolicyVersion'>
    >,
  combatantId: string,
  profile: T | null,
  viewerStatuses?: readonly BattlePresentedStatus[],
): T | null {
  if (!profile) return null
  const visibleDefenseState = {
    ...state,
    statusState:
      viewerStatuses === undefined
        ? state.statusState
        : [{ combatantId, statuses: viewerStatuses }],
  }
  const evasionVisible =
    viewerStatuses === undefined ||
    viewerStatuses.some(
      (status) =>
        status.statusId === TERRAIN_EVASION_STATUS_ID &&
        terrainBattleEffectPresentation(status) !== null,
    )
  return {
    ...profile,
    ...(typeof profile.jump === 'number'
      ? {
          jump: airborneJump(
            {
              ...state,
              statusState:
                viewerStatuses === undefined
                  ? (state.statusState ?? [])
                  : [{ combatantId, statuses: viewerStatuses }],
            },
            combatantId,
            profile.jump,
            PV1F_COMBAT_CONTENT,
          ),
        }
      : {}),
    evasion:
      profile.evasion + (evasionVisible ? terrainEvasionBonusBasisPoints(state, combatantId) : 0),
    armor: terrainAdjustedDefense(visibleDefenseState, combatantId, profile.armor),
    ward: terrainAdjustedDefense(visibleDefenseState, combatantId, profile.ward),
  }
}

export function visibleBattleInitiative(
  state: {
    dynamicInitiativePolicyVersion?: 1
    elementalDamagePolicyVersion?: 1 | 2
    tactical?: {
      battle: { roundInitiativeModifiers?: readonly { combatantId: string; amount: number }[] }
    }
  },
  combatant: { initiative: number; id?: string },
  statuses: readonly BattlePresentedStatus[],
): number {
  const normal =
    combatant.initiative +
    (state.tactical?.battle.roundInitiativeModifiers?.find(
      (row) => row.combatantId === combatant.id,
    )?.amount ?? 0)
  if (state.dynamicInitiativePolicyVersion !== 1) return normal
  const applications = statuses
    .filter((status) => status.statusId === 'wet' && status.timingState !== 'pending')
    .flatMap((status) => status.applicationModifiers ?? [status])
  if (!applications.length) return normal
  if (
    state.elementalDamagePolicyVersion !== 2 &&
    !applications.some((row) => row.initiativeReductionBasisPoints !== undefined)
  )
    return normal - Math.ceil(normal / 10)
  const reduction = applications.reduce(
    (sum, row) =>
      Math.min(
        10000,
        sum + Math.min(10000, row.stacks * (row.initiativeReductionBasisPoints ?? 1000)),
      ),
    0,
  )
  return normal - Math.ceil((normal * reduction) / 10000)
}
