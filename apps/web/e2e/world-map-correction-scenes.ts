import { atlasSectors } from '../src/world/atlas'
import { WORLD_REGIONS } from '../src/world/catalog'
import { GRAND_DISCOVERY_SITES, REMOTE_GRAND_CROSSING } from '../src/world/discovery-sites'
import { isSafe, isWalkable } from '../src/world/travel'
import type { WorldPosition, WorldSector, WorldSectorView } from '../src/world/types'
import { buildWaterField } from '../src/components/world/map-water'
import { buildPublicCoasts } from '../src/components/world/map-coast'
import {
  grandDiscoveryPlacements,
  oceanFeaturePlacements,
} from '../src/components/world/map-grand-discoveries'
import { lavaFallSite } from '../src/components/world/map-surface-art'
import { townArchitectureArt } from '../src/components/world/map-town-architecture'
import { valleyDetailArt } from '../src/components/world/map-grand-detail-art'
import { MAP_X, MAP_Y } from '../src/components/world/map-projection'

export interface CorrectionScene {
  id: string
  position: WorldPosition
  detailPosition?: WorldPosition
  detailSides?: {
    id: string
    position: WorldPosition
    asset: string
    identity: 'clear' | 'occluded'
  }[]
  detailIdentity?: 'occluded'
  assets: string[]
  normalAssets?: string[]
  zoom?: number
  storm?: boolean
  reducedPair?: boolean
  footprint?: { left: number; top: number; width: number; height: number }
  artTiles?: { width: number; height: number }
  expect?: 'rocks' | 'lake' | 'river' | 'coast' | 'bridge' | 'lavafall' | 'arena'
}
export function canonicalPublicView(sector: WorldSector): WorldSectorView {
  const { rows, roads, ...metadata } = sector
  return {
    ...metadata,
    exits: [...roads],
    cells: rows.flatMap((row, y) =>
      [...row].map((terrain, x) => ({
        x,
        y,
        terrain,
        walkable: isWalkable(sector, { x, y }),
        safe: isSafe(sector, { x, y }),
      })),
    ),
  }
}
export function correctionScenes() {
  const sectors = atlasSectors(),
    views = sectors.map(canonicalPublicView)
  const byId = new Map(sectors.map((sector) => [sector.id, sector]))
  const point = (sector: WorldSector, preferred?: { x: number; y: number }): WorldPosition => {
    const candidates = sector.rows.flatMap((row, y) =>
      [...row].flatMap((_, x) => (isWalkable(sector, { x, y }) ? [{ x, y }] : [])),
    )
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - (preferred?.x ?? 6), a.y - (preferred?.y ?? 4)) -
        Math.hypot(b.x - (preferred?.x ?? 6), b.y - (preferred?.y ?? 4)),
    )
    if (!candidates[0]) throw new Error(`No legal correction review position in ${sector.id}`)
    return { sectorId: sector.id, ...candidates[0] }
  }
  const towns: CorrectionScene[] = WORLD_REGIONS.map((region) => ({
    id: `town-${region.id}`,
    position: point(byId.get(region.id)!),
    assets: ['town-grand-architecture-v01.webp'],
  }))
  const water = buildWaterField(views)
  const lake = views
    .flatMap((sector) =>
      [...(water.get(sector.id)?.cells.values() ?? [])]
        .filter(
          (cell) =>
            cell.basin &&
            !cell.shallow &&
            !sector.townId &&
            cell.basin.width <= 16 &&
            cell.basin.height <= 14,
        )
        .map((cell) => ({ sector, cell })),
    )
    .sort(
      (a, b) =>
        b.cell.basin!.width * b.cell.basin!.height - a.cell.basin!.width * a.cell.basin!.height,
    )[0]
  if (!lake) throw new Error('No complete public natural lake for native correction review')
  const atlas = sectors.map((s) => ({
    id: s.id,
    name: s.name,
    coordinate: s.coordinate,
    regionId: s.regionId,
    column: s.atlasColumn!,
    row: s.atlasRow!,
    charted: true,
  }))
  const coasts = buildPublicCoasts({ sectors: views, atlas })
  const ocean = oceanFeaturePlacements(views, coasts, atlas).find((placement) => placement.large)
  if (!ocean) throw new Error('No authoritative offshore feature for native correction review')
  const oceanSector = byId.get(ocean.sectorId)!
  const rock = sectors.find(
    (sector) =>
      sector.regionId === 'frostmere' &&
      !sector.townId &&
      sector.rows.join('').split('#').length > 3,
  )!
  const lava = views
    .map((sector) => ({ sector, fall: lavaFallSite(sector) }))
    .find(({ fall }) => fall)!
  if (!rock || !lava) throw new Error('Missing canonical snowy rock or lava cascade review scene')
  const landscapes: CorrectionScene[] = [
    {
      id: 'snowy-rock-grounding-relief',
      position: point(rock),
      assets: ['biomes-v02.webp'],
      expect: 'rocks',
    },
    {
      id: 'organic-lake-depth',
      position: point(byId.get(lake.sector.id)!, lake.cell),
      assets: ['natural-lakes-v01.webp'],
      zoom: 0.65,
      expect: 'lake',
    },
    {
      id: 'extended-river-grand-bridge',
      position: point(byId.get(REMOTE_GRAND_CROSSING.sectorId)!, REMOTE_GRAND_CROSSING),
      assets: ['grand-discoveries-v01.webp'],
      zoom: 0.65,
      storm: true,
      expect: 'river',
    },
    {
      id: 'coast-ocean-depth',
      position: point(oceanSector, {
        x: Math.max(0, Math.min(12, ocean.worldx - oceanSector.atlasColumn! * 13)),
        y: Math.max(0, Math.min(8, ocean.worldy - oceanSector.atlasRow! * 9)),
      }),
      assets: ['ocean-grand-islet-v01.webp'],
      zoom: 0.35,
      storm: true,
      reducedPair: true,
      expect: 'coast',
      footprint: ocean.waterFootprint,
      artTiles: { width: ocean.widthTiles, height: ocean.heightTiles },
    },
    {
      id: 'walkable-moat-shallows',
      position: point(
        sectors.find(
          (s) => s.townId === 'umbral-march' && s.landmarks.some((l) => l.kind === 'bridge'),
        )!,
      ),
      assets: ['grand-bridges-v01.webp'],
      expect: 'bridge',
    },
    {
      id: 'lava-channel-cascade',
      position: point(byId.get(lava.sector.id)!, lava.fall),
      assets: ['lavafalls-v01.webp'],
      expect: 'lavafall',
    },
  ]
  const discoveries: CorrectionScene[] = GRAND_DISCOVERY_SITES.map((site) => {
    const geometry = grandDiscoveryPlacements(views).find((placement) => placement.id === site.id)!
    if (!geometry) throw new Error(`Canonical public footprint cannot prove ${site.id}`)
    let gx = Math.floor(site.left + site.width / 2),
      gy = Math.floor(site.top + site.height / 2)
    if (geometry.arenaFloor) {
      const sx = (geometry.arenaFloor.cx - geometry.anchorX) * geometry.widthTiles
      const sy = (geometry.arenaFloor.cy - geometry.anchorY) * geometry.heightTiles
      gx = Math.floor(geometry.worldx + (sx / 0.85 + sy / 0.44) / 2)
      gy = Math.floor(geometry.worldy + (sy / 0.44 - sx / 0.85) / 2)
    }
    const sector = sectors.find(
      (s) => s.atlasColumn === Math.floor(gx / 13) && s.atlasRow === Math.floor(gy / 9),
    )!
    let detailPosition: WorldPosition | undefined
    let detailSides: CorrectionScene['detailSides']
    if (site.id === 'remote-colosseum' || site.id === 'elemental-valley') {
      // Review the rear masonry / statue-side cascade instead of enlarging only
      // the arena floor or central basin. Resolve to real nearby legal ground.
      const focus = site.id === 'remote-colosseum' ? { u: 0.5, v: 0.3 } : { u: 0.63, v: 0.58 }
      const dx = ((focus.u - geometry.anchorX) * geometry.widthTiles) / MAP_X
      const dy = ((focus.v - geometry.anchorY) * geometry.heightTiles) / MAP_Y
      const x = Math.floor(geometry.worldx + (dx + dy) / 2)
      const y = Math.floor(geometry.worldy + (dy - dx) / 2)
      const detailSector = sectors.find(
        (s) => s.atlasColumn === Math.floor(x / 13) && s.atlasRow === Math.floor(y / 9),
      )
      if (!detailSector) throw new Error(`No public detail review sector for ${site.id}`)
      detailPosition = point(detailSector, { x: x % 13, y: y % 9 })
      if (site.id === 'remote-colosseum')
        detailSides = [-5, 5].map((offset) => {
          const wx = x + offset,
            wy = y - offset
          const sector = sectors.find(
            (s) => s.atlasColumn === Math.floor(wx / 13) && s.atlasRow === Math.floor(wy / 9),
          )
          if (!sector) throw new Error('Missing public colosseum side viewpoint')
          const id = offset < 0 ? 'left' : 'right'
          return {
            id,
            position: point(sector, { x: wx % 13, y: wy % 9 }),
            asset: `colosseum-${id}-detail-v01.webp`,
            // Legal-ground snapping places the right viewpoint inside the open
            // floor ellipse; the left viewpoint remains behind the rear wall.
            identity: id === 'left' ? ('occluded' as const) : ('clear' as const),
          }
        })
    }
    return {
      id: site.id,
      position: point(sector, { x: gx % 13, y: gy % 9 }),
      detailPosition,
      detailSides,
      detailIdentity: site.id === 'remote-colosseum' ? ('occluded' as const) : undefined,
      assets: [`${geometry.sheet}-v01.webp`],
      normalAssets:
        site.id === 'elemental-valley'
          ? valleyDetailArt.map((detail) => `${detail.sheet}-v01.webp`)
          : undefined,
      zoom: site.width >= 40 ? 0.35 : 0.65,
      expect: site.id === 'remote-colosseum' ? 'arena' : undefined,
      footprint: { left: site.left, top: site.top, width: site.width, height: site.height },
      artTiles: { width: geometry.widthTiles, height: geometry.heightTiles },
    }
  })
  return { towns, landscapes, discoveries }
}

/** Browser walks start on real walkable ground beneath current authored silhouettes. */
export function canonicalOcclusionWalks() {
  const districts = atlasSectors()
    .filter((sector) => sector.townId === 'frostmere')
    .sort((a, b) => Number(b.id === 'frostmere') - Number(a.id === 'frostmere'))
  const adjacent = (sector: WorldSector, from: { x: number; y: number }) =>
    [
      { x: from.x, y: from.y + 1 },
      { x: from.x + 1, y: from.y },
      { x: from.x, y: from.y - 1 },
      { x: from.x - 1, y: from.y },
    ].find((to) => isWalkable(sector, to))
  let roof:
    | {
        label: 'roof'
        sectorId: string
        from: { x: number; y: number }
        to: { x: number; y: number }
      }
    | undefined
  let tree:
    | {
        label: 'tree'
        sectorId: string
        from: { x: number; y: number }
        to: { x: number; y: number }
      }
    | undefined
  for (const sector of districts) {
    const view = canonicalPublicView(sector)
    for (const building of sector.buildings ?? []) {
      if (roof || building.artIndex < 10 || building.artIndex > 17) continue
      const art = townArchitectureArt(view, building)
      if (!art) continue
      const width = (building.width + building.height) * 0.85 * 1.25
      const foot = { x: building.x + building.width / 2, y: building.y + building.height }
      const from = view.cells.find((cell) => {
        if (!cell.walkable || cell.terrain === 'w' || !adjacent(sector, cell)) return false
        const dx = cell.x + 0.5 - foot.x,
          dy = cell.y + 0.5 - foot.y
        const sx = (dx - dy) * 0.85,
          sy = (dx + dy) * 0.44
        return (
          dx + dy < 0 &&
          Math.abs(sx) < width * 0.3 &&
          sy > -width * art.anchorY * 0.85 &&
          sy < width * (1 - art.anchorY)
        )
      })
      if (from)
        roof = {
          label: 'roof',
          sectorId: sector.id,
          from: { x: from.x, y: from.y },
          to: adjacent(sector, from)!,
        }
    }
    if (!tree) {
      const from = view.cells.find(
        (cell) => cell.terrain === 't' && cell.walkable && adjacent(sector, cell),
      )
      if (from)
        tree = {
          label: 'tree',
          sectorId: sector.id,
          from: { x: from.x, y: from.y },
          to: adjacent(sector, from)!,
        }
    }
  }
  if (!roof || !tree) throw new Error('Current Frostmere lacks a legal roof/tree occlusion walk')
  return [roof, tree]
}
