import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { GRAND_DISCOVERY_SITES } from '@/world/discovery-sites'
import { mountainFrontierAt } from '@/world/mountain-frontier'
import { hashString } from '@/world/terrain-gen'
import { sectorMapOrigin, wrappedMapX, wrapAtlasColumn } from '@/world/topology'
import type { WorldSectorView } from '@/world/types'
import { MAP_X, MAP_Y } from './map-projection'
import { mapSceneDomain } from './map-scene-domain'

export interface MountainPlacement {
  x: number
  y: number
  cellX: number
  cellY: number
  index: number
  widthTiles: number
  heightTiles: number
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
  | 'sceneColumn'
  | 'sceneRow'
  | 'landmarks'
  | 'cells'
  | 'buildings'
  | 'warpedScenery'
  | 'impactSite'
>

const mountainRegions = new Set(['starfall-highlands', 'frostmere', 'emberreach', 'umbral-march'])

/** A rock patch has a few visible outcrops; individual marked cells are still ordinary ground. */
export function denseMountainRidge(sector: MountainSector): boolean {
  return !sector.townId && sector.cells.filter((cell) => cell.terrain === '#').length >= 8
}

export function drawMountainScree(id: string, x: number, y: number): boolean {
  const patch = hashString(`scree:${id}:${Math.floor(x / 3)}:${Math.floor(y / 3)}`)
  return (patch >>> 8) % 9 === (x % 3) + (y % 3) * 3
}

export function isMajorMountainRangeSector(sector: MountainSector): boolean {
  if (sector.townId || sector.regionId !== 'starfall-highlands') return false
  const c = sector.atlasColumn,
    r = sector.atlasRow
  if (c === undefined || r === undefined || c < 41 || c > 55) return false
  return mountainFrontierAt(c, r) || Math.abs(r - (19 + (c - 47) * 0.32)) < 3.5
}

/** Reserve one sector within each two-by-two area for relief. The quieter regions have
 * occasional hills; Starfall's continuous mountain belt carries the highest summits. */
export function mountainPlacements(
  sector: MountainSector,
  permits: (feature: MountainPlacement) => boolean = () => true,
): MountainPlacement[] {
  if (sector.townId || (!sector.charted && !sector.warpedTheme)) return []
  const column = sector.atlasColumn ?? sector.sceneColumn ?? 0
  const row = sector.atlasRow ?? sector.sceneRow ?? 0
  const range = isMajorMountainRangeSector(sector)
  const alpine = mountainRegions.has(sector.regionId) || Boolean(sector.warpedTheme)
  const district = hashString(`ridge:${Math.floor(column / 2)}:${Math.floor(row / 2)}`)
  const host = district % 4 === (column % 2) + 2 * (row % 2)
  const landform = host && (range || district % (alpine ? 3 : 11) === 0)
  const markedPass = range && column % 3 === 0
  if (!landform && !markedPass) return []

  const placements: MountainPlacement[] = []
  const terrain = new Map(sector.cells.map((cell) => [cell.y * GRID_WIDTH + cell.x, cell.terrain]))
  const nearSite = (x: number, y: number) =>
    sector.landmarks.some((l) => Math.abs(l.x - x) <= 3.5 && Math.abs(l.y - y) <= 4)
  const rowIndex = sector.warpedTheme
    ? 2
    : sector.regionId === 'frostmere' || (range && row < 17)
      ? 1
      : 0
  if (landform && !sector.impactSite && !sector.warpedScenery) {
    const seed = hashString('formation:' + sector.id)
    const type = range || (alpine && seed % 4 === 0) ? 1 : alpine || seed % 3 === 0 ? 0 : 2
    // North and south ends of the road through an alpine sector each have room
    // for an outcrop. Require the entire painted base to lie on known dry terrain.
    const candidates = sector.cells
      .filter(
        (cell) =>
          cell.terrain === '#' &&
          cell.x >= 2 &&
          cell.x < GRID_WIDTH - 2 &&
          cell.y >= 1 &&
          cell.y < GRID_HEIGHT - 1 &&
          !nearSite(cell.x, cell.y) &&
          (sector.buildings ?? []).every(
            (b) =>
              cell.x < b.x - 2 ||
              cell.x >= b.x + b.width + 2 ||
              cell.y < b.y - 2 ||
              cell.y >= b.y + b.height + 2,
          ) &&
          [-2, -1, 0, 1, 2].every((dx) =>
            [-1, 0, 1].every((dy) => {
              const ground = terrain.get((cell.y + dy) * GRID_WIDTH + cell.x + dx)
              return ground === '#' || ground === 't' || ground === '.'
            }),
          ),
      )
      .map((cell) => ({ cell, seed: hashString(`${seed}:${cell.x}:${cell.y}`) }))
      .sort((a, b) => a.seed - b.seed)
    const size = 1 + ((seed % 5) - 2) * 0.045
    for (const { cell } of candidates) {
      const feature = {
        x: cell.x + 0.5,
        y: cell.y + 0.85,
        cellX: cell.x,
        cellY: cell.y,
        index: rowIndex * 4 + type,
        widthTiles: (type === 1 ? 8.9 : type === 0 ? 7.4 : 5.8) * size,
        heightTiles: (type === 1 ? 10.6 : type === 0 ? 7.8 : 5.1) * size,
        pass: false,
        range,
      }
      if (permits(feature)) {
        placements.push(feature)
        break
      }
    }
  }
  if (markedPass && terrain.get(4 * GRID_WIDTH + 6) === '=' && !nearSite(6, 4)) {
    placements.push({
      x: 6.5,
      y: 4.85,
      cellX: 6,
      cellY: 4,
      index: rowIndex * 4 + 3,
      widthTiles: 2.8,
      heightTiles: 1.65,
      pass: true,
      range,
    })
  }
  return placements
}

/** Cull by the painted silhouette, including landmarks across a supplied sector boundary.
 * Index once when the scene changes; the mountaintop can enter the viewport before its ground. */
export function indexMountainPlacements(sectors: readonly WorldSectorView[]) {
  const sites = sectors.flatMap((sector) => {
    const origin = sectorMapOrigin(sector)
    return sector.landmarks.map((l) => ({
      domain: mapSceneDomain(sector),
      x: origin.x + l.x + 0.5,
      y: origin.y + l.y + 0.5,
    }))
  })
  const chunks = new Map(
    sectors.map((s) => {
      const origin = sectorMapOrigin(s)
      return [`${mapSceneDomain(s)}:${origin.x / GRID_WIDTH}:${origin.y / GRID_HEIGHT}`, s]
    }),
  )
  const byAddress = new WeakMap<WorldSectorView, Map<number, string>>()
  const terrainAt = (domain: string, x: number, y: number) => {
    const col = Math.floor(x / GRID_WIDTH),
      row = Math.floor(y / GRID_HEIGHT)
    const chunk = chunks.get(`${domain}:${domain === 'atlas' ? wrapAtlasColumn(col) : col}:${row}`)
    if (!chunk) return undefined
    let cells = byAddress.get(chunk)
    if (!cells) {
      cells = new Map(chunk.cells.map((c) => [c.y * GRID_WIDTH + c.x, c.terrain]))
      byAddress.set(chunk, cells)
    }
    return cells.get((y - row * GRID_HEIGHT) * GRID_WIDTH + x - col * GRID_WIDTH)
  }
  return sectors.flatMap((sector) => {
    const origin = sectorMapOrigin(sector)
    const domain = mapSceneDomain(sector)
    return mountainPlacements(sector, (feature) => {
      const x = origin.x + feature.x,
        y = origin.y + feature.y
      if (
        sector.charted &&
        GRAND_DISCOVERY_SITES.some(
          (site) =>
            x >= site.left - 4 &&
            x < site.left + site.width + 4 &&
            y >= site.top - 4 &&
            y < site.top + site.height + 4,
        )
      )
        return false
      // Check the *projected* base, including neighboring sectors. The cliff can tower over
      // the water behind it, but its rocky ground must never spill onto the water or a road.
      for (let cy = Math.floor(y) - 5; cy <= Math.floor(y) + 5; cy++) {
        for (let cx = Math.floor(x) - 5; cx <= Math.floor(x) + 5; cx++) {
          const dx = cx + 0.5 - x,
            dy = cy + 0.5 - y
          const width = (MAP_X * (dx - dy)) / (feature.widthTiles * 0.45 + 0.3)
          const depth =
            (MAP_Y * (dx + dy) + feature.heightTiles * 0.045) / (feature.heightTiles * 0.095 + 0.18)
          if (width * width + depth * depth > 1) continue
          const surface = terrainAt(domain, cx, cy)
          if (surface !== '#' && surface !== 't' && surface !== '.') return false
        }
      }
      return !sites.some((site) => {
        if (site.domain !== domain) return false
        const dx = domain === 'atlas' ? wrappedMapX(site.x, x) - x : site.x - x
        const dy = site.y - y
        const horizontal = Math.abs(MAP_X * (dx - dy))
        const vertical = MAP_Y * (dx + dy)
        return (
          horizontal < feature.widthTiles * 0.46 + 0.65 &&
          vertical < 0.8 &&
          vertical > -feature.heightTiles * 0.89 - 0.75
        )
      })
    }).map((feature) => ({
      ...feature,
      x: origin.x + feature.x,
      y: origin.y + feature.y,
      charted: sector.charted,
    }))
  })
}
