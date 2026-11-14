import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { hashString } from '@/world/terrain-gen'
import { GRAND_DISCOVERY_SITES, type GrandDiscoveryId } from '@/world/discovery-sites'
import { grandDiscoveryBarrier } from '@/world/discovery-collision'
import type { WorldAtlasCell, WorldCell, WorldSectorView } from '@/world/types'
import { ATLAS_ROWS, wrapAtlasColumn } from '@/world/topology'
import { MAP_X, MAP_Y } from './map-projection'

export const grandDiscoverySites = GRAND_DISCOVERY_SITES
export type { GrandDiscoveryId } from '@/world/discovery-sites'
export interface GrandDiscoveryPlacement {
  id: GrandDiscoveryId
  regionId: string
  sheet: 'grand-discoveries' | 'elemental-waterfall-valley' | 'remote-colosseum'
  index: number
  columns: number
  rows: number
  worldx: number
  worldy: number
  widthTiles: number
  heightTiles: number
  anchorX: number
  anchorY: number
  footprint: { left: number; top: number; width: number; height: number }
  /** Open arena floor is composited below actors; walls retain normal scenery depth. */
  arenaFloor?: { cx: number; cy: number; rx: number; ry: number }
  waterfall?: true
  waterfallStyle?: 'grand'
}
const art = {
  'remote-fortress': {
    sheet: 'grand-discoveries',
    index: 1,
    columns: 2,
    rows: 2,
    widthTiles: 12,
    heightTiles: 11,
    anchorX: 0.5,
    anchorY: 0.86,
  },
  'abandoned-town': {
    sheet: 'grand-discoveries',
    index: 2,
    columns: 2,
    rows: 2,
    widthTiles: 14,
    heightTiles: 12,
    anchorX: 0.5,
    anchorY: 0.87,
  },
  'elemental-valley': {
    sheet: 'elemental-waterfall-valley',
    index: 0,
    columns: 1,
    rows: 1,
    waterfall: true,
    waterfallStyle: 'grand',
    widthTiles: 74,
    heightTiles: 56,
    anchorX: 0.5,
    anchorY: 0.88,
  },
  'remote-colosseum': {
    sheet: 'remote-colosseum',
    index: 0,
    columns: 1,
    rows: 1,
    widthTiles: 64,
    heightTiles: 48,
    anchorX: 0.5,
    anchorY: 0.85,
    arenaFloor: { cx: 0.5, cy: 0.52, rx: 0.38, ry: 0.25 },
  },
} as const

/** Invert the isometric projection so a painted ground point sits on its actual world location. */
function discoveryArtAnchor(site: (typeof GRAND_DISCOVERY_SITES)[number]) {
  const piece = art[site.id]
  const sourceY =
    site.id === 'elemental-valley'
      ? 0.75
      : site.id === 'remote-colosseum'
        ? 0.52
        : site.id === 'remote-fortress'
          ? 0.77
          : 0.76
  const groundX = site.left + site.width / 2
  const groundY = site.top + (site.id === 'elemental-valley' ? 29 : site.height / 2)
  const dx = ((piece.anchorX - 0.5) * piece.widthTiles) / MAP_X
  const dy = ((piece.anchorY - sourceY) * piece.heightTiles) / MAP_Y
  return { worldx: groundX + (dx + dy) / 2, worldy: groundY + (dy - dx) / 2 }
}

/** Fixed public sites never move. Server-proved public footprints may span beyond supplied local cells. */
export function grandDiscoveryPlacements(
  sectors: readonly WorldSectorView[],
  provedPublicSites: readonly GrandDiscoveryId[] = [],
): GrandDiscoveryPlacement[] {
  // Only four authored site neighborhoods are indexed, even when a complete atlas is supplied.
  const relevant = sectors.filter(
    (s) =>
      s.charted &&
      !s.townId &&
      !s.warpedTheme &&
      s.atlasColumn !== undefined &&
      s.atlasRow !== undefined &&
      GRAND_DISCOVERY_SITES.some(
        (site) =>
          s.atlasColumn! * GRID_WIDTH < site.left + site.width &&
          s.atlasColumn! * GRID_WIDTH + GRID_WIDTH > site.left &&
          s.atlasRow! * GRID_HEIGHT < site.top + site.height + 2 &&
          s.atlasRow! * GRID_HEIGHT + GRID_HEIGHT > site.top,
      ),
  )
  const known = new Map<string, { sector: WorldSectorView; cell: WorldCell }>()
  for (const sector of relevant)
    for (const cell of sector.cells) {
      if (
        !Number.isInteger(cell.x) ||
        !Number.isInteger(cell.y) ||
        cell.x < 0 ||
        cell.x >= GRID_WIDTH ||
        cell.y < 0 ||
        cell.y >= GRID_HEIGHT
      )
        continue
      known.set(
        `${sector.atlasColumn! * GRID_WIDTH + cell.x}:${sector.atlasRow! * GRID_HEIGHT + cell.y}`,
        { sector, cell },
      )
    }
  const proved = new Set(provedPublicSites)
  const results: GrandDiscoveryPlacement[] = []
  for (const site of GRAND_DISCOVERY_SITES) {
    const water = new Set('water' in site ? site.water.map((p) => `${p.x}:${p.y}`) : [])
    const deepWater = new Set('deepWater' in site ? site.deepWater.map((p) => `${p.x}:${p.y}`) : [])
    if (
      !relevant.some(
        (s) =>
          s.atlasColumn! * GRID_WIDTH < site.left + site.width &&
          s.atlasColumn! * GRID_WIDTH + GRID_WIDTH > site.left &&
          s.atlasRow! * GRID_HEIGHT < site.top + site.height &&
          s.atlasRow! * GRID_HEIGHT + GRID_HEIGHT > site.top &&
          s.cells.some(
            (c) =>
              s.atlasColumn! * GRID_WIDTH + c.x >= site.left &&
              s.atlasColumn! * GRID_WIDTH + c.x < site.left + site.width &&
              s.atlasRow! * GRID_HEIGHT + c.y >= site.top &&
              s.atlasRow! * GRID_HEIGHT + c.y < site.top + site.height,
          ),
      )
    )
      continue
    let valid = true
    for (let y = 0; y < site.height + 2 && valid; y++)
      for (let x = 0; x < site.width; x++) {
        // The entrance has a three-cell dry approach; peripheral old river edges remain literal.
        if (y >= site.height && Math.abs(x - Math.floor(site.width / 2)) > 1) continue
        const entry = known.get(`${site.left + x}:${site.top + y}`)
        if (!entry && proved.has(site.id)) continue
        if (!entry || entry.cell.safe) {
          valid = false
          break
        }
        const { cell, sector } = entry
        const wet = y < site.height && water.has(`${x}:${y}`)
        const deep = y < site.height && deepWater.has(`${x}:${y}`)
        const barrier = grandDiscoveryBarrier(site.id, x, y)
        if (
          deep
            ? cell.terrain !== '~' || cell.walkable
            : wet
              ? cell.terrain !== 'w' || !cell.walkable
              : barrier && cell.terrain === '#' && !cell.walkable
                ? false
                : !cell.walkable || !['.', 't', '='].includes(cell.terrain)
        ) {
          valid = false
          break
        }
        if (
          sector.buildings?.some(
            (b) =>
              cell.x >= b.x && cell.x < b.x + b.width && cell.y >= b.y && cell.y < b.y + b.height,
          ) ||
          sector.landmarks.some((l) => l.x === cell.x && l.y === cell.y) ||
          sector.warpedScenery ||
          sector.impactSite
        ) {
          valid = false
          break
        }
      }
    if (valid)
      results.push({
        id: site.id,
        regionId: site.regionId,
        ...art[site.id],
        ...discoveryArtAnchor(site),
        footprint: { left: site.left, top: site.top, width: site.width, height: site.height },
      })
  }
  return results
}

// Conservative measured normalized water apron; the high arch canopy above it is airborne art.
export const OCEAN_GRAND_WATER_APRON = { left: 0, top: 0.36, right: 1, bottom: 1 } as const

export interface OceanFeaturePlacement {
  sectorId: string
  sheet: 'ocean-features' | 'ocean-grand-islet'
  index: number
  columns: 1 | 3
  rows: 1 | 2
  worldx: number
  worldy: number
  widthTiles: number
  heightTiles: number
  anchorX: number
  anchorY: number
  coastSide: 0 | 1 | 2 | 3
  large?: true
  waterFootprint?: { left: number; top: number; width: number; height: number }
}

/** Verified public coast edges prove open sea; absent loaded chunks alone never do. */
export function oceanFeaturePlacements(
  sectors: readonly WorldSectorView[],
  coasts: ReadonlyMap<string, readonly import('./map-coast').CoastEdge[]>,
  atlas?: readonly WorldAtlasCell[],
): OceanFeaturePlacement[] {
  const placements: OceanFeaturePlacement[] = []
  let largeCount = 0
  const occupied = new Set([
    ...(atlas ?? []).map((cell) => `${wrapAtlasColumn(cell.column)}:${cell.row}`),
    ...sectors
      .filter((s) => s.atlasColumn !== undefined && s.atlasRow !== undefined)
      .map((s) => `${wrapAtlasColumn(s.atlasColumn!)}:${s.atlasRow}`),
  ])
  const openWater = (left: number, top: number, width: number, height: number) => {
    if (!atlas?.length || top < 0 || top + height > ATLAS_ROWS * GRID_HEIGHT) return false
    for (
      let row = Math.floor(top / GRID_HEIGHT);
      row <= Math.floor((top + height - 0.001) / GRID_HEIGHT);
      row++
    )
      for (
        let column = Math.floor(left / GRID_WIDTH);
        column <= Math.floor((left + width - 0.001) / GRID_WIDTH);
        column++
      )
        if (occupied.has(`${wrapAtlasColumn(column)}:${row}`)) return false
    return true
  }
  for (const sector of [...sectors].sort((a, b) => a.id.localeCompare(b.id))) {
    if (
      !sector.charted ||
      sector.warpedTheme ||
      sector.townId ||
      sector.atlasColumn === undefined ||
      sector.atlasRow === undefined
    )
      continue
    const seed = hashString(`offshore:${sector.atlasColumn}:${sector.atlasRow}`)
    if (seed % 7 !== 0 && !(atlas?.length && seed % 11 === 0)) continue
    const edge = [...(coasts.get(sector.id) ?? [])]
      .sort((a, b) => a.side - b.side)
      .find(
        (edge) =>
          Number.isInteger(edge.side) &&
          edge.side >= 0 &&
          edge.side <= 3 &&
          Number.isInteger(edge.from) &&
          Number.isInteger(edge.to) &&
          edge.from >= 0 &&
          edge.to <= (edge.side % 2 ? GRID_HEIGHT : GRID_WIDTH) &&
          edge.to - edge.from >= 7 &&
          !(edge.side === 0 && sector.atlasRow === 0) &&
          !(edge.side === 2 && sector.atlasRow === 63),
      )
    if (!edge) continue
    const along = edge.from + 3 + (seed % (edge.to - edge.from - 5))
    let known = true
    for (let i = along - 2; i <= along + 2; i++) {
      const x = edge.side === 1 ? GRID_WIDTH - 1 : edge.side === 3 ? 0 : i
      const y = edge.side === 0 ? 0 : edge.side === 2 ? GRID_HEIGHT - 1 : i
      const cell = sector.cells.find((c) => c.x === x && c.y === y)
      if (!cell || !cell.walkable || !['.', 't', '='].includes(cell.terrain)) {
        known = false
        break
      }
    }
    if (!known) continue
    const originX = sector.atlasColumn * GRID_WIDTH,
      originY = sector.atlasRow * GRID_HEIGHT
    if (atlas?.length && seed % 11 === 0 && largeCount < 2) {
      const worldx =
        originX + (edge.side === 1 ? GRID_WIDTH + 14 : edge.side === 3 ? -14 : along + 0.5)
      const worldy =
        originY + (edge.side === 0 ? -14 : edge.side === 2 ? GRID_HEIGHT + 14 : along + 0.5)
      const waterFootprint = { left: worldx - 12, top: worldy - 12, width: 24, height: 24 }
      if (
        openWater(
          waterFootprint.left,
          waterFootprint.top,
          waterFootprint.width,
          waterFootprint.height,
        )
      ) {
        placements.push({
          sectorId: sector.id,
          sheet: 'ocean-grand-islet',
          index: 0,
          columns: 1,
          rows: 1,
          worldx,
          worldy,
          widthTiles: 18,
          heightTiles: 12,
          anchorX: 0.5,
          anchorY: 0.78,
          coastSide: edge.side,
          large: true,
          waterFootprint,
        })
        largeCount++
        if (placements.length === 12) break
        continue
      }
    }
    if (seed % 7 !== 0) continue
    placements.push({
      sectorId: sector.id,
      sheet: 'ocean-features',
      index: Math.floor(seed / 7) % 6,
      columns: 3,
      rows: 2,
      worldx: originX + (edge.side === 1 ? GRID_WIDTH + 4 : edge.side === 3 ? -4 : along + 0.5),
      worldy: originY + (edge.side === 0 ? -4 : edge.side === 2 ? GRID_HEIGHT + 4 : along + 0.5),
      widthTiles: 5.5,
      heightTiles: 5,
      anchorX: 0.5,
      anchorY: 0.78,
      coastSide: edge.side,
    })
    if (placements.length === 12) break
  }
  return placements
}
