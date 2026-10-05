import {
  terrainAdjustedDefense,
  terrainEvasionBonusBasisPoints,
} from '@aurevane/game-core/combat/combat-stat-balance'
import {
  terrainBattleEffectPresentation,
  TERRAIN_EVASION_STATUS_ID,
  type BattlePresentedStatus,
} from './battle-elevation-effects'

export function terrainAdjustedBattleProfile<
  T extends { armor: number; ward: number; evasion: number },
>(
  state: Parameters<typeof terrainEvasionBonusBasisPoints>[0],
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
    evasion:
      profile.evasion + (evasionVisible ? terrainEvasionBonusBasisPoints(state, combatantId) : 0),
    armor: terrainAdjustedDefense(state, combatantId, profile.armor),
    ward: terrainAdjustedDefense(state, combatantId, profile.ward),
  }
}
