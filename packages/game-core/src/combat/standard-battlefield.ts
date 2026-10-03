import { advanceBattleRng, createBattleRngState } from './battle-state'
import type { CombatTile, GridPosition } from './board'

type MapBias = 'less' | 'neutral' | 'more'

interface StandardBattlefieldInput {
  width: number
  height: number
  seed: number
  spawns: readonly GridPosition[]
  terrainBias?: MapBias
  elevationBias?: MapBias
}

const ROUGH_RATE = { less: 70, neutral: 150, more: 270 } as const
const RAISED_RATE = { less: 45, neutral: 115, more: 220 } as const

/** New standard maps only; authored scenarios and stored battle tiles remain authoritative. */
export function createStandardBattlefieldTiles(
  input: StandardBattlefieldInput,
): readonly CombatTile[] {
  const { width, height, spawns } = input
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
    if (flatGroundConnected()) raisedCount += 2
    else {
      tiles[first]!.elevation = 0
      tiles[second]!.elevation = 0
    }
  }

  const roughBudget = Math.floor(
    (eligible.length * ROUGH_RATE[input.terrainBias ?? 'neutral']) / 1000,
  )
  for (const index of shuffle(eligible).slice(0, roughBudget))
    tiles[index]!.terrainId = 'rough-ground'
  return tiles
}
