import type { BattleExitPolicy } from './battle-exit'
import type { CombatTile, GridPosition } from './board'

export type TacticalHallArenaId =
  'basic-training-floor' | 'duel-yard' | 'crossroads-court' | 'terraced-yard'

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

const CROSSROADS_COURT: TacticalHallArenaDefinition = {
  id: 'crossroads-court',
  name: 'Crossroads Court',
  scale: 'duel',
  exitPolicy: 'ABORT_PRACTICE',
  width: 12,
  height: 7,
  // A short costly center competes with two longer open flanks. Ground routes need no Jump.
  tiles: createTiles(12, 7, new Set(['5:2', '5:3', '5:4', '6:2', '6:3', '6:4']), new Set()),
  playerSpawn: { x: 1, y: 3 },
  recruitSpawn: { x: 10, y: 3 },
}

const TERRACED_YARD: TacticalHallArenaDefinition = {
  id: 'terraced-yard',
  name: 'Terraced Yard',
  scale: 'duel',
  exitPolicy: 'ABORT_PRACTICE',
  width: 15,
  height: 7,
  // Side platforms reward Jump investment; the center stays passable at Movement 2 / Jump 0.
  tiles: createTiles(
    15,
    7,
    new Set(['6:3', '8:3', '7:2', '7:4']),
    new Set(['4:1', '5:1', '9:1', '10:1', '4:5', '5:5', '9:5', '10:5']),
  ),
  playerSpawn: { x: 1, y: 3 },
  recruitSpawn: { x: 13, y: 3 },
}

export const P2_7_TACTICAL_HALL_ARENAS: readonly TacticalHallArenaDefinition[] = [
  BASIC_TRAINING_FLOOR,
  DUEL_YARD,
  CROSSROADS_COURT,
  TERRACED_YARD,
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

  const sourceArena = sourceId.slice(prefix.length).split(':', 1)[0]
  // PV-1F initially persisted Recruit profiles with the generic `duel:<difficulty>`
  // provenance segment. Keep those snapshots abortable while accepting the canonical
  // arena-id form (with or without an appended difficulty segment) going forward.
  const arenaId = sourceArena === 'duel' ? 'duel-yard' : sourceArena
  return P2_7_TACTICAL_HALL_ARENAS.find((candidate) => candidate.id === arenaId) ?? null
}
