import type { CombatEncounterState } from './actions'

type TerrainStatState = {
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

export function terrainAdjustedDefense(
  state: TerrainStatState,
  targetId: string,
  defense: number,
): number {
  return state.statBalancePolicyVersion === 1 && combatantElevation(state, targetId) > 0
    ? Math.floor((defense * 8_000) / 10_000)
    : defense
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
