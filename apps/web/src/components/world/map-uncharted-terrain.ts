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

/** This geometry is painted only. Never feed its cells into navigation or presence. */
export function unchartedRenderTerrain(
  view: Pick<WorldView, 'sectors' | 'unchartedTerrain'> & Partial<Pick<WorldView, 'position'>>,
  base: WorldSectorView[],
): WorldSectorView[] {
  const source = view.unchartedTerrain
  const current = view.sectors.find((sector) => sector.id === view.position?.sectorId)
  if (!source?.length) return base
  const domain = current && mapSceneDomain(current)
  if (!current?.warpedTheme || current.charted)
    return base.filter(
      (sector) => !sector.warpedTheme || sector.charted || mapSceneDomain(sector) === domain,
    )
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
