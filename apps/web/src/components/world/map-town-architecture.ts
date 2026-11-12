import { hashString } from '@/world/terrain-gen'
import type { WorldBuilding, WorldSectorView } from '@/world/types'
import { townArchitecturePivots } from './map-town-architecture-pivots'
import { MAP_X, MAP_Y } from './map-projection'

export const TOWN_ARCHITECTURE_REGIONS = [
  'verdant-expanse',
  'aureth-crown',
  'frostmere',
  'hollow-coast',
  'glasswind-desert',
  'emberreach',
  'starfall-highlands',
  'umbral-march',
] as const
export interface TownArchitectureArt {
  sheet: 'town-grand-architecture' | 'town-ordinary-architecture'
  index: number
  columns: 4
  rows: 2
  anchorX: number
  anchorY: number
  aspect: 1
}
/** New civic silhouettes use canonical regional indices; ordinary buildings mix stable old/new forms. */
export function townArchitectureArt(
  sector: WorldSectorView,
  building: WorldBuilding,
): TownArchitectureArt | undefined {
  if (
    !sector.charted ||
    sector.warpedTheme ||
    !sector.townId ||
    building.propIndex !== undefined ||
    building.artIndex === 9
  )
    return
  const index = TOWN_ARCHITECTURE_REGIONS.findIndex((region) => region === sector.regionId)
  if (index < 0) return
  const grand = building.artIndex >= 10 && building.artIndex < 18
  if (grand && building.artIndex !== index + 10) return
  if (!grand && hashString(`${building.id}:construction`) % 3 === 0) return
  const sheet = grand ? 'town-grand-architecture' : 'town-ordinary-architecture'
  const pivot = townArchitecturePivots[sheet][index]!
  return { sheet, index, columns: 4, rows: 2, aspect: 1, ...pivot }
}
/** Straight wall runs use the two real isometric ground axes, never a stretched city-gate facade. */
export function crownWallArt(building: WorldBuilding) {
  if (building.artIndex !== 9 || !building.wallFacing) return
  const index = building.wallFacing === 'east' ? 0 : 1
  return {
    sheet: 'crown-wall-kit' as const,
    index,
    columns: 2 as const,
    rows: 2 as const,
    aspect: 1 as const,
    ...townArchitecturePivots['crown-wall-kit'][index],
  }
}

/** Balanced short runs keep wall height consistent and all masonry base endpoints joined. */
export function crownWallSegments(building: WorldBuilding) {
  const art = crownWallArt(building)
  if (!art) return []
  const east = building.wallFacing === 'east'
  const run = east ? building.height : building.width
  if (!Number.isFinite(run) || run <= 0 || run > 13) return []
  const count = Math.ceil(run / 3),
    length = run / count
  const [start, end] = art.baseContacts
  const widthTiles = (length * MAP_X) / Math.abs(end.x - start.x)
  const heightTiles = (length * MAP_Y) / (end.y - start.y)
  return Array.from({ length: count }, (_, index) => ({
    x: building.x + (east ? building.width : (index + 0.5) * length),
    y: building.y + (east ? (index + 0.5) * length : building.height),
    length,
    widthTiles,
    heightTiles,
  }))
}
