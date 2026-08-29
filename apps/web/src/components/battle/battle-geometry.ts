import type { BattleSessionView } from '@/server/battle/battle-session-service'

export const MOVE_COST_PER_TERRAIN_POINT = 25

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
  tactical: Tactical,
  activePlacement: Placement | null,
  actionEconomy: number,
): Map<string, BattleGridPosition[]> {
  const turn = tactical.battle.currentTurn
  if (!turn || !activePlacement || turn.combatantId !== activePlacement.combatantId) {
    return new Map()
  }

  const profile = tactical.movementProfiles.find(
    (candidate) => candidate.id === activePlacement.movementProfileId,
  )
  if (!profile) return new Map()

  const maximumTerrainCost = Math.min(
    turn.movementRemaining,
    Math.floor(actionEconomy / MOVE_COST_PER_TERRAIN_POINT),
  )
  const tiles = new Map(tactical.tiles.map((tile) => [positionKey(tile.position), tile] as const))
  const occupied = new Map(
    tactical.placements.map(
      (placement) => [positionKey(placement.position), placement.combatantId] as const,
    ),
  )
  const result = new Map<string, BattleGridPosition[]>()
  const bestCost = new Map<string, number>()
  const frontier: Array<{
    position: BattleGridPosition
    cost: number
    path: BattleGridPosition[]
  }> = [
    {
      position: { ...activePlacement.position },
      cost: 0,
      path: [{ ...activePlacement.position }],
    },
  ]

  bestCost.set(positionKey(activePlacement.position), 0)
  result.set(positionKey(activePlacement.position), [{ ...activePlacement.position }])

  while (frontier.length > 0) {
    frontier.sort((left, right) => left.cost - right.cost)
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
      const nextCost = current.cost + traversalCost
      if (nextCost > maximumTerrainCost) continue
      const known = bestCost.get(neighborKey)
      if (known !== undefined && known <= nextCost) continue

      const nextPath = [...current.path, { ...neighbor }]
      bestCost.set(neighborKey, nextCost)
      result.set(neighborKey, nextPath)
      frontier.push({ position: neighbor, cost: nextCost, path: nextPath })
    }
  }

  return result
}
