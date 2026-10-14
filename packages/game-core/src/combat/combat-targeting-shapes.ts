import { resolveTargetShapeTiles } from './actions-legacy'
import type {
  CombatEncounterState,
  CombatTargetSelection,
  CombatTargetSpec,
  CombatEffectDefinition,
} from './actions'
import type { GridPosition, TacticalBattleState } from './board'
import { P2_7_TACTICAL_HALL_ARENAS } from './tactical-hall-arenas'

/** Production PvE and both PvP constructors consume this same registry. */
export function maximumSupportedCombatRange(): number {
  return Math.max(...P2_7_TACTICAL_HALL_ARENAS.map((arena) => arena.width - 1 + arena.height - 1))
}

export function combatTargetCategories(
  spec: CombatTargetSpec,
): readonly ('self' | 'ally' | 'enemy' | 'ground')[] {
  if (spec.categories) return spec.categories
  if (spec.kind === 'self') return ['self']
  if (spec.kind === 'ground-tile' || spec.kind === 'empty-tile') return ['ground']
  return spec.teamPolicy === 'any' ? ['self', 'ally', 'enemy'] : [spec.teamPolicy]
}

export function combatTargetUnitCategoryAllowed(
  spec: CombatTargetSpec,
  actor: { id: string; teamId: string },
  target: { id: string; teamId: string },
): boolean {
  return combatTargetCategories(spec).includes(
    target.id === actor.id ? 'self' : target.teamId === actor.teamId ? 'ally' : 'enemy',
  )
}

export function canonicalCombatEffectRecipients(
  effect: CombatEffectDefinition,
  spec: CombatTargetSpec,
): CombatEffectDefinition {
  if ((spec.maximumSelections ?? 1) <= 1) return effect
  if (effect.type === 'copy-statuses' || effect.type === 'sensory')
    throw new TypeError('plural-specialized-recipient-unsupported')
  return effect.recipient === 'primary-unit' ? { ...effect, recipient: 'affected-units' } : effect
}

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
    // A Line always stops at physical terrain; optional visibility also sees Steam.
    if (spec.geometryVersion === 3 && spec.shape.kind === 'line') {
      const terrain = tactical.terrains.find((terrain) => terrain.id === tile.terrainId)
      if (
        terrain?.traversalCost === null ||
        !hasCombatTargetLineOfSight(tactical, origin, position)
      )
        return false
    }
    if (
      spec.maximumElevationDifference !== null &&
      Math.abs(originTile.elevation - tile.elevation) > spec.maximumElevationDifference
    )
      return false
    return (
      (spec.geometryVersion !== 3 && spec.shape.kind === 'all') ||
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
  if (selection.kind === 'selections') {
    if (spec.shape.kind !== 'single') throw new TypeError('Plural selections require Single.')
    return selection.selections.flatMap((selected) =>
      resolveCombatTargetFootprint(tactical, origin, spec, selected),
    )
  }
  if ((spec.geometryVersion !== 2 && spec.geometryVersion !== 3) || spec.shape.kind === 'single') {
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
  if (spec.geometryVersion === 2 || spec.geometryVersion === 3) {
    if (spec.shape.kind === 'line')
      return combatCardinalDirections.map((direction) => ({ kind: 'direction', direction }))
    if (spec.shape.kind === 'circle' || spec.shape.kind === 'all') return [{ kind: 'activate' }]
  }
  if (spec.geometryVersion === 3) {
    const categories = combatTargetCategories(spec)
    return [
      ...(categories.includes('self') ? [{ kind: 'self' as const }] : []),
      ...state.tactical.battle.combatants
        .filter((row) => row.hp > 0 && row.id !== actorId)
        .map((row) => ({ kind: 'unit' as const, combatantId: row.id })),
      ...(categories.includes('ground')
        ? state.tactical.tiles.map((tile) => ({
            kind: 'tile' as const,
            position: { ...tile.position },
          }))
        : []),
    ]
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
  if (
    (definition.target.geometryVersion !== 2 && definition.target.geometryVersion !== 3) ||
    definition.target.shape.kind === 'single'
  )
    return
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
  if (spec.geometryVersion === 3) {
    if (
      spec.categories !== undefined &&
      (!Array.isArray(spec.categories) ||
        !spec.categories.length ||
        new Set(spec.categories).size !== spec.categories.length ||
        spec.categories.some((category) => !['self', 'ally', 'enemy', 'ground'].includes(category)))
    )
      throw new TypeError('Invalid target categories.')
    const count = spec.maximumSelections ?? 1
    if (
      !Number.isSafeInteger(count) ||
      count < 1 ||
      count > 3 ||
      (spec.shape.kind !== 'single' && count !== 1)
    )
      throw new RangeError(
        'Ordinary selections must be from one to three; area methods select one footprint.',
      )
    if (spec.maximumRange > maximumSupportedCombatRange())
      throw new RangeError('Range exceeds the largest supported map.')
    if (spec.shape.kind === 'all') return
    if (spec.shape.kind !== 'single') {
      const reach = spec.shape.kind === 'line' ? spec.shape.length : spec.shape.radius
      if (!Number.isSafeInteger(reach) || reach < 1 || reach > 5)
        throw new RangeError('Area reach must be an integer from one to five.')
      if (spec.minimumRange !== 0 || spec.maximumRange !== reach)
        throw new TypeError('Line/Circle range must be 0 through its authored reach.')
    }
    return
  }
  if (spec.categories !== undefined) throw new TypeError('Categories require geometry version 3.')
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
  if (
    definition.target.shape.kind !== 'single' &&
    definition.target.geometryVersion !== 2 &&
    definition.target.geometryVersion !== 3
  )
    throw new TypeError('Current area authoring requires geometry version 2.')
  validateVersionedCombatTargetSpec(definition.target)
  validateCurrentAreaTargetRecipients(definition)
}
