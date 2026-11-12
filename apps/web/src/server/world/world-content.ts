import 'server-only'
import { CHARTED_SECTORS, FRONTIER_APPROACH, GRID_WIDTH, TRAIL_SECTORS } from '@/world/catalog'
import type { WorldObjective, WorldPosition, WorldSector, WorldState } from '@/world/types'
import { resolveWildSector } from '@/world/wilds'
import { isWildSectorId } from '@/world/wild-ids'
import { isCurrentWorldRoute, validCell } from '@/world/travel'
import {
  parseVoidSectorId,
  isVoidRealmSectorId,
  voidSectorId,
  VOID_REALM_COLUMNS,
  VOID_REALM_ROWS,
} from '@/world/void-realms'
import { atlasSectors } from '@/world/atlas'
import { isWarpedContinentSector, warpedContinentSectors } from './warped-continent'
import { ferryDeckSector } from './world-ferry'
import { resolveVoidSector } from './void-realms'

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
const SEALED_REALM_ID =
  /^sealed-realm:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function sealedRealmSector(id: string): WorldSector | null {
  if (!SEALED_REALM_ID.test(id)) return null
  return {
    id,
    name: 'Sealed realm',
    coordinate: 'Private realm',
    regionId: 'umbral-march',
    art: null,
    east: 0,
    north: 0,
    charted: false,
    rows: [
      '#############',
      '#############',
      '####sssss####',
      '###sssssss###',
      '###sssssss###',
      '###sssssss###',
      '####sssss####',
      '#############',
      '#############',
    ],
    landmarks: [],
    roads: [],
  }
}

const atlas = atlasSectors().map((sector) => ({
  ...sector,
  roads: [
    ...sector.roads,
    ...(CHARTED_SECTORS.find((s) => s.id === sector.id)?.roads.filter((road) =>
      isWildSectorId(road.to.sectorId),
    ) ?? []),
  ],
}))
const atlasIds = new Set(atlas.map((sector) => sector.id))
// Legacy roads/trails stay resolvable for characters parked there. New journeys use the
// contiguous atlas; importing the old graph into every route would recreate teleport seams.
const legacy = [...CHARTED_SECTORS, ...TRAIL_SECTORS].filter((s) => !atlasIds.has(s.id))
export const WORLD_SECTORS = [...atlas, ...legacy, SURVEY_SECTOR, ...warpedContinentSectors]
const AUTHORED_BY_ID = new Map(WORLD_SECTORS.map((sector) => [sector.id, sector]))
/** Any sector, authored or generated, by id; null when the id names nothing. */
export function resolveSector(id: string): WorldSector | null {
  return (
    AUTHORED_BY_ID.get(id) ??
    resolveVoidSector(id) ??
    ferryDeckSector(id) ??
    sealedRealmSector(id) ??
    (isWildSectorId(id) ? resolveWildSector(id) : null)
  )
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
  const realm = parseVoidSectorId(state.position.sectorId)
  const destinationRealm = parseVoidSectorId(p.sectorId)
  if (destinationRealm) {
    if (destinationRealm.realmId !== realm?.realmId || !validCell(p)) return false
    // Known private cells need no terrain generation, including during long route searches.
    if (discovered(state, p)) return true
  }
  const sector = resolveSector(p.sectorId)
  if (!sector) return false
  // Persisted discoveries from another private landmass never grant present access.
  if (realm && !sector.charted && destinationRealm?.realmId !== realm.realmId) return false
  if (SEALED_REALM_ID.test(p.sectorId)) return p.sectorId === state.position.sectorId
  const warped = isWarpedContinentSector(p.sectorId)
  if (warped && !isWarpedContinentSector(state.position.sectorId)) return false
  if (sector.charted || discovered(state, p)) return true
  if (state.ferry && state.position.sectorId === p.sectorId && ferryDeckSector(p.sectorId))
    return true
  if (!sector.generated && !warped && !destinationRealm) return false
  return sector.roads.some((road) => {
    if (road.from.x !== p.x || road.from.y !== p.y) return false
    const origin = resolveSector(road.to.sectorId)
    return Boolean(origin && (origin.charted || discovered(state, road.to)))
  })
}
/** Everything a character can see on their map: charted ground plus what they have explored. */
export function visibleSectors(
  state: WorldState,
  { sceneOnly = false }: { sceneOnly?: boolean } = {},
): WorldSector[] {
  const visible = new Map<string, WorldSector>()
  const voidRealm = parseVoidSectorId(state.position.sectorId)
  const onWarpedContinent = isWarpedContinentSector(state.position.sectorId)
  const deck = state.ferry ? ferryDeckSector(state.position.sectorId) : null
  if (deck) visible.set(deck.id, deck)
  const realm = sealedRealmSector(state.position.sectorId)
  if (realm) visible.set(realm.id, realm)
  const legacyJourney = legacy.some(
    (s) =>
      s.id === state.position.sectorId ||
      state.route.some((step) => step.position.sectorId === s.id),
  )
  for (const sector of WORLD_SECTORS)
    if (
      (!isWarpedContinentSector(sector.id) || onWarpedContinent) &&
      (!voidRealm || sector.charted) &&
      ((sector.charted && (atlasIds.has(sector.id) || legacyJourney)) ||
        state.discoveries[sector.id] ||
        sector.id === state.position.sectorId ||
        state.route.some((step) => step.position.sectorId === sector.id))
    )
      visible.set(sector.id, sector)
  if (!voidRealm)
    for (const id of Object.keys(state.discoveries)) {
      const sector = isWildSectorId(id) ? resolveSector(id) : null
      if (sector) visible.set(id, sector)
    }
  if (voidRealm) {
    const candidates = sceneOnly
      ? Array.from({ length: 25 }, (_, index) => {
          const column = voidRealm.column + (index % 5) - 2
          const row = voidRealm.row + Math.floor(index / 5) - 2
          return column >= 0 && column < VOID_REALM_COLUMNS && row >= 0 && row < VOID_REALM_ROWS
            ? [voidSectorId(voidRealm.realmId, column, row)]
            : []
        }).flat()
      : Object.keys(state.discoveries)
    candidates.push(state.position.sectorId)
    const routeIds = new Set<string>()
    let previous = state.position
    for (const step of sceneOnly ? state.route.slice(0, 8) : state.route) {
      if (!isKnownCell(state, step.position)) break
      if (sceneOnly) {
        const source = resolveSector(previous.sectorId)
        const target = resolveSector(step.position.sectorId)
        if (
          !source ||
          !target ||
          !isCurrentWorldRoute(previous, [step], [source, target], (p) => isKnownCell(state, p))
        )
          break
      }
      routeIds.add(step.position.sectorId)
      candidates.push(step.position.sectorId)
      previous = step.position
    }
    for (const id of candidates) {
      const address = parseVoidSectorId(id)
      if (
        address?.realmId !== voidRealm.realmId ||
        (id !== state.position.sectorId && !state.discoveries[id]?.length && !routeIds.has(id))
      )
        continue
      const sector = resolveSector(id)
      if (sector) visible.set(id, sector)
    }
  }
  for (const sector of [...visible.values()])
    for (const road of sector.roads) {
      if (
        visible.has(road.to.sectorId) ||
        (!isWildSectorId(road.to.sectorId) &&
          !isWarpedContinentSector(road.to.sectorId) &&
          !isVoidRealmSectorId(road.to.sectorId))
      )
        continue
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
