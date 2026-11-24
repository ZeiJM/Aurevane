import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { decodeTerrainRows, terrainWalkable } from '@/world/terrain'
import { parseVoidSectorId } from '@/world/void-realms'
import type { WorldSectorView, WorldUnchartedTerrain, WorldView } from '@/world/types'
import { mapSceneDomain } from './map-scene-domain'

const expanded = new WeakMap<WorldUnchartedTerrain, WorldSectorView>()
const cache = new WeakMap<
  WorldUnchartedTerrain[],
  { scene: WorldView['sectors']; origin: string; result: WorldSectorView[] }
>()

/** Terrain for rendering and pointing at the ground. Route previews and presence use the scene. */
export function unchartedRenderTerrain(
  view: Pick<WorldView, 'sectors' | 'unchartedTerrain'> & Partial<Pick<WorldView, 'position'>>,
  base: WorldSectorView[],
): WorldSectorView[] {
  const source = view.unchartedTerrain
  const current = view.sectors.find((sector) => sector.id === view.position?.sectorId)
  const domain = current && mapSceneDomain(current)
  const belongs = (sector: WorldSectorView) =>
    current?.warpedTheme && !current.charted
      ? mapSceneDomain(sector) === domain
      : !sector.warpedTheme || sector.charted || mapSceneDomain(sector) === domain
  // During a crossing even an empty terrain receipt can retain authority cells
  // from the previous scene. Never project those across realms at a shared address.
  if (!source?.length || !current?.warpedTheme || current.charted)
    return base.every(belongs) ? base : base.filter(belongs)
  const realm = parseVoidSectorId(current.id)
  const legacy = domain === 'uncharted:legacy'
  if (!realm && !legacy) return base
  const saved = cache.get(source)
  if (saved?.scene === view.sectors && saved.origin === current.id) return saved.result
  const known = new Map(
    base.filter((sector) => mapSceneDomain(sector) === domain).map((sector) => [sector.id, sector]),
  )
  for (const chunk of source) {
    const [id, encoded, regionId, column, row, warpedTheme, landscape] = chunk
    const address = parseVoidSectorId(id)
    if (
      realm
        ? address?.realmId !== realm.realmId || address.column !== column || address.row !== row
        : !id.startsWith('uncharted-')
    )
      continue
    if (
      !Number.isInteger(column) ||
      !Number.isInteger(row) ||
      column < 0 ||
      column >= 64 ||
      row < 0 ||
      row >= 48
    )
      continue
    let terrain = expanded.get(chunk)
    if (!terrain) {
      const ground = decodeTerrainRows(encoded, GRID_WIDTH * GRID_HEIGHT)
      if (ground === null) continue
      terrain = {
        id,
        name: 'Uncharted Lands',
        coordinate: 'Beyond the charts',
        regionId,
        art: null,
        charted: false,
        east: column,
        north: row,
        sceneColumn: column,
        sceneRow: row,
        warpedTheme,
        landscape: landscape ?? undefined,
        landmarks: [],
        exits: [],
        cells: Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, index) => ({
          x: index % GRID_WIDTH,
          y: Math.floor(index / GRID_WIDTH),
          terrain: ground[index]!,
          walkable: terrainWalkable(ground[index]!),
          safe: ground[index] === 's',
        })),
      }
      expanded.set(chunk, terrain)
    }
    if (mapSceneDomain(terrain) !== domain) continue
    const surveyed = known.get(id)
    known.set(id, surveyed ? { ...surveyed, cells: terrain.cells } : terrain)
  }
  const result = [...known.values()]
  cache.set(source, { scene: view.sectors, origin: current.id, result })
  return result
}
