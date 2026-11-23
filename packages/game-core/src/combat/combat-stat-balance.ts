import { combatStatusApplications } from './combat-status-applications'
import type { CombatEncounterState } from './actions'

type TerrainStatState = {
  statusState?: CombatEncounterState['statusState']
  effectStackingPolicyVersion?: 1
  statBalancePolicyVersion?: 1
  tactical: Pick<CombatEncounterState['tactical'], 'placements' | 'tiles'>
}

/** Position-derived policy values; never persisted as copyable/cleansable statuses. */
export function terrainEvasionBonusBasisPoints(
  state: TerrainStatState,
  targetId: string,
  targetElevation?: number | null,
): number {
  if (state.statBalancePolicyVersion !== 1) return 0
  const height = combatantElevation(state, targetId)
  if (targetElevation !== undefined && targetElevation !== null && targetElevation >= height)
    return 0
  return height === 1 ? 1_500 : height === 2 ? 2_000 : height >= 3 ? 2_500 : 0
}

/** Terrain markers describe elevation alone, independently of status-composed defense. */
export function terrainDefenseReductionBasisPoints(
  state: TerrainStatState,
  targetId: string,
): number {
  return state.statBalancePolicyVersion === 1 && combatantElevation(state, targetId) > 0 ? 2000 : 0
}

export function terrainAdjustedDefense(
  state: TerrainStatState,
  targetId: string,
  defense: number,
): number {
  for (const status of state.statusState?.find((row) => row.combatantId === targetId)?.statuses ??
    []) {
    if (status.statusId !== 'fortified' || status.timingState === 'pending') continue
    for (const application of state.effectStackingPolicyVersion === 1
      ? combatStatusApplications(status)
      : [status]) {
      if (application.defenseIncreaseBasisPoints === undefined) continue
      for (let stack = 0; stack < application.stacks; stack++) {
        const scaled =
          (BigInt(defense) * BigInt(10000 + application.defenseIncreaseBasisPoints)) / 10000n
        if (scaled > BigInt(Number.MAX_SAFE_INTEGER))
          throw new RangeError('Fortified defense exceeds safe range.')
        if (Number(scaled) === defense) break
        defense = Number(scaled)
      }
    }
  }
  const terrainReduction = terrainDefenseReductionBasisPoints(state, targetId)
  return terrainReduction > 0 ? Math.floor((defense * (10000 - terrainReduction)) / 10000) : defense
}

function combatantElevation(state: TerrainStatState, combatantId: string): number {
  const placement = state.tactical.placements.find((row) => row.combatantId === combatantId)
  if (!placement) return 0
  return (
    state.tactical.tiles.find(
      (tile) =>
        tile.position.x === placement.position.x && tile.position.y === placement.position.y,
    )?.elevation ?? 0
  )
}
