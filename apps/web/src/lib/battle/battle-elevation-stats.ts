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
    armor: terrainAdjustedDefense(state, combatantId, profile.armor),
    ward: terrainAdjustedDefense(state, combatantId, profile.ward),
  }
}
