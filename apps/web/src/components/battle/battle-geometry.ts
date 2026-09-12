import { pv1fMovementModifiers } from '@aurevane/game-core/combat/pv1f-action-economy'
import { PV1F_MOVEMENT_COST_PER_TERRAIN_POINT } from '@aurevane/game-core/combat/pv1f-skills'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

export const MOVE_COST_PER_TERRAIN_POINT = PV1F_MOVEMENT_COST_PER_TERRAIN_POINT

export type BattleGridPosition = { x: number; y: number }
export type BattleFacing = 'north' | 'east' | 'south' | 'west'

type Tactical = BattleSessionView['snapshot']['tactical']
type Placement = Tactical['placements'][number]

export function positionKey(position: BattleGridPosition): string {
  return `${position.x}:${position.y}`
}

export function positionsEqual(left: BattleGridPosition, right: BattleGridPosition): boolean {
  return left.x === right.x && left.y === right.y
}

/**
 * Returns the shortened projected path when the player selects a tile already contained earlier in
 * the current projection. The committed origin is represented by an empty projected path so the UI
 * can retract all the way back to zero uncommitted movement without cancelling Move mode.
 */
export function retractProjectedPath(
  path: readonly BattleGridPosition[],
  target: BattleGridPosition,
): BattleGridPosition[] | null {
  const targetIndex = path.findIndex((position) => positionsEqual(position, target))
  if (targetIndex < 0 || targetIndex === path.length - 1) return null
  return targetIndex === 0
    ? []
    : path.slice(0, targetIndex + 1).map((position) => ({ ...position }))
}

export function facingGlyph(facing: BattleFacing): string {
  if (facing === 'north') return '↑'
  if (facing === 'east') return '→'
  if (facing === 'south') return '↓'
  return '←'
}

export function meterPercent(value: number, maximum: number): number {
  if (maximum <= 0) return 0
  return Math.max(0, Math.min(100, (value / maximum) * 100))
}

export function percentFromBasisPoints(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value / 100)}%`
}

export function manhattanDistance(left: BattleGridPosition, right: BattleGridPosition): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y)
}

export function terrainTraversalCost(
  tactical: Tactical,
  terrainId: string,
  movementProfileId: string,
): number | null {
  const profile = tactical.movementProfiles.find((candidate) => candidate.id === movementProfileId)
  const override = profile?.terrainCostOverrides.find(
    (candidate) => candidate.terrainId === terrainId,
  )
  if (override) return override.traversalCost
  return tactical.terrains.find((candidate) => candidate.id === terrainId)?.traversalCost ?? null
}

export function buildReachablePaths(
  state: BattleSessionView['snapshot'],
  activePlacement: Placement | null,
  actionEconomy: number,
): Map<string, BattleGridPosition[]> {
  const tactical = state.tactical
  const turn = tactical.battle.currentTurn
  if (!turn || !activePlacement || turn.combatantId !== activePlacement.combatantId) {
    return new Map()
  }

  const profile = tactical.movementProfiles.find(
    (candidate) => candidate.id === activePlacement.movementProfileId,
  )
  if (!profile) return new Map()

  const modifiers = pv1fMovementModifiers(state)
  if (modifiers.blocked) return new Map()
  const tiles = new Map(tactical.tiles.map((tile) => [positionKey(tile.position), tile] as const))
  const occupied = new Map(
    tactical.placements.map(
      (placement) => [positionKey(placement.position), placement.combatantId] as const,
    ),
  )
  const result = new Map<string, BattleGridPosition[]>()
  // Neither AP nor Movement dominates the other once tile/status surcharges apply.
  // Keep the Pareto frontier at each tile so a useful detour is never discarded.
  const bestCosts = new Map<string, { movement: number; ap: number }[]>()
  const selectedAp = new Map<string, number>()
  const frontier: Array<{
    position: BattleGridPosition
    movement: number
    ap: number
    path: BattleGridPosition[]
  }> = [
    {
      position: { ...activePlacement.position },
      movement: 0,
      ap: 0,
      path: [{ ...activePlacement.position }],
    },
  ]

  bestCosts.set(positionKey(activePlacement.position), [{ movement: 0, ap: 0 }])
  selectedAp.set(positionKey(activePlacement.position), 0)
  result.set(positionKey(activePlacement.position), [{ ...activePlacement.position }])

  while (frontier.length > 0) {
    frontier.sort((left, right) => left.ap - right.ap || left.movement - right.movement)
    const current = frontier.shift()
    if (!current) break

    for (const neighbor of [
      { x: current.position.x + 1, y: current.position.y },
      { x: current.position.x - 1, y: current.position.y },
      { x: current.position.x, y: current.position.y + 1 },
      { x: current.position.x, y: current.position.y - 1 },
    ]) {
      if (
        neighbor.x < 0 ||
        neighbor.x >= tactical.width ||
        neighbor.y < 0 ||
        neighbor.y >= tactical.height
      ) {
        continue
      }

      const neighborKey = positionKey(neighbor)
      const neighborTile = tiles.get(neighborKey)
      const currentTile = tiles.get(positionKey(current.position))
      if (!neighborTile || !currentTile) continue
      const occupant = occupied.get(neighborKey)
      if (occupant && occupant !== activePlacement.combatantId) continue
      if (Math.abs(neighborTile.elevation - currentTile.elevation) > profile.maxElevationStep) {
        continue
      }

      const traversalCost = terrainTraversalCost(
        tactical,
        neighborTile.terrainId,
        activePlacement.movementProfileId,
      )
      if (traversalCost === null) continue
      const movement = current.movement + traversalCost
      const ap =
        current.ap +
        traversalCost * MOVE_COST_PER_TERRAIN_POINT +
        modifiers.additionalApAt(neighbor)
      if (movement > turn.movementRemaining || ap > actionEconomy) continue
      const known = bestCosts.get(neighborKey) ?? []
      if (known.some((cost) => cost.movement <= movement && cost.ap <= ap)) continue
      bestCosts.set(neighborKey, [
        ...known.filter((cost) => !(movement <= cost.movement && ap <= cost.ap)),
        { movement, ap },
      ])
      const nextPath = [...current.path, { ...neighbor }]
      if (ap < (selectedAp.get(neighborKey) ?? Infinity)) {
        selectedAp.set(neighborKey, ap)
        result.set(neighborKey, nextPath)
      }
      frontier.push({ position: neighbor, movement, ap, path: nextPath })
    }
  }

  return result
}
