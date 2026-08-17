import type { BattleExitPolicy } from './battle-exit'
import type { CombatTile, GridPosition } from './board'

export type TacticalHallArenaId = 'basic-training-floor' | 'duel-yard'

export interface TacticalHallArenaDefinition {
  id: TacticalHallArenaId
  name: string
  scale: 'micro' | 'duel'
  exitPolicy: BattleExitPolicy
  width: number
  height: number
  tiles: readonly CombatTile[]
  playerSpawn: GridPosition
  recruitSpawn: GridPosition
}

function createTiles(
  width: number,
  height: number,
  rough: ReadonlySet<string>,
  raised: ReadonlySet<string>,
): readonly CombatTile[] {
  const tiles: CombatTile[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x}:${y}`
      tiles.push({
        position: { x, y },
        elevation: raised.has(key) ? 1 : 0,
        terrainId: rough.has(key) ? 'rough-ground' : 'open-ground',
      })
    }
  }
  return tiles
}

const BASIC_TRAINING_FLOOR: TacticalHallArenaDefinition = {
  id: 'basic-training-floor',
  name: 'Basic Training Floor',
  scale: 'micro',
  exitPolicy: 'ABORT_PRACTICE',
  width: 5,
  height: 3,
  tiles: createTiles(5, 3, new Set(['2:1']), new Set(['2:0'])),
  playerSpawn: { x: 0, y: 1 },
  recruitSpawn: { x: 4, y: 1 },
}

const DUEL_YARD: TacticalHallArenaDefinition = {
  id: 'duel-yard',
  name: 'Duel Yard',
  scale: 'duel',
  exitPolicy: 'ABORT_PRACTICE',
  width: 9,
  height: 7,
  tiles: createTiles(
    9,
    7,
    new Set(['3:2', '3:3', '3:4', '5:2', '5:3', '5:4', '4:3']),
    new Set(['4:1', '4:5']),
  ),
  playerSpawn: { x: 1, y: 3 },
  recruitSpawn: { x: 7, y: 3 },
}

export const P2_7_TACTICAL_HALL_ARENAS: readonly TacticalHallArenaDefinition[] = [
  BASIC_TRAINING_FLOOR,
  DUEL_YARD,
]

export function getTacticalHallArena(id: TacticalHallArenaId): TacticalHallArenaDefinition {
  const arena = P2_7_TACTICAL_HALL_ARENAS.find((candidate) => candidate.id === id)
  if (!arena) throw new Error(`Unknown Tactical Hall arena: ${id}`)
  return arena
}

export function getTacticalHallArenaFromScenarioSourceId(
  sourceId: string,
): TacticalHallArenaDefinition | null {
  const prefix = 'scenario:p2-7-recruit:'
  if (!sourceId.startsWith(prefix)) return null
  const arenaId = sourceId.slice(prefix.length) as TacticalHallArenaId
  return P2_7_TACTICAL_HALL_ARENAS.find((candidate) => candidate.id === arenaId) ?? null
}
