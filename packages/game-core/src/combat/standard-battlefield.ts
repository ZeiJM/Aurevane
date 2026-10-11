import { advanceBattleRng, createBattleRngState } from './battle-state'
import type { CombatTile, GridPosition } from './board'

export interface BattlefieldElevationPolicy {
  version: number
  level1BasisPoints: number
  level2BasisPoints: number
  level3BasisPoints: number
}

export function defaultBattlefieldElevationPolicy(): BattlefieldElevationPolicy {
  return { version: 1, level1BasisPoints: 6000, level2BasisPoints: 3000, level3BasisPoints: 1000 }
}

export function parseBattlefieldElevationPolicy(value: unknown): BattlefieldElevationPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RangeError('Invalid elevation policy.')
  const record = value as Record<string, unknown>
  const keys = ['version', 'level1BasisPoints', 'level2BasisPoints', 'level3BasisPoints']
  if (
    Object.keys(record).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(record, key)) ||
    !Number.isSafeInteger(record.version) ||
    (record.version as number) < 1 ||
    keys
      .slice(1)
      .some(
        (key) =>
          !Number.isSafeInteger(record[key]) ||
          (record[key] as number) < 0 ||
          (record[key] as number) > 10000,
      ) ||
    (record.level1BasisPoints as number) +
      (record.level2BasisPoints as number) +
      (record.level3BasisPoints as number) !==
      10000
  )
    throw new RangeError('Elevation chances must total exactly 100%.')
  return {
    version: record.version as number,
    level1BasisPoints: record.level1BasisPoints as number,
    level2BasisPoints: record.level2BasisPoints as number,
    level3BasisPoints: record.level3BasisPoints as number,
  }
}

function heightForDraw(draw: number, policy: BattlefieldElevationPolicy): number {
  const roll = draw % 10000
  return roll < policy.level1BasisPoints
    ? 1
    : roll < policy.level1BasisPoints + policy.level2BasisPoints
      ? 2
      : 3
}

type MapBias = 'less' | 'neutral' | 'more'

interface StandardBattlefieldInput {
  width: number
  height: number
  seed: number
  spawns: readonly GridPosition[]
  terrainBias?: MapBias
  elevationPolicy?: BattlefieldElevationPolicy
  elevationBias?: MapBias
}

const ROUGH_RATE = { less: 70, neutral: 150, more: 270 } as const
const RAISED_RATE = { less: 45, neutral: 115, more: 220 } as const

/** New standard maps only; authored scenarios and stored battle tiles remain authoritative. */
export function createStandardBattlefieldTiles(
  input: StandardBattlefieldInput,
): readonly CombatTile[] {
  const { width, height, spawns } = input
  const policy = parseBattlefieldElevationPolicy(
    input.elevationPolicy ?? defaultBattlefieldElevationPolicy(),
  )
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
    throw new RangeError('Battlefield dimensions must be positive safe integers.')
  }
  createBattleRngState(input.seed)
  // Domain-separated local stream: map creation never advances the battle's combat RNG.
  let mapRng = createBattleRngState((input.seed ^ 0x6d61_7031) >>> 0 || 1)
  function shuffle<T>(values: T[]): T[] {
    for (let index = values.length - 1; index > 0; index--) {
      const draw = advanceBattleRng(mapRng)
      mapRng = draw.state
      const other = draw.value % (index + 1)
      const current = values[index]!
      values[index] = values[other]!
      values[other] = current
    }
    return values
  }

  const tiles: CombatTile[] = Array.from({ length: width * height }, (_, index) => ({
    position: { x: index % width, y: Math.floor(index / width) },
    elevation: 0,
    terrainId: 'open-ground',
  }))
  const eligible = tiles.flatMap((tile, index) =>
    spawns.some(
      (spawn) => Math.abs(tile.position.x - spawn.x) + Math.abs(tile.position.y - spawn.y) <= 1,
    )
      ? []
      : [index],
  )
  const eligibleSet = new Set(eligible)
  function neighbors(index: number): number[] {
    const x = index % width
    return [
      ...(x > 0 ? [index - 1] : []),
      ...(x < width - 1 ? [index + 1] : []),
      ...(index >= width ? [index - width] : []),
      ...(index + width < tiles.length ? [index + width] : []),
    ]
  }
  function flatGroundConnected(): boolean {
    const origin = tiles.findIndex((tile) => tile.elevation === 0)
    if (origin < 0) return false
    const reached = new Set([origin])
    const queue = [origin]
    for (let index = 0; index < queue.length; index++) {
      for (const neighbor of neighbors(queue[index]!)) {
        if (tiles[neighbor]!.elevation === 0 && !reached.has(neighbor)) {
          reached.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    return reached.size === tiles.filter((tile) => tile.elevation === 0).length
  }

  const pairs = shuffle(
    eligible.flatMap((index) =>
      neighbors(index)
        .filter((neighbor) => neighbor > index && eligibleSet.has(neighbor))
        .map((neighbor) => [index, neighbor] as const),
    ),
  )
  const raisedBudget =
    Math.floor((eligible.length * RAISED_RATE[input.elevationBias ?? 'neutral']) / 2000) * 2
  let raisedCount = 0
  for (const [first, second] of pairs) {
    if (raisedCount >= raisedBudget) break
    if (tiles[first]!.elevation || tiles[second]!.elevation) continue
    tiles[first]!.elevation = 1
    tiles[second]!.elevation = 1
    // Jump 0 characters must retain a route through every flat tile and between all spawns.
    if (flatGroundConnected()) {
      raisedCount += 2
    } else {
      tiles[first]!.elevation = 0
      tiles[second]!.elevation = 0
    }
  }

  // Every raised tile draws independently, including adjacent tiles.
  for (const tile of tiles) {
    if (tile.elevation <= 0) continue
    const draw = advanceBattleRng(mapRng)
    mapRng = draw.state
    tile.elevation = heightForDraw(draw.value, policy)
  }

  const roughBudget = Math.floor(
    (eligible.length * ROUGH_RATE[input.terrainBias ?? 'neutral']) / 1000,
  )
  for (const index of shuffle(eligible).slice(0, roughBudget))
    tiles[index]!.terrainId = 'rough-ground'
  return tiles
}

/** New battle instances of authored maps retain their geometry and terrain. */
export function randomizeRaisedTileHeights(
  tiles: readonly CombatTile[],
  seed: number,
  elevationPolicy: BattlefieldElevationPolicy = defaultBattlefieldElevationPolicy(),
): readonly CombatTile[] {
  const policy = parseBattlefieldElevationPolicy(elevationPolicy)
  let rng = createBattleRngState((seed ^ 0x6865_6967) >>> 0 || 1)
  const next = tiles.map((tile) => ({ ...tile, position: { ...tile.position } }))
  for (const tile of next) {
    if (tile.elevation <= 0) continue
    const draw = advanceBattleRng(rng)
    rng = draw.state
    tile.elevation = heightForDraw(draw.value, policy)
  }
  return next
}
