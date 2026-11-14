import { hashString } from '@/world/terrain-gen'
import { mountainFrontierAt } from '@/world/mountain-frontier'
import type { WorldSectorView } from '@/world/types'

export interface MountainPlacement {
  x: number
  y: number
  /** The sprite's actual collision anchor, never a rendered silhouette. */
  cellX: number
  cellY: number
  index: number
  widthTiles: number
  heightTiles: number
  /** Public atlas terrain is canonical: a pass is always an existing walkable road. */
  pass: boolean
  range: boolean
}
type MountainSector = Pick<
  WorldSectorView,
  | 'id'
  | 'regionId'
  | 'townId'
  | 'charted'
  | 'warpedTheme'
  | 'atlasColumn'
  | 'atlasRow'
  | 'landmarks'
  | 'cells'
>
const mountainRegions = new Set(['starfall-highlands', 'frostmere', 'emberreach', 'umbral-march'])
const worldKey = (x: number, y: number) => x + ':' + y

/** Dense new alpine terrain is carried by large peaks. Render only a quarter
 * of individual scree sprites there, reducing draw calls without changing
 * canonical collision or deleting any blocked ground. */
export function denseMountainRidge(sector: MountainSector): boolean {
  return Boolean(
    sector.charted &&
    mountainFrontierAt(sector.atlasColumn ?? -1, sector.atlasRow ?? -1) &&
    sector.cells.filter((cell) => cell.terrain === '#').length >= 32,
  )
}
export function drawMountainScree(id: string, x: number, y: number): boolean {
  return hashString('scree:' + id + ':' + x + ':' + y) % 4 === 0
}

/** A long exposed ridge away from Starfall's town core and established sites. */
export function isMajorMountainRangeSector(sector: MountainSector): boolean {
  if (sector.townId || sector.regionId !== 'starfall-highlands') return false
  const c = sector.atlasColumn,
    r = sector.atlasRow
  if (c === undefined || r === undefined || c < 41 || c > 55) return false
  return mountainFrontierAt(c, r) || Math.abs(r - (19 + (c - 47) * 0.32)) < 3.5
}
export function mountainPlacements(sector: MountainSector): MountainPlacement[] {
  if (sector.townId || (!sector.charted && !sector.warpedTheme)) return []
  const range = isMajorMountainRangeSector(sector)
  const eligible = mountainRegions.has(sector.regionId) || Boolean(sector.warpedTheme)
  if (!eligible && hashString('hill:region:' + sector.id) % 13 !== 0) return []
  const terrain = new Map(sector.cells.map((cell) => [worldKey(cell.x, cell.y), cell]))
  const nearLandmark = (x: number, y: number) =>
    sector.landmarks.some(
      (landmark) => Math.abs(landmark.x - x) <= 3.5 && Math.abs(landmark.y - y) <= 4,
    )
  const sources = sector.cells
    .filter((cell) => cell.terrain === '#' && !cell.walkable && !nearLandmark(cell.x, cell.y))
    .map((cell) => ({
      cell,
      seed: hashString('mountain:' + sector.id + ':' + cell.x + ':' + cell.y),
    }))
    .sort((a, b) => a.seed - b.seed)
  const placements: MountainPlacement[] = []
  const maximum = range ? 4 : eligible ? 2 : 1
  for (const { cell, seed } of sources) {
    if (placements.length >= maximum) break
    if (
      placements.some(
        (existing) =>
          Math.abs(existing.cellX - cell.x) <= 2.2 && Math.abs(existing.cellY - cell.y) <= 2.2,
      )
    )
      continue
    // Preserve the town/road silhouette and keep feet off existing walkable paths.
    const nearbyRoad = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ].some(([dx, dy]) => {
      const cellAt = terrain.get(worldKey(cell.x + dx!, cell.y + dy!))
      return cellAt?.terrain === 's'
    })
    if (nearbyRoad) continue
    if (
      mountainFrontierAt(sector.atlasColumn ?? -1, sector.atlasRow ?? -1) &&
      (Math.abs(cell.x - 6) < 2 || Math.abs(cell.y - 4) < 2)
    )
      continue
    const row = sector.warpedTheme
      ? 2
      : sector.regionId === 'frostmere'
        ? 1
        : sector.regionId === 'starfall-highlands' &&
            (seed % 5 === 0 || (sector.atlasRow ?? 30) < 17)
          ? 1
          : 0
    const major = range && seed % 3 !== 0
    const type = major ? 1 : seed % 5 === 0 ? 2 : 0
    placements.push({
      x: cell.x + 0.5,
      y: cell.y + 0.85,
      cellX: cell.x,
      cellY: cell.y,
      index: row * 4 + type,
      widthTiles: major ? 3.7 + (seed % 4) * 0.38 : type === 2 ? 1.95 : 2.6,
      heightTiles: major ? 5.5 + (seed % 5) * 0.6 : type === 2 ? 1.7 : 3.4,
      pass: false,
      range,
    })
  }
  // No invented mountain crossing: visible pass art must sit on existing road.
  if (range && (sector.atlasColumn ?? 0) % 3 === 0) {
    const road = terrain.get(worldKey(6, 4))
    if (road?.terrain === '=' && road.walkable && !nearLandmark(6, 4)) {
      const typeRow = sector.atlasRow !== undefined && sector.atlasRow < 17 ? 1 : 0
      placements.push({
        x: 6.5,
        y: 4.85,
        cellX: 6,
        cellY: 4,
        index: typeRow * 4 + 3,
        widthTiles: 2.8,
        heightTiles: 1.65,
        pass: true,
        range,
      })
    }
  }
  return placements
}
