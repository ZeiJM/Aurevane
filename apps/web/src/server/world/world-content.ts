import 'server-only'
import { CHARTED_SECTORS, FRONTIER_APPROACH, GRID_WIDTH, TRAIL_SECTORS } from '@/world/catalog'
import type { WorldObjective, WorldPosition, WorldSector, WorldState } from '@/world/types'
import { resolveWildSector } from '@/world/wilds'
import { isWildSectorId } from '@/world/wild-ids'

// Private authored content: never imported by a Client Component.
export const SURVEY_SECTOR: WorldSector = {
  id: 'survey-01',
  name: 'Beyond the Last Map',
  coordinate: 'Survey I',
  regionId: 'umbral-march',
  art: null,
  east: 0,
  north: 8,
  charted: false,
  rows: [
    '#############',
    '##...#...#..#',
    '##.#...#....#',
    '##.###.#.#..#',
    '##.....#....#',
    '####.#...#..#',
    '##...#.#....#',
    '##.#...#....#',
    '######.######',
  ],
  landmarks: [
    { id: 'first-observation', name: 'Weathered Observatory', kind: 'anchor', x: 11, y: 1 },
  ],
  roads: [
    {
      from: { sectorId: 'survey-01', x: 6, y: 8 },
      to: FRONTIER_APPROACH,
      durationMs: 1100,
      name: 'Return to the last survey',
    },
  ],
}
export const WORLD_SECTORS = [...CHARTED_SECTORS, ...TRAIL_SECTORS, SURVEY_SECTOR]
const AUTHORED_BY_ID = new Map(WORLD_SECTORS.map((sector) => [sector.id, sector]))
/** Any sector, authored or generated, by id; null when the id names nothing. */
export function resolveSector(id: string): WorldSector | null {
  return AUTHORED_BY_ID.get(id) ?? (isWildSectorId(id) ? resolveWildSector(id) : null)
}
const cellIndex = (p: { x: number; y: number }) => p.y * GRID_WIDTH + p.x
function discovered(state: WorldState, p: WorldPosition) {
  return Boolean(state.discoveries[p.sectorId]?.includes(cellIndex(p)))
}
/**
 * Known ground: charted sectors, cells a character has surveyed, and the first tile of a
 * generated sector across a road from ground they already know.
 */
export function isKnownCell(state: WorldState, p: WorldPosition) {
  const sector = resolveSector(p.sectorId)
  if (!sector) return false
  if (sector.charted || discovered(state, p)) return true
  if (!sector.generated) return false
  return sector.roads.some((road) => {
    if (road.from.x !== p.x || road.from.y !== p.y) return false
    const origin = resolveSector(road.to.sectorId)
    return Boolean(origin && (origin.charted || discovered(state, road.to)))
  })
}
/** Everything a character can see on their map: charted ground plus what they have explored. */
export function visibleSectors(state: WorldState): WorldSector[] {
  const visible = new Map<string, WorldSector>()
  for (const sector of WORLD_SECTORS)
    if (sector.charted || state.discoveries[sector.id]) visible.set(sector.id, sector)
  for (const id of Object.keys(state.discoveries)) {
    const sector = isWildSectorId(id) ? resolveSector(id) : null
    if (sector) visible.set(id, sector)
  }
  for (const sector of [...visible.values()])
    for (const road of sector.roads) {
      if (visible.has(road.to.sectorId) || !isWildSectorId(road.to.sectorId)) continue
      const next = resolveSector(road.to.sectorId)
      if (next && isKnownCell(state, road.to)) visible.set(next.id, next)
    }
  return [...visible.values()]
}
export const WORLD_OBJECTIVES: readonly WorldObjective[] = [
  {
    id: 'eastern-watch',
    name: 'The Eastern Watch',
    description: 'Reach the watchtower across the river.',
    kind: 'quest',
    autoPath: true,
    guidance: 'exact',
    destination: { sectorId: 'verdant-expanse', x: 12, y: 4 },
    completed: false,
  },
  {
    id: 'crown-hinterland-patrol',
    name: 'Hinterland Patrol',
    description: 'Patrol Crown Hinterland and report back to Aureth Crown.',
    kind: 'quest',
    autoPath: true,
    guidance: 'exact',
    destination: { sectorId: 'crown-hinterland', x: 6, y: 4 },
    completed: false,
  },
  {
    id: 'last-survey',
    name: 'Beyond the last map',
    description: 'Find the last reliable survey in the Umbral March.',
    kind: 'quest',
    autoPath: true,
    guidance: 'exact',
    destination: FRONTIER_APPROACH,
    completed: false,
  },
]
