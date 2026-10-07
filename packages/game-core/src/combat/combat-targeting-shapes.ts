import { resolveTargetShapeTiles } from './actions-legacy'
import type { CombatEncounterState, CombatTargetSelection, CombatTargetSpec } from './actions'
import type { GridPosition, TacticalBattleState } from './board'

export const combatCardinalDirections = ['north', 'east', 'south', 'west'] as const
export type CombatTargetFootprintBoard = Pick<TacticalBattleState, 'width' | 'height' | 'tiles'> &
  Partial<Pick<TacticalBattleState, 'placements'>>

export type CombatTargetSpatialBoard = CombatTargetFootprintBoard &
  Pick<TacticalBattleState, 'terrains' | 'placements'> & {
    battle: { combatants: readonly { id: string; hp: number }[] }
  }
type TargetTerrainOverlay = { kind: string; position: GridPosition }

/** Shared spatial checks accept viewer-safe board data and never require the private RNG. */
export function hasCombatTargetLineOfSight(
  tactical: Pick<TacticalBattleState, 'tiles' | 'terrains'>,
  origin: GridPosition,
  target: GridPosition,
  overlays: readonly TargetTerrainOverlay[] = [],
): boolean {
  const points: GridPosition[] = []
  let x = origin.x
  let y = origin.y
  const dx = Math.abs(target.x - origin.x)
  const sx = origin.x < target.x ? 1 : -1
  const dy = -Math.abs(target.y - origin.y)
  const sy = origin.y < target.y ? 1 : -1
  let error = dx + dy
  while (true) {
    points.push({ x, y })
    if (x === target.x && y === target.y) break
    const doubled = error * 2
    if (doubled >= dy) {
      error += dy
      x += sx
    }
    if (doubled <= dx) {
      error += dx
      y += sy
    }
  }
  for (const point of points.slice(1, -1)) {
    const tile = tactical.tiles.find(
      (tile) => tile.position.x === point.x && tile.position.y === point.y,
    )
    const terrain = tactical.terrains.find((terrain) => terrain.id === tile?.terrainId)
    if (!terrain) throw new Error(`Unknown terrain ${tile?.terrainId}.`)
    if (
      terrain.traversalCost === null ||
      overlays.some(
        (overlay) =>
          overlay.kind === 'steam' &&
          overlay.position.x === point.x &&
          overlay.position.y === point.y,
      )
    )
      return false
  }
  return true
}

export function filterCombatTargetSpatialFootprint(
  tactical: CombatTargetSpatialBoard,
  origin: GridPosition,
  spec: CombatTargetSpec,
  positions: readonly GridPosition[],
  overlays: readonly TargetTerrainOverlay[] = [],
): readonly GridPosition[] {
  const originTile = tactical.tiles.find(
    (tile) => tile.position.x === origin.x && tile.position.y === origin.y,
  )
  return positions.filter((position) => {
    if (
      spec.kind === 'empty-tile' &&
      tactical.placements.some(
        (placement) =>
          placement.position.x === position.x &&
          placement.position.y === position.y &&
          tactical.battle.combatants.some(
            (unit) => unit.id === placement.combatantId && unit.hp > 0,
          ),
      )
    )
      return false
    const tile = tactical.tiles.find(
      (tile) => tile.position.x === position.x && tile.position.y === position.y,
    )
    if (!originTile || !tile) return false
    if (
      spec.maximumElevationDifference !== null &&
      Math.abs(originTile.elevation - tile.elevation) > spec.maximumElevationDifference
    )
      return false
    return (
      spec.shape.kind === 'all' ||
      !spec.requiresLineOfSight ||
      hasCombatTargetLineOfSight(tactical, origin, position, overlays)
    )
  })
}

function selectedPosition(
  tactical: CombatTargetFootprintBoard,
  origin: GridPosition,
  selection: CombatTargetSelection,
): GridPosition | null {
  if (selection.kind === 'self') return origin
  if (selection.kind === 'tile') return selection.position
  if (selection.kind === 'unit')
    return (
      tactical.placements?.find((row) => row.combatantId === selection.combatantId)?.position ??
      null
    )
  return null
}

export function resolveCombatTargetFootprint(
  tactical: CombatTargetFootprintBoard,
  origin: GridPosition,
  spec: CombatTargetSpec,
  selection: CombatTargetSelection,
): readonly GridPosition[] {
  if (spec.geometryVersion !== 2 || spec.shape.kind === 'single') {
    if (spec.shape.kind === 'all') throw new TypeError('All requires geometry version 2.')
    if (selection.kind === 'direction' || selection.kind === 'activate')
      throw new TypeError('This targeting method requires a selected target.')
    const selected = selectedPosition(tactical, origin, selection)
    return selected ? resolveTargetShapeTiles(tactical, origin, selected, spec.shape) : []
  }
  const shape = spec.shape
  if (shape.kind === 'line') {
    if (selection.kind !== 'direction' || !combatCardinalDirections.includes(selection.direction))
      throw new TypeError('Line requires a cardinal direction.')
    if (!Number.isSafeInteger(shape.length) || shape.length < 1 || shape.length > 5)
      throw new RangeError('Line length must be from one to five.')
    const dx = selection.direction === 'east' ? 1 : selection.direction === 'west' ? -1 : 0
    const dy = selection.direction === 'south' ? 1 : selection.direction === 'north' ? -1 : 0
    const tiles: GridPosition[] = []
    for (let step = 1; step <= shape.length; step++) {
      const position = { x: origin.x + step * dx, y: origin.y + step * dy }
      if (
        !tactical.tiles.some(
          (tile) => tile.position.x === position.x && tile.position.y === position.y,
        )
      )
        break
      tiles.push(position)
    }
    return tiles
  }
  if (selection.kind !== 'activate') throw new TypeError('Circle and All require activation.')
  if (shape.kind === 'all') return tactical.tiles.map((tile) => ({ ...tile.position }))
  if (!Number.isSafeInteger(shape.radius) || shape.radius < 1 || shape.radius > 5)
    throw new RangeError('Circle radius must be from one to five.')
  return tactical.tiles
    .filter((tile) => {
      const distance = Math.max(
        Math.abs(tile.position.x - origin.x),
        Math.abs(tile.position.y - origin.y),
      )
      return distance >= 1 && distance <= shape.radius
    })
    .map((tile) => ({ ...tile.position }))
}

export function enumerateCombatTargetSelections(
  state: CombatEncounterState,
  actorId: string,
  spec: CombatTargetSpec,
): readonly CombatTargetSelection[] {
  if (spec.geometryVersion === 2) {
    if (spec.shape.kind === 'line')
      return combatCardinalDirections.map((direction) => ({ kind: 'direction', direction }))
    if (spec.shape.kind === 'circle' || spec.shape.kind === 'all') return [{ kind: 'activate' }]
  }
  if (spec.kind === 'self') return [{ kind: 'self' }]
  if (spec.kind === 'unit')
    return state.tactical.battle.combatants
      .filter((row) => row.hp > 0)
      .map((row) => ({ kind: 'unit', combatantId: row.id }))
  return state.tactical.tiles.map((tile) => ({ kind: 'tile', position: { ...tile.position } }))
}

/** Area commands do not name a primary unit. Actor and external recipients are independent. */
export function validateCurrentAreaTargetRecipients(definition: {
  target: CombatTargetSpec
  effects: readonly { type: string; recipient?: string }[]
  requirements: readonly { kind: string }[]
}): void {
  if (definition.target.geometryVersion !== 2 || definition.target.shape.kind === 'single') return
  if (
    definition.effects.some((effect) => effect.recipient === 'primary-unit') ||
    definition.requirements.some((requirement) => requirement.kind.startsWith('target-'))
  )
    throw new TypeError('Area targeting cannot require an unspecified primary unit.')
  if (definition.target.kind === 'self') throw new TypeError('Self-only targeting uses Single.')
  if (definition.effects.some((effect) => effect.type === 'summon'))
    throw new TypeError('Summon requires Single Empty Tile targeting.')
}

/** Current editor normalization never changes recipients, authored elevation or effect payloads. */
export function normalizeCurrentCombatTargetSpec(spec: CombatTargetSpec): CombatTargetSpec {
  const target = { ...spec, geometryVersion: 2 as const }
  if (target.kind === 'self')
    return {
      ...target,
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
    }
  if (target.shape.kind === 'all')
    return { ...target, minimumRange: 0, maximumRange: 0, requiresLineOfSight: false }
  if (target.shape.kind === 'line' || target.shape.kind === 'circle')
    return {
      ...target,
      minimumRange: 0,
      maximumRange: target.shape.kind === 'line' ? target.shape.length : target.shape.radius,
    }
  return target
}

export function validateVersionedCombatTargetSpec(spec: CombatTargetSpec): void {
  if (spec.geometryVersion === undefined) {
    if (spec.shape.kind === 'all') throw new TypeError('All requires geometry version 2.')
    return
  }
  if (spec.geometryVersion !== 2) throw new TypeError('Invalid geometry version.')
  if (spec.shape.kind === 'single') return
  if (spec.kind === 'self') throw new TypeError('Self-only targeting uses Single.')
  if (spec.shape.kind === 'all') {
    if (spec.minimumRange !== 0 || spec.maximumRange !== 0 || spec.requiresLineOfSight !== false)
      throw new TypeError('All uses no positional range or line of sight.')
    return
  }
  const reach = spec.shape.kind === 'line' ? spec.shape.length : spec.shape.radius
  if (!Number.isSafeInteger(reach) || reach < 1 || reach > 5)
    throw new RangeError('Area reach must be an integer from one to five.')
  if (spec.minimumRange !== 0 || spec.maximumRange !== reach)
    throw new TypeError('Line/Circle range must be 0 through its authored reach.')
}

export function validateCurrentCombatTargetAuthoring(
  definition: Parameters<typeof validateCurrentAreaTargetRecipients>[0],
): void {
  if (definition.target.shape.kind !== 'single' && definition.target.geometryVersion !== 2)
    throw new TypeError('Current area authoring requires geometry version 2.')
  validateVersionedCombatTargetSpec(definition.target)
  validateCurrentAreaTargetRecipients(definition)
}
